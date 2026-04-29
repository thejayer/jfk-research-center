"""
Recover the 2021 batch DocAI run of 2026-04-28 (run_id 20260428T165125Z).

The LRO succeeded — all 183 input docs were OCR'd and shards landed at
gs://jfk-vault-ocr/batch/20260428T165125Z/13447817048249714977/{N}/ — but
run_docai_batch's metadata-based output mapping returned empty, so all
183 were marked docai_status='failed' / docai_error='no batch output'
without ever running parse/load.

This script:
  1. Re-queries the 183 doc_ids by docai_run_id, ordered by the same
     (num_pages NULLS LAST, document_id) the original queue used, so
     index N in the BQ result == index N in the GCS output dirs.
  2. For each (N, doc_id), reads shards from
     batch/.../13447817048249714977/{N}/, merges, writes the canonical
     merged.json, parses, and loads into docai_* tables.
  3. Updates release_text_versions to docai_status='complete' and
     clears docai_error.

No DocAI API calls — pure shard read + BQ load.
"""
from __future__ import annotations

import argparse
import gc
import sys
import time

from jfk_docai_ingest import (
    CURATED,
    QueueItem,
    _fetch_batch_outputs,
    _split_gcs_uri,
    bq,
    chunk_pages,
    documentai,
    gcs,
    gcs_docai_merged_uri,
    load_parsed,
    log,
    log_step,
    parse_document,
    rtv_flush,
    rtv_stage,
)

RUN_ID = "20260428T165125Z"
OPERATION_ID = "13447817048249714977"
OUTPUT_BASE = f"gs://jfk-vault-ocr/batch/{RUN_ID}/{OPERATION_ID}"


def fetch_recovery_queue() -> list[QueueItem]:
    """Reconstruct the original submit order of the 183 docs.

    The original fetch_queue_v2 used ORDER BY num_pages NULLS LAST,
    document_id with eligibility filtering on rtv state. Now those
    docs are all 'failed' / 'no batch output', so we filter by
    docai_run_id instead — same set, same order.
    """
    sql = f"""
    SELECT
      rtv.document_id,
      rtv.release_set,
      dv.agency,
      dv.num_pages,
      COALESCE(rtv.source_pdf_url, dv.pdf_url) AS pdf_url
    FROM `{CURATED}.release_text_versions` rtv
    JOIN `{CURATED}.document_versions` dv
      USING (document_id, release_set)
    WHERE rtv.release_set = '2021'
      AND rtv.docai_run_id = '{RUN_ID}'
    ORDER BY dv.num_pages NULLS LAST, rtv.document_id
    """
    return [
        QueueItem(
            document_id=r["document_id"],
            release_set=r["release_set"],
            agency=r["agency"],
            num_pages=r["num_pages"],
            pdf_url=r["pdf_url"],
        )
        for r in bq.query(sql).result()
    ]


def shard_prefix(index: int) -> str:
    return f"{OUTPUT_BASE}/{index}/"


def _fetch_completed_ids() -> set[str]:
    """Doc_ids already docai_status='complete' for this run — to skip in re-runs.

    Idempotency check has to be by doc_id, not by queue position: positions
    map to GCS shard dirs and must not shift, but we want to no-op on docs
    already loaded by a prior chunk.
    """
    sql = f"""
    SELECT document_id
    FROM `{CURATED}.release_text_versions`
    WHERE release_set = '2021'
      AND docai_run_id = '{RUN_ID}'
      AND docai_status = 'complete'
    """
    return {r["document_id"] for r in bq.query(sql).result()}


def recover_one(index: int, item: QueueItem) -> bool:
    """Recover a single doc. Returns True on success."""
    prefix = shard_prefix(index)
    try:
        doc = _fetch_batch_outputs(prefix)
    except Exception as e:
        log.exception("[%d] shard merge failed: %s", index, item.document_id)
        log_step(
            item.document_id, item.release_set, "load", "error",
            error_class=type(e).__name__, error_message=f"recovery: {str(e)[:480]}",
        )
        rtv_stage(
            item.document_id, item.release_set,
            docai_status="failed",
            docai_error=f"recovery {type(e).__name__}: {str(e)[:380]}",
        )
        return False

    merged_uri = gcs_docai_merged_uri(item.document_id, item.release_set)
    try:
        merged_bucket, merged_blob = _split_gcs_uri(merged_uri)
        gcs.bucket(merged_bucket).blob(merged_blob).upload_from_string(
            documentai.Document.to_json(doc), content_type="application/json"
        )
    except Exception:
        log.exception("[%d] could not persist merged.json: %s", index, item.document_id)

    try:
        parsed = parse_document(item, "", merged_uri, doc)
        chunks = chunk_pages(item, parsed)
        load_parsed(parsed, chunks)
    except Exception as e:
        log.exception("[%d] parse/load failed: %s", index, item.document_id)
        log_step(
            item.document_id, item.release_set, "load", "error",
            error_class=type(e).__name__, error_message=f"recovery: {str(e)[:480]}",
        )
        rtv_stage(
            item.document_id, item.release_set,
            docai_status="failed",
            docai_error=f"recovery {type(e).__name__}: {str(e)[:380]}",
        )
        return False

    log_step(item.document_id, item.release_set, "load", "ok")
    rtv_stage(
        item.document_id, item.release_set,
        docai_status="complete",
        gcs_docai_uri=merged_uri,
        mean_page_conf=parsed["document"]["mean_page_confidence"],
        page_count=parsed["document"]["num_pages"],
    )
    log.info(
        "[%d] %s ok | pages=%d chunks=%d conf=%.2f",
        index, item.document_id,
        parsed["document"]["num_pages"], len(chunks),
        parsed["document"]["mean_page_confidence"],
    )
    return True


def clear_recovered_errors() -> None:
    """Blank docai_error for rows we just marked complete.

    rtv_flush's MERGE uses COALESCE — passing None preserves the old
    'no batch output' string. One direct UPDATE clears it.
    """
    sql = f"""
    UPDATE `{CURATED}.release_text_versions`
    SET docai_error = NULL,
        updated_at  = CURRENT_TIMESTAMP()
    WHERE release_set = '2021'
      AND docai_run_id = '{RUN_ID}'
      AND docai_status = 'complete'
    """
    job = bq.query(sql)
    job.result()
    log.info("cleared docai_error on %d rows", job.num_dml_affected_rows)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=None,
                   help="process only the first N docs (smoke test).")
    p.add_argument("--start", type=int, default=0,
                   help="resume from index N.")
    args = p.parse_args()

    items = fetch_recovery_queue()
    log.info("recovery queue: %d docs (run_id=%s)", len(items), RUN_ID)
    if not items:
        log.error("no docs found with run_id=%s", RUN_ID)
        return 1

    already_done = _fetch_completed_ids()
    if already_done:
        log.info("skip set: %d docs already docai_status='complete'", len(already_done))

    end = len(items) if args.limit is None else min(len(items), args.start + args.limit)
    t0 = time.time()
    ok = 0
    fail = 0
    skip = 0
    for n in range(args.start, end):
        item = items[n]
        if item.document_id in already_done:
            skip += 1
            continue
        if recover_one(n, item):
            ok += 1
            # Flush rtv per-doc so a crash mid-run doesn't drop state for
            # already-loaded docs (as happened on the 2026-04-29 OOM run).
            rtv_flush()
            # Drop large per-doc allocations explicitly. Python's allocator
            # fragments badly on multi-hundred-page docs (50K+ token dicts)
            # and won't return arenas to the OS without a forced collect;
            # without this the loop OOMs on a 4GB VM around doc 22.
            gc.collect()
        else:
            fail += 1

    rtv_flush()
    clear_recovered_errors()
    log.info(
        "recovery done in %ds: %d ok, %d failed, %d skipped (range %d..%d)",
        int(time.time() - t0), ok, fail, skip, args.start, end - 1,
    )
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
