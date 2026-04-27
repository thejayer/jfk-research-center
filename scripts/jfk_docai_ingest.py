"""
JFK Vault — Document AI OCR ingest pilot.

Reads from jfk_staging.docai_backfill_queue, fetches the PDF,
runs Document AI OCR, parses the response, and loads:
  - docai_documents
  - docai_pages
  - docai_blocks
  - docai_tokens
  - docai_redactions
  - docai_text_chunks
  - docai_processing_log

Designed for a pilot run (e.g. LIMIT 200 from the queue). Scale out
later by wrapping main() in a Cloud Run Job with CONCURRENCY workers.

Prereqs (one-time):
  gcloud auth application-default login
  pip install google-cloud-documentai google-cloud-storage \
              google-cloud-bigquery httpx pypdf pillow
  # Create the Document AI OCR processor in your GCP project first;
  # grab the processor ID from the Cloud Console.

Environment variables:
  GCP_PROJECT            = jfk-vault
  DOCAI_LOCATION         = us   # or eu
  DOCAI_PROCESSOR_ID     = <ocr processor id>
  DOCAI_PROCESSOR_VERSION= pretrained-ocr-v2.0-2023-06-02  # pin this
  GCS_PDF_BUCKET         = jfk-vault-pdfs
  GCS_OCR_BUCKET         = jfk-vault-ocr
  PILOT_LIMIT            = 200
  CHUNK_TARGET_CHARS     = 1000
  CHUNK_OVERLAP_CHARS    = 100
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import io
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Iterable

from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
from google.api_core.client_options import ClientOptions
from google.cloud import bigquery, documentai_v1 as documentai, storage

# ---------- config ----------

PROJECT = os.environ["GCP_PROJECT"]
DOCAI_LOCATION = os.getenv("DOCAI_LOCATION", "us")
DOCAI_PROCESSOR_ID = os.environ["DOCAI_PROCESSOR_ID"]
DOCAI_PROCESSOR_VERSION = os.getenv(
    "DOCAI_PROCESSOR_VERSION", "pretrained-ocr-v2.0-2023-06-02"
)
GCS_PDF_BUCKET = os.environ["GCS_PDF_BUCKET"]
GCS_OCR_BUCKET = os.environ["GCS_OCR_BUCKET"]
PILOT_LIMIT = int(os.getenv("PILOT_LIMIT", "200"))
CHUNK_TARGET_CHARS = int(os.getenv("CHUNK_TARGET_CHARS", "1000"))
CHUNK_OVERLAP_CHARS = int(os.getenv("CHUNK_OVERLAP_CHARS", "100"))

STAGING = f"{PROJECT}.jfk_staging"
CURATED = f"{PROJECT}.jfk_curated"

# Concurrency for archives.gov fetches. NARA appears tolerant but we
# stay polite — this is a public archive, not a CDN. Bump cautiously.
PARALLEL_FETCH_WORKERS = int(os.getenv("PARALLEL_FETCH_WORKERS", "3"))

# State updates to release_text_versions are buffered and bulk-MERGEd
# every N docs. Per-row UPDATEs against BQ would dominate cost at 53K
# rows; one MERGE per N is two orders of magnitude cheaper.
RTV_FLUSH_EVERY = int(os.getenv("RTV_FLUSH_EVERY", "50"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("jfk_docai")

# ---------- clients ----------

bq = bigquery.Client(project=PROJECT)
gcs = storage.Client(project=PROJECT)
docai_client = documentai.DocumentProcessorServiceClient(
    client_options=ClientOptions(
        api_endpoint=f"{DOCAI_LOCATION}-documentai.googleapis.com"
    )
)
PROCESSOR_NAME = (
    f"projects/{PROJECT}/locations/{DOCAI_LOCATION}"
    f"/processors/{DOCAI_PROCESSOR_ID}"
)

# ---------- small helpers ----------


def now() -> datetime:
    return datetime.now(timezone.utc)


def log_step(
    document_id: str,
    release_set: str | None,
    step: str,
    status: str,
    **kwargs,
) -> None:
    row = {
        "document_id": document_id,
        "release_set": release_set,
        "step": step,
        "status": status,
        "processor_version": DOCAI_PROCESSOR_VERSION,
        "event_at": now().isoformat(),
        **kwargs,
    }
    errors = bq.insert_rows_json(f"{STAGING}.docai_processing_log", [row])
    if errors:
        log.warning("log insert failed: %s", errors)


def alpha_ratio(s: str) -> float:
    if not s:
        return 0.0
    alpha = sum(c.isalpha() for c in s)
    return alpha / len(s)


def quality_band(ar: float) -> str:
    if ar >= 0.75:
        return "good"
    if ar >= 0.60:
        return "ok"
    if ar >= 0.45:
        return "weak"
    return "bad"


CLASSIFICATION_RE = re.compile(
    r"\b(TOP\s*SECRET|SECRET|CONFIDENTIAL|UNCLASSIFIED|RESTRICTED)\b",
    re.IGNORECASE,
)


def detect_classification(text: str) -> str | None:
    if not text:
        return None
    m = CLASSIFICATION_RE.search(text)
    return m.group(0).upper().replace(" ", "") if m else None


# ---------- stage 1: fetch PDF to GCS ----------


@dataclasses.dataclass
class QueueItem:
    document_id: str
    release_set: str
    agency: str | None
    num_pages: int | None
    pdf_url: str


def fetch_queue(limit: int, *, mode: str = "sync") -> list[QueueItem]:
    """Pull queued docs from docai_backfill_queue.

    mode='sync'  → docs within the 30-page processDocument ceiling.
    mode='batch' → docs above the ceiling, for the LRO path.
    """
    if mode == "sync":
        page_clause = "num_pages BETWEEN 1 AND 30"
    elif mode == "batch":
        page_clause = "num_pages > 30"
    else:
        raise ValueError(f"unknown mode: {mode}")
    sql = f"""
    SELECT document_id, release_set, agency, num_pages, pdf_url
    FROM `{STAGING}.docai_backfill_queue`
    WHERE {page_clause}
    LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("limit", "INT64", limit)]
    )
    return [
        QueueItem(
            document_id=r["document_id"],
            release_set=r["release_set"],
            agency=r["agency"],
            num_pages=r["num_pages"],
            pdf_url=r["pdf_url"],
        )
        for r in bq.query(sql, job_config=job_config).result()
    ]


def _safe_release(release_set: str) -> str:
    return release_set.replace("/", "-")


def fetch_queue_v2(
    limit: int, *, mode: str = "sync", release_set: str | None = None
) -> list[QueueItem]:
    """Pull queued docs from jfk_curated.release_text_versions.

    Returns rows where fetch or DocAI is still pending, joined to
    document_versions for agency / num_pages / pdf_url. mode='sync'
    selects ≤30-page docs (also rows with NULL num_pages, since we can
    decide post-fetch by inspecting the PDF); mode='batch' selects >30.

    release_set, if given, narrows to a single release — used for the
    2021 shakedown.
    """
    if mode == "sync":
        page_clause = "(dv.num_pages BETWEEN 1 AND 30 OR dv.num_pages IS NULL)"
    elif mode == "batch":
        page_clause = "dv.num_pages > 30"
    else:
        raise ValueError(f"unknown mode: {mode}")

    release_clause = "AND rtv.release_set = @release_set" if release_set else ""
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
    WHERE (rtv.fetch_status = 'pending' OR rtv.docai_status = 'pending')
      AND {page_clause}
      AND COALESCE(rtv.source_pdf_url, dv.pdf_url) IS NOT NULL
      {release_clause}
    ORDER BY dv.num_pages NULLS LAST, rtv.document_id
    LIMIT @limit
    """
    params: list[bigquery.ScalarQueryParameter] = [
        bigquery.ScalarQueryParameter("limit", "INT64", limit)
    ]
    if release_set:
        params.append(
            bigquery.ScalarQueryParameter("release_set", "STRING", release_set)
        )
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    return [
        QueueItem(
            document_id=r["document_id"],
            release_set=r["release_set"],
            agency=r["agency"],
            num_pages=r["num_pages"],
            pdf_url=r["pdf_url"],
        )
        for r in bq.query(sql, job_config=job_config).result()
    ]


_RTV_BUFFER: list[dict] = []


def rtv_stage(document_id: str, release_set: str, **fields) -> None:
    """Buffer a release_text_versions state update. Flushes on RTV_FLUSH_EVERY."""
    row = {"document_id": document_id, "release_set": release_set, **fields}
    _RTV_BUFFER.append(row)
    if len(_RTV_BUFFER) >= RTV_FLUSH_EVERY:
        rtv_flush()


def rtv_flush() -> None:
    """Flush buffered state updates into release_text_versions via MERGE.

    Uses a temp staging table loaded via load_table_from_json (one job per
    flush, ~5-10s) followed by a single MERGE statement, then drops the
    temp table. Per-row UPDATEs would have dominated runtime + scan cost.
    """
    global _RTV_BUFFER
    if not _RTV_BUFFER:
        return
    updates = _RTV_BUFFER
    _RTV_BUFFER = []

    temp_id = uuid.uuid4().hex[:10]
    temp_table = f"{STAGING}.rtv_state_buffer_{temp_id}"

    schema = [
        bigquery.SchemaField("document_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("release_set", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("fetch_status", "STRING"),
        bigquery.SchemaField("fetch_error", "STRING"),
        bigquery.SchemaField("source_pdf_url", "STRING"),
        bigquery.SchemaField("gcs_pdf_uri", "STRING"),
        bigquery.SchemaField("pdf_sha256", "STRING"),
        bigquery.SchemaField("byte_size", "INT64"),
        bigquery.SchemaField("page_count", "INT64"),
        bigquery.SchemaField("fetched_at", "TIMESTAMP"),
        bigquery.SchemaField("docai_status", "STRING"),
        bigquery.SchemaField("docai_run_id", "STRING"),
        bigquery.SchemaField("gcs_docai_uri", "STRING"),
        bigquery.SchemaField("mean_page_conf", "FLOAT64"),
        bigquery.SchemaField("docai_error", "STRING"),
    ]
    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    bq.load_table_from_json(updates, temp_table, job_config=job_config).result()

    merge_sql = f"""
    MERGE `{CURATED}.release_text_versions` t
    USING `{temp_table}` s
    ON t.document_id = s.document_id AND t.release_set = s.release_set
    WHEN MATCHED THEN UPDATE SET
      fetch_status   = COALESCE(s.fetch_status,   t.fetch_status),
      fetch_error    = COALESCE(s.fetch_error,    t.fetch_error),
      source_pdf_url = COALESCE(s.source_pdf_url, t.source_pdf_url),
      gcs_pdf_uri    = COALESCE(s.gcs_pdf_uri,    t.gcs_pdf_uri),
      pdf_sha256     = COALESCE(s.pdf_sha256,     t.pdf_sha256),
      byte_size      = COALESCE(s.byte_size,      t.byte_size),
      page_count     = COALESCE(s.page_count,     t.page_count),
      fetched_at     = COALESCE(s.fetched_at,     t.fetched_at),
      docai_status   = COALESCE(s.docai_status,   t.docai_status),
      docai_run_id   = COALESCE(s.docai_run_id,   t.docai_run_id),
      gcs_docai_uri  = COALESCE(s.gcs_docai_uri,  t.gcs_docai_uri),
      mean_page_conf = COALESCE(s.mean_page_conf, t.mean_page_conf),
      docai_error    = COALESCE(s.docai_error,    t.docai_error),
      updated_at     = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      document_id, release_set, fetch_status, fetch_error, source_pdf_url,
      gcs_pdf_uri, pdf_sha256, byte_size, page_count, fetched_at,
      docai_status, docai_run_id, gcs_docai_uri, mean_page_conf, docai_error,
      updated_at
    ) VALUES (
      s.document_id, s.release_set, s.fetch_status, s.fetch_error, s.source_pdf_url,
      s.gcs_pdf_uri, s.pdf_sha256, s.byte_size, s.page_count, s.fetched_at,
      s.docai_status, s.docai_run_id, s.gcs_docai_uri, s.mean_page_conf, s.docai_error,
      CURRENT_TIMESTAMP()
    )
    """
    bq.query(merge_sql).result()
    bq.delete_table(temp_table, not_found_ok=True)
    log.info("rtv: flushed %d state updates", len(updates))


def gcs_pdf_uri(document_id: str, release_set: str) -> str:
    """gs://jfk-vault-pdfs/by-naid/{naid}/{release}/document.pdf"""
    return (
        f"gs://{GCS_PDF_BUCKET}/by-naid/{document_id}/"
        f"{_safe_release(release_set)}/document.pdf"
    )


def gcs_docai_merged_uri(document_id: str, release_set: str) -> str:
    """gs://jfk-vault-ocr/by-naid/{naid}/{release}/docai/merged.json — the canonical post-merge OCR output."""
    return (
        f"gs://{GCS_OCR_BUCKET}/by-naid/{document_id}/"
        f"{_safe_release(release_set)}/docai/merged.json"
    )


def gcs_docai_dir_prefix(document_id: str, release_set: str) -> str:
    """gs://jfk-vault-ocr/by-naid/{naid}/{release}/docai/ — directory containing merged.json.

    Raw batch shards stay at gs://jfk-vault-ocr/batch/{run_id}/ where DocAI
    wrote them — they are not co-located with the merged output. The
    bucket lifecycle moves anything under batch/ to coldline at 30 days.
    """
    return (
        f"gs://{GCS_OCR_BUCKET}/by-naid/{document_id}/"
        f"{_safe_release(release_set)}/docai/"
    )


def _nara_url_variants(url: str) -> list[str]:
    """archives.gov serves /docid-* lowercase; jfk_records has /DOCID-* uppercase for some rows."""
    variants = [url]
    if "/DOCID-" in url:
        variants.append(url.replace("/DOCID-", "/docid-"))
    return variants


def fetch_pdf(item: QueueItem) -> tuple[str, int, str]:
    """Download PDF, upload to GCS. Returns (gcs_uri, bytes, sha256)."""
    t0 = time.time()
    uri = gcs_pdf_uri(item.document_id, item.release_set)
    bucket_name = uri.split("/")[2]
    blob_name = "/".join(uri.split("/")[3:])
    bucket = gcs.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    if blob.exists():
        log_step(
            item.document_id,
            item.release_set,
            "fetch",
            "skipped",
            gcs_uri=uri,
            duration_ms=0,
        )
        blob.reload()
        return uri, blob.size or 0, blob.md5_hash or ""

    data = None
    last_status = None
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        for candidate in _nara_url_variants(item.pdf_url):
            r = client.get(candidate)
            last_status = r.status_code
            if r.status_code == 404:
                continue
            r.raise_for_status()
            data = r.content
            break
    if data is None:
        raise RuntimeError(
            f"no NARA URL variant succeeded for {item.document_id} (last status {last_status})"
        )

    sha = hashlib.sha256(data).hexdigest()
    blob.upload_from_string(data, content_type="application/pdf")
    log_step(
        item.document_id,
        item.release_set,
        "fetch",
        "ok",
        gcs_uri=uri,
        bytes=len(data),
        sha256=sha,
        http_status=r.status_code,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return uri, len(data), sha


# ---------- stage 2: Document AI OCR ----------


def run_docai(gcs_pdf: str, document_id: str, release_set: str) -> documentai.Document:
    """Synchronous processDocument against the OCR processor.

    For docs larger than the sync limit (30 pages / 20MB) you must switch to
    batchProcess — this pilot uses sync since p95 is 35 pages and we can
    fallback to batch for the long tail. See handle_large_doc() below.
    """
    t0 = time.time()
    bucket_name = gcs_pdf.split("/")[2]
    blob_name = "/".join(gcs_pdf.split("/")[3:])
    pdf_bytes = gcs.bucket(bucket_name).blob(blob_name).download_as_bytes()

    request = documentai.ProcessRequest(
        name=PROCESSOR_NAME,
        raw_document=documentai.RawDocument(
            content=pdf_bytes, mime_type="application/pdf"
        ),
        process_options=documentai.ProcessOptions(
            ocr_config=documentai.OcrConfig(
                enable_native_pdf_parsing=True,
                enable_image_quality_scores=True,
                enable_symbol=False,
                premium_features=documentai.OcrConfig.PremiumFeatures(
                    compute_style_info=False,
                    enable_selection_mark_detection=True,
                ),
            )
        ),
    )
    response = docai_client.process_document(request=request)
    log_step(
        document_id,
        release_set,
        "ocr_complete",
        "ok",
        duration_ms=int((time.time() - t0) * 1000),
    )
    return response.document


# ---------- stage 2b: batch path for >30-page docs ----------


def _batch_output_prefix(run_id: str) -> str:
    return f"gs://{GCS_OCR_BUCKET}/batch/{run_id}/"


def run_docai_batch(
    items: list[QueueItem],
    gcs_pdfs: dict[str, str],
    run_id: str,
) -> dict[str, str]:
    """Submit a batchProcess LRO for docs whose page count exceeds the
    sync limit, poll until complete, and return a mapping of
    document_id -> GCS prefix where the per-doc JSON shards landed.

    Shards look like gs://{bucket}/batch/{run_id}/{N}/{N}-{shard}.json
    where N is the zero-indexed position of the input within the batch.

    Raises if the LRO errors, deadlines (1h), or any individual doc
    status is non-OK. The caller is responsible for parsing shards
    back into documentai.Document objects (see _fetch_batch_outputs).
    """
    output_prefix = _batch_output_prefix(run_id)
    input_docs = documentai.BatchDocumentsInputConfig(
        gcs_documents=documentai.GcsDocuments(
            documents=[
                documentai.GcsDocument(
                    gcs_uri=gcs_pdfs[item.document_id],
                    mime_type="application/pdf",
                )
                for item in items
            ]
        )
    )
    output_config = documentai.DocumentOutputConfig(
        gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(
            gcs_uri=output_prefix,
        )
    )
    request = documentai.BatchProcessRequest(
        name=PROCESSOR_NAME,
        input_documents=input_docs,
        document_output_config=output_config,
    )
    t0 = time.time()
    operation = docai_client.batch_process_documents(request=request)
    log.info(
        "batch LRO submitted: %s (%d docs, output=%s)",
        operation.operation.name,
        len(items),
        output_prefix,
    )

    poll = 10.0
    max_poll = 120.0
    deadline = time.time() + 3600
    while not operation.done():
        if time.time() > deadline:
            raise RuntimeError("batch LRO exceeded 1h deadline")
        time.sleep(poll)
        poll = min(poll * 1.5, max_poll)

    if operation.exception():
        raise operation.exception()  # type: ignore[misc]

    metadata = operation.metadata
    out_map: dict[str, str] = {}
    for status in getattr(metadata, "individual_process_statuses", []):
        src = status.input_gcs_source
        doc_id = src.rsplit("/", 1)[-1].removesuffix(".pdf")
        # State is documentai.BatchProcessMetadata.IndividualProcessStatus.State
        state_name = getattr(status.status, "code", None)
        if state_name and state_name != 0:
            log.error(
                "batch item failed: %s code=%s message=%s",
                doc_id,
                state_name,
                getattr(status.status, "message", ""),
            )
            continue
        out_map[doc_id] = status.output_gcs_destination
    log.info(
        "batch LRO complete in %ds; %d/%d docs ok",
        int(time.time() - t0),
        len(out_map),
        len(items),
    )
    return out_map


def _fetch_batch_outputs(output_prefix: str) -> documentai.Document:
    """Read every .json shard at output_prefix and merge into one Document.

    Document AI writes one shard per ~N pages; merging concatenates their
    .text and .pages lists so the rest of the parser downstream can treat
    the result identically to a sync processDocument response.
    """
    bucket_name = output_prefix.split("/")[2]
    prefix = "/".join(output_prefix.split("/")[3:])
    bucket = gcs.bucket(bucket_name)
    shards = sorted(
        [b for b in bucket.list_blobs(prefix=prefix) if b.name.endswith(".json")],
        key=lambda b: b.name,
    )
    if not shards:
        raise RuntimeError(f"no shards at {output_prefix}")
    merged = documentai.Document()
    for blob in shards:
        raw = blob.download_as_bytes()
        shard = documentai.Document.from_json(raw, ignore_unknown_fields=True)
        merged.text += shard.text
        merged.pages.extend(shard.pages)
    return merged


# ---------- stage 3: parse response into BQ-shaped dicts ----------


def bbox_from_vertices(verts) -> tuple[float, float, float, float] | None:
    """Convert Document AI normalized vertices to (x1, y1, x2, y2)."""
    if not verts:
        return None
    xs = [v.x for v in verts if v.x is not None]
    ys = [v.y for v in verts if v.y is not None]
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def text_for_anchor(anchor, full_text: str) -> str:
    if not anchor or not anchor.text_segments:
        return ""
    return "".join(
        full_text[seg.start_index : seg.end_index] for seg in anchor.text_segments
    )


def parse_document(
    item: QueueItem, gcs_pdf: str, gcs_response: str, doc: documentai.Document
) -> dict:
    full_text = doc.text or ""
    pages_out: list[dict] = []
    blocks_out: list[dict] = []
    tokens_out: list[dict] = []
    redactions_out: list[dict] = []

    doc_confidences: list[float] = []
    total_tokens = 0
    total_blocks = 0
    total_redactions = 0
    redaction_area_total = 0.0

    for p_idx, page in enumerate(doc.pages):
        page_num = p_idx + 1
        page_text = text_for_anchor(page.layout.text_anchor, full_text)
        # v2.1 processors stopped populating page.layout.confidence; the
        # signal moved to individual tokens. Average page.tokens[*].layout
        # .confidence and fall back to the page layout field for any
        # future version that re-populates it.
        token_confs = [
            t.layout.confidence
            for t in page.tokens
            if t.layout
            and t.layout.confidence is not None
            and t.layout.confidence > 0
        ]
        if token_confs:
            page_conf = sum(token_confs) / len(token_confs)
        else:
            page_conf = page.layout.confidence or 0.0
        doc_confidences.append(page_conf)
        ar = alpha_ratio(page_text)

        redaction_count = 0
        page_redaction_area = 0.0
        for vis in getattr(page, "visual_elements", []):
            vtype = getattr(vis.type_, "name", str(vis.type_)) if hasattr(vis, "type_") else ""
            if "redaction" in str(vtype).lower() or "black" in str(vtype).lower():
                bbox = bbox_from_vertices(
                    vis.layout.bounding_poly.normalized_vertices
                    if vis.layout.bounding_poly
                    else None
                )
                if not bbox:
                    continue
                x1, y1, x2, y2 = bbox
                area = max(0.0, (x2 - x1) * (y2 - y1))
                redactions_out.append(
                    {
                        "document_id": item.document_id,
                        "page_num": page_num,
                        "redaction_id": f"{item.document_id}-p{page_num}-r{redaction_count}",
                        "bbox_x1": x1,
                        "bbox_y1": y1,
                        "bbox_x2": x2,
                        "bbox_y2": y2,
                        "area_pct": area * 100.0,
                        "detection_method": "docai_visual_element",
                        "confidence": vis.layout.confidence,
                        "nearby_text_before": None,
                        "nearby_text_after": None,
                    }
                )
                redaction_count += 1
                page_redaction_area += area

        total_redactions += redaction_count
        redaction_area_total += page_redaction_area

        block_count = 0
        paragraph_count = len(page.paragraphs)
        line_count = len(page.lines)
        token_count = len(page.tokens)
        total_tokens += token_count

        for b_idx, block in enumerate(page.blocks):
            block_text = text_for_anchor(block.layout.text_anchor, full_text)
            bbox = bbox_from_vertices(
                block.layout.bounding_poly.normalized_vertices
                if block.layout.bounding_poly
                else None
            )
            if not bbox:
                continue
            x1, y1, x2, y2 = bbox
            classification = detect_classification(block_text)
            block_id = f"{item.document_id}-p{page_num}-b{b_idx}"

            blocks_out.append(
                {
                    "document_id": item.document_id,
                    "page_num": page_num,
                    "block_id": block_id,
                    "block_type": "paragraph",
                    "reading_order": b_idx,
                    "text": block_text,
                    "confidence": block.layout.confidence,
                    "bbox_x1": x1,
                    "bbox_y1": y1,
                    "bbox_x2": x2,
                    "bbox_y2": y2,
                    "bbox_area_pct": (x2 - x1) * (y2 - y1) * 100.0,
                    "is_classification_marking": classification is not None,
                    "classification_text": classification,
                }
            )
            block_count += 1
            total_blocks += 1

        for t_idx, tok in enumerate(page.tokens):
            tbbox = bbox_from_vertices(
                tok.layout.bounding_poly.normalized_vertices
                if tok.layout.bounding_poly
                else None
            )
            if not tbbox:
                continue
            brk = None
            if tok.detected_break:
                brk_type = tok.detected_break.type_
                brk = brk_type.name if hasattr(brk_type, "name") else str(brk_type)
            tokens_out.append(
                {
                    "document_id": item.document_id,
                    "page_num": page_num,
                    "block_id": None,
                    "token_index": t_idx,
                    "text": text_for_anchor(tok.layout.text_anchor, full_text),
                    "confidence": tok.layout.confidence,
                    "bbox_x1": tbbox[0],
                    "bbox_y1": tbbox[1],
                    "bbox_x2": tbbox[2],
                    "bbox_y2": tbbox[3],
                    "detected_break": brk,
                }
            )

        pages_out.append(
            {
                "document_id": item.document_id,
                "page_num": page_num,
                "page_label": f"p. {page_num}",
                "width": page.dimension.width if page.dimension else None,
                "height": page.dimension.height if page.dimension else None,
                "unit": page.dimension.unit if page.dimension else None,
                "rotation_degrees": 0,
                "page_confidence": page_conf,
                "block_count": block_count,
                "paragraph_count": paragraph_count,
                "token_count": token_count,
                "line_count": line_count,
                "has_tables": len(page.tables) > 0,
                "has_form_fields": len(page.form_fields) > 0,
                "redaction_count": redaction_count,
                "redaction_area_pct": page_redaction_area * 100.0,
                "alpha_ratio": ar,
                "quality_band": quality_band(ar),
                "page_text": page_text,
            }
        )

    mean_conf = sum(doc_confidences) / len(doc_confidences) if doc_confidences else 0.0
    mean_ar = (
        sum(p["alpha_ratio"] for p in pages_out) / len(pages_out) if pages_out else 0.0
    )
    num_pages = len(pages_out)

    doc_row = {
        "document_id": item.document_id,
        "release_set": item.release_set,
        "gcs_pdf_uri": gcs_pdf,
        "gcs_response_uri": gcs_response,
        "processor_id": DOCAI_PROCESSOR_ID,
        "processor_version": DOCAI_PROCESSOR_VERSION,
        "num_pages": num_pages,
        "mean_page_confidence": mean_conf,
        "mean_alpha_ratio": mean_ar,
        "ocr_quality_band": quality_band(mean_ar),
        "total_tokens": total_tokens,
        "total_blocks": total_blocks,
        "has_tables": any(p["has_tables"] for p in pages_out),
        "has_forms": any(p["has_form_fields"] for p in pages_out),
        "has_redactions": total_redactions > 0,
        "redaction_area_pct": (redaction_area_total / num_pages * 100.0)
        if num_pages
        else 0.0,
        "processing_status": "loaded",
        "error_message": None,
        "processed_at": now().isoformat(),
        "loaded_at": now().isoformat(),
    }

    return {
        "document": doc_row,
        "pages": pages_out,
        "blocks": blocks_out,
        "tokens": tokens_out,
        "redactions": redactions_out,
    }


# ---------- stage 4: chunker ----------


def chunk_pages(item: QueueItem, parsed: dict) -> list[dict]:
    """Greedy chunker: concat page_text across pages, break at ~1000 chars,
    keep 100-char overlap, attach bbox union from contributing blocks."""
    pages = parsed["pages"]
    blocks = parsed["blocks"]
    blocks_by_page: dict[int, list[dict]] = {}
    for b in blocks:
        blocks_by_page.setdefault(b["page_num"], []).append(b)

    chunks: list[dict] = []
    buffer = ""
    buffer_pages: list[int] = []
    buffer_blocks: list[str] = []
    buffer_conf: list[float] = []
    chunk_order = 0

    def flush():
        nonlocal chunk_order, buffer, buffer_pages, buffer_blocks, buffer_conf
        if not buffer.strip():
            buffer = ""
            buffer_pages = []
            buffer_blocks = []
            buffer_conf = []
            return
        pn_start = min(buffer_pages) if buffer_pages else None
        pn_end = max(buffer_pages) if buffer_pages else None
        text_to_write = buffer.strip()
        chunks.append(
            {
                "chunk_id": f"{item.document_id}-{chunk_order}-docai_ocr",
                "document_id": item.document_id,
                "naid": None,
                "chunk_order": chunk_order,
                "chunk_text": text_to_write,
                "chunk_chars": len(text_to_write),
                "token_estimate": int(len(text_to_write) / 4),
                "page_label": f"p. {pn_start}" if pn_start else None,
                "page_num_start": pn_start,
                "page_num_end": pn_end,
                "source_type": "docai_ocr",
                "ocr_engine": f"docai/{DOCAI_PROCESSOR_VERSION}",
                "mean_confidence": sum(buffer_conf) / len(buffer_conf)
                if buffer_conf
                else None,
                "alpha_ratio": alpha_ratio(text_to_write),
                "block_ids": buffer_blocks.copy(),
                "bbox_union_x1": None,
                "bbox_union_y1": None,
                "bbox_union_x2": None,
                "bbox_union_y2": None,
                "contains_redaction": False,
                "contains_handwriting": False,
                "created_at": now().isoformat(),
            }
        )
        chunk_order += 1
        # Overlap
        overlap = buffer[-CHUNK_OVERLAP_CHARS:] if CHUNK_OVERLAP_CHARS else ""
        buffer = overlap
        buffer_pages = []
        buffer_blocks = []
        buffer_conf = []

    for page in pages:
        pn = page["page_num"]
        for b in blocks_by_page.get(pn, []):
            add = (b["text"] or "").strip()
            if not add:
                continue
            if len(buffer) + len(add) + 1 > CHUNK_TARGET_CHARS and buffer:
                flush()
            buffer += ("\n" if buffer else "") + add
            buffer_pages.append(pn)
            buffer_blocks.append(b["block_id"])
            if b["confidence"] is not None:
                buffer_conf.append(b["confidence"])
    flush()
    return chunks


# ---------- stage 5: load to BQ ----------


def insert_rows(table: str, rows: list[dict]) -> None:
    if not rows:
        return
    errors = bq.insert_rows_json(f"{STAGING}.{table}", rows)
    if errors:
        raise RuntimeError(f"BQ insert errors on {table}: {errors}")


def load_parsed(parsed: dict, chunks: list[dict]) -> None:
    insert_rows("docai_documents", [parsed["document"]])
    insert_rows("docai_pages", parsed["pages"])
    insert_rows("docai_blocks", parsed["blocks"])
    insert_rows("docai_tokens", parsed["tokens"])
    insert_rows("docai_redactions", parsed["redactions"])
    insert_rows("docai_text_chunks", chunks)


# ---------- orchestrator ----------


def process_one(item: QueueItem) -> None:
    """Single-doc orchestration for sync mode.

    State transitions written to release_text_versions via rtv_stage:
    - on fetch ok:    fetch_status='fetched' + sha256/byte_size/gcs_pdf_uri/fetched_at
    - on fetch fail:  fetch_status='failed' + fetch_error
    - on ocr ok:      docai_status='complete' + gcs_docai_uri/mean_page_conf/page_count
    - on ocr fail:    docai_status='failed' + docai_error
    """
    try:
        gcs_pdf, nbytes, sha = fetch_pdf(item)
    except Exception as e:
        log.exception("fetch failed: %s", item.document_id)
        log_step(
            item.document_id,
            item.release_set,
            "fetch",
            "error",
            error_class=type(e).__name__,
            error_message=str(e)[:500],
        )
        rtv_stage(
            item.document_id,
            item.release_set,
            fetch_status="failed",
            fetch_error=f"{type(e).__name__}: {str(e)[:400]}",
        )
        return

    rtv_stage(
        item.document_id,
        item.release_set,
        fetch_status="fetched",
        gcs_pdf_uri=gcs_pdf,
        pdf_sha256=sha,
        byte_size=nbytes,
        fetched_at=now().isoformat(),
        source_pdf_url=item.pdf_url,
        docai_status="running",
    )

    gcs_response = gcs_docai_merged_uri(item.document_id, item.release_set)

    try:
        doc = run_docai(gcs_pdf, item.document_id, item.release_set)
    except Exception as e:
        log.exception("docai failed: %s", item.document_id)
        log_step(
            item.document_id,
            item.release_set,
            "ocr_request",
            "error",
            error_class=type(e).__name__,
            error_message=str(e)[:500],
        )
        rtv_stage(
            item.document_id,
            item.release_set,
            docai_status="failed",
            docai_error=f"{type(e).__name__}: {str(e)[:400]}",
        )
        return

    # Persist canonical merged response (sync mode = single shard, no merge needed).
    try:
        merged_bucket, merged_blob = _split_gcs_uri(gcs_response)
        gcs.bucket(merged_bucket).blob(merged_blob).upload_from_string(
            documentai.Document.to_json(doc), content_type="application/json"
        )
    except Exception:
        log.exception("could not persist docai merged.json for %s", item.document_id)

    parsed = parse_document(item, gcs_pdf, gcs_response, doc)
    chunks = chunk_pages(item, parsed)

    try:
        load_parsed(parsed, chunks)
        log_step(
            item.document_id,
            item.release_set,
            "load",
            "ok",
            bytes=nbytes,
            sha256=sha,
        )
        rtv_stage(
            item.document_id,
            item.release_set,
            docai_status="complete",
            gcs_docai_uri=gcs_response,
            mean_page_conf=parsed["document"]["mean_page_confidence"],
            page_count=parsed["document"]["num_pages"],
        )
        log.info(
            "loaded %s | pages=%d chunks=%d conf=%.2f ar=%.2f",
            item.document_id,
            parsed["document"]["num_pages"],
            len(chunks),
            parsed["document"]["mean_page_confidence"],
            parsed["document"]["mean_alpha_ratio"],
        )
    except Exception as e:
        log.exception("load failed: %s", item.document_id)
        log_step(
            item.document_id,
            item.release_set,
            "load",
            "error",
            error_class=type(e).__name__,
            error_message=str(e)[:500],
        )
        rtv_stage(
            item.document_id,
            item.release_set,
            docai_status="failed",
            docai_error=f"{type(e).__name__}: {str(e)[:400]}",
        )


def _split_gcs_uri(uri: str) -> tuple[str, str]:
    """gs://bucket/path/to/blob → (bucket, path/to/blob)"""
    parts = uri.removeprefix("gs://").split("/", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def _fetch_pdf_with_rtv(item: QueueItem) -> tuple[str, int, str] | None:
    """fetch_pdf wrapper that writes rtv state on success or failure."""
    try:
        uri, nbytes, sha = fetch_pdf(item)
    except Exception as e:
        log.exception("fetch failed: %s", item.document_id)
        log_step(
            item.document_id, item.release_set, "fetch", "error",
            error_class=type(e).__name__, error_message=str(e)[:500],
        )
        rtv_stage(
            item.document_id, item.release_set,
            fetch_status="failed",
            fetch_error=f"{type(e).__name__}: {str(e)[:400]}",
        )
        return None
    rtv_stage(
        item.document_id, item.release_set,
        fetch_status="fetched",
        gcs_pdf_uri=uri, pdf_sha256=sha, byte_size=nbytes,
        fetched_at=now().isoformat(), source_pdf_url=item.pdf_url,
    )
    return uri, nbytes, sha


def process_batch_group(items: list[QueueItem], run_id: str) -> None:
    """End-to-end batch-mode orchestrator: fetch → LRO → parse → load.

    Fetches run in parallel (PARALLEL_FETCH_WORKERS) since they're I/O
    bound on archives.gov. The DocAI LRO itself is one call regardless.
    """
    gcs_pdfs: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=PARALLEL_FETCH_WORKERS) as pool:
        futures = {pool.submit(_fetch_pdf_with_rtv, item): item for item in items}
        for fut in as_completed(futures):
            item = futures[fut]
            result = fut.result()
            if result is not None:
                gcs_pdfs[item.document_id] = result[0]
    if not gcs_pdfs:
        log.warning("no PDFs fetched; nothing to submit")
        return
    batchable = [i for i in items if i.document_id in gcs_pdfs]

    for item in batchable:
        rtv_stage(item.document_id, item.release_set,
                  docai_status="running", docai_run_id=run_id)

    try:
        outputs = run_docai_batch(batchable, gcs_pdfs, run_id)
    except Exception as e:
        log.exception("batch LRO failed")
        for item in batchable:
            log_step(
                item.document_id, item.release_set, "ocr_request", "error",
                error_class=type(e).__name__, error_message=str(e)[:500],
            )
            rtv_stage(item.document_id, item.release_set,
                      docai_status="failed",
                      docai_error=f"{type(e).__name__}: {str(e)[:400]}")
        return

    for item in batchable:
        out_prefix = outputs.get(item.document_id)
        if not out_prefix:
            log.warning("no output for %s", item.document_id)
            rtv_stage(item.document_id, item.release_set,
                      docai_status="failed", docai_error="no batch output")
            continue
        try:
            doc = _fetch_batch_outputs(out_prefix)
            merged_uri = gcs_docai_merged_uri(item.document_id, item.release_set)
            # Persist merged Document to the canonical by-naid path. Raw
            # shards remain at out_prefix (under batch/{run_id}/) — bucket
            # lifecycle moves them to coldline at 30d.
            merged_bucket, merged_blob = _split_gcs_uri(merged_uri)
            gcs.bucket(merged_bucket).blob(merged_blob).upload_from_string(
                documentai.Document.to_json(doc), content_type="application/json"
            )
            parsed = parse_document(item, gcs_pdfs[item.document_id], merged_uri, doc)
            chunks = chunk_pages(item, parsed)
            load_parsed(parsed, chunks)
            log_step(item.document_id, item.release_set, "load", "ok")
            rtv_stage(item.document_id, item.release_set,
                      docai_status="complete",
                      gcs_docai_uri=merged_uri,
                      mean_page_conf=parsed["document"]["mean_page_confidence"],
                      page_count=parsed["document"]["num_pages"])
            log.info(
                "loaded %s | pages=%d chunks=%d conf=%.2f",
                item.document_id,
                parsed["document"]["num_pages"],
                len(chunks),
                parsed["document"]["mean_page_confidence"],
            )
        except Exception as e:
            log.exception("parse/load failed: %s", item.document_id)
            log_step(
                item.document_id, item.release_set, "load", "error",
                error_class=type(e).__name__, error_message=str(e)[:500],
            )
            rtv_stage(item.document_id, item.release_set,
                      docai_status="failed",
                      docai_error=f"{type(e).__name__}: {str(e)[:400]}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="JFK Vault Document AI OCR ingest.",
    )
    p.add_argument(
        "--mode",
        choices=("sync", "batch"),
        default="sync",
        help="sync processDocument (≤30 pages) or batchProcess LRO (>30 pages)",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=PILOT_LIMIT,
        help="max docs to pull from the queue (default %(default)s)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="list queued docs + planned output paths; make NO API calls "
        "and write NO rows. Safe for wiring verification.",
    )
    p.add_argument(
        "--run-id",
        default=None,
        help="batch-mode run identifier; default is a UTC timestamp.",
    )
    p.add_argument(
        "--source",
        choices=("release_text_versions", "backfill_queue"),
        default="release_text_versions",
        help="queue source. Default reads pending rows from "
        "release_text_versions; legacy is the docai_backfill_queue view.",
    )
    p.add_argument(
        "--release-set",
        default=None,
        help="restrict the queue to a single release_set "
        "(e.g. 2021). Only honored with --source release_text_versions.",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.source == "release_text_versions":
        items = fetch_queue_v2(args.limit, mode=args.mode, release_set=args.release_set)
    else:
        if args.release_set:
            log.warning("--release-set is ignored with --source backfill_queue")
        items = fetch_queue(args.limit, mode=args.mode)
    log.info(
        "%s: %d docs queued (source=%s, limit=%d, release_set=%s, dry_run=%s)",
        args.mode,
        len(items),
        args.source,
        args.limit,
        args.release_set or "*",
        args.dry_run,
    )

    if args.dry_run:
        for i, item in enumerate(items, 1):
            log.info(
                "[dry-run %d/%d] %s (%s, %s pages) → %s",
                i,
                len(items),
                item.document_id,
                item.release_set,
                item.num_pages,
                gcs_pdf_uri(item.document_id, item.release_set),
            )
        if args.mode == "batch":
            run_id = args.run_id or now().strftime("%Y%m%dT%H%M%SZ")
            log.info(
                "[dry-run] batch shards would land at %s",
                _batch_output_prefix(run_id),
            )
        return

    if args.mode == "sync":
        for i, item in enumerate(items, 1):
            log.info(
                "[%d/%d] %s (%s, %s pages)",
                i,
                len(items),
                item.document_id,
                item.release_set,
                item.num_pages,
            )
            process_one(item)
    else:
        run_id = args.run_id or now().strftime("%Y%m%dT%H%M%SZ")
        process_batch_group(items, run_id)

    # Final flush of any buffered release_text_versions state updates.
    rtv_flush()


if __name__ == "__main__":
    main()
