"""One-off recovery for the 2026-04-28 batch run.

The original batch script had a doc_id mapping bug (collapsed every
input URI to the literal string "document" because of the by-naid
path layout). DocAI succeeded and wrote 1,551 shards; the script
just couldn't match them back to docs and marked everything failed.

This script re-runs the post-LRO half of process_batch_group against
the existing LRO. Inputs are read from the LRO metadata (which has
input_gcs_source -> output_gcs_destination), and item metadata
(release_set, num_pages, etc) is read from release_text_versions.
"""

from __future__ import annotations

import argparse
import logging
import sys

from google.cloud import documentai

import jfk_docai_ingest as core


log = logging.getLogger("recover_lro")


RUN_ID = "20260428T165125Z"
OPERATION_NAME = (
    "projects/690906762945/locations/us/operations/13447817048249714977"
)


def clear_recovered_errors() -> None:
    """Blank docai_error on rows this script just marked complete.

    rtv_flush's MERGE uses COALESCE(s.docai_error, t.docai_error), so passing
    docai_error=None via rtv_stage preserves the stale 'no batch output'
    string. One direct UPDATE clears it, scoped to this run + complete.
    """
    sql = f"""
    UPDATE `{core.CURATED}.release_text_versions`
    SET docai_error = NULL,
        updated_at  = CURRENT_TIMESTAMP()
    WHERE release_set = '2021'
      AND docai_run_id = '{RUN_ID}'
      AND docai_status = 'complete'
    """
    job = core.bq.query(sql)
    job.result()
    log.info("cleared docai_error on %d rows", job.num_dml_affected_rows)


def _doc_id_from_input_uri(uri: str) -> str:
    """gs://jfk-vault-pdfs/by-naid/{naid}/{release}/document.pdf -> {naid}"""
    parts = uri.split("/")
    return parts[-3]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="process only the first N successful docs from the LRO (smoke test).",
    )
    args = p.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )

    log.info("fetching LRO %s", OPERATION_NAME)
    op = core.docai_client.transport.operations_client.get_operation(
        name=OPERATION_NAME
    )
    metadata = documentai.BatchProcessMetadata.deserialize(op.metadata.value)

    # Build doc_id -> output_prefix from the LRO metadata
    out_map: dict[str, str] = {}
    failed: list[tuple[str, str]] = []
    for status in metadata.individual_process_statuses:
        doc_id = _doc_id_from_input_uri(status.input_gcs_source)
        code = getattr(status.status, "code", None)
        if code and code != 0:
            failed.append((doc_id, status.status.message))
            continue
        out_map[doc_id] = status.output_gcs_destination

    log.info(
        "LRO outputs: %d ok, %d failed (state=%s)",
        len(out_map),
        len(failed),
        metadata.state.name,
    )
    for doc_id, msg in failed[:5]:
        log.warning("LRO doc failed: %s — %s", doc_id, msg)

    # Fetch QueueItem-equivalent rows from BQ for each doc we need to load
    if not out_map:
        log.error("no successful outputs in LRO; nothing to recover")
        sys.exit(1)
    doc_ids_csv = ", ".join(f"'{d}'" for d in out_map)
    sql = f"""
    SELECT
      rtv.document_id,
      rtv.release_set,
      dv.agency,
      dv.num_pages,
      COALESCE(rtv.source_pdf_url, dv.pdf_url) AS pdf_url,
      rtv.gcs_pdf_uri
    FROM `{core.CURATED}.release_text_versions` rtv
    JOIN `{core.CURATED}.document_versions` dv
      USING (document_id, release_set)
    WHERE rtv.release_set = '2021'
      AND rtv.document_id IN ({doc_ids_csv})
    """
    rows = list(core.bq.query(sql).result())
    log.info("loaded %d items from BQ", len(rows))

    items_by_id = {
        r["document_id"]: core.QueueItem(
            document_id=r["document_id"],
            release_set=r["release_set"],
            agency=r["agency"],
            num_pages=r["num_pages"],
            pdf_url=r["pdf_url"],
        )
        for r in rows
    }
    gcs_pdfs = {r["document_id"]: r["gcs_pdf_uri"] for r in rows}

    work_items = list(out_map.items())
    if args.limit is not None:
        work_items = work_items[: args.limit]
        log.info("limit=%d → processing first %d of %d outputs",
                 args.limit, len(work_items), len(out_map))

    n_loaded = 0
    n_skipped = 0
    n_errored = 0
    for doc_id, out_prefix in work_items:
        item = items_by_id.get(doc_id)
        if item is None:
            log.warning("no BQ row for doc_id %s; skipping", doc_id)
            n_skipped += 1
            continue
        try:
            doc = core._fetch_batch_outputs(out_prefix)
            merged_uri = core.gcs_docai_merged_uri(
                item.document_id, item.release_set
            )
            merged_bucket, merged_blob = core._split_gcs_uri(merged_uri)
            core.gcs.bucket(merged_bucket).blob(merged_blob).upload_from_string(
                documentai.Document.to_json(doc),
                content_type="application/json",
            )
            parsed = core.parse_document(
                item, gcs_pdfs[doc_id], merged_uri, doc
            )
            chunks = core.chunk_pages(item, parsed)
            core.load_parsed(parsed, chunks)
            core.log_step(item.document_id, item.release_set, "load", "ok")
            core.rtv_stage(
                item.document_id,
                item.release_set,
                docai_status="complete",
                docai_error=None,
                gcs_docai_uri=merged_uri,
                mean_page_conf=parsed["document"]["mean_page_confidence"],
                page_count=parsed["document"]["num_pages"],
            )
            n_loaded += 1
            log.info(
                "loaded %s | pages=%d chunks=%d conf=%.2f",
                item.document_id,
                parsed["document"]["num_pages"],
                len(chunks),
                parsed["document"]["mean_page_confidence"],
            )
        except Exception as e:
            log.exception("recover failed for %s", doc_id)
            n_errored += 1
            core.rtv_stage(
                item.document_id,
                item.release_set,
                docai_status="failed",
                docai_error=f"recover: {type(e).__name__}: {str(e)[:300]}",
            )

    core.rtv_flush()
    clear_recovered_errors()
    log.info(
        "recovery done: loaded=%d skipped=%d errored=%d",
        n_loaded,
        n_skipped,
        n_errored,
    )


if __name__ == "__main__":
    main()
