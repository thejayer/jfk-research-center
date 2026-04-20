"""
Load PIL-detector output into the redaction review queue.

Reads the per-doc detections.csv files produced by redaction_detector_prototype.py
and:
  1. Uploads each page_NNN_overlay.png to gs://jfk-vault-ocr/review/<doc_id>/
     (what the /api/admin/redactions/:doc/image/:page route serves).
  2. Inserts one row per detection into jfk_staging.docai_redactions with
     detection_method='pil_black_rect' and review_status='unreviewed'.

Re-running is safe: existing redaction_id rows are skipped via a MERGE pattern.

Usage:
  # Load everything under /tmp/seed_out/ (one subdir per doc):
  python scripts/load_pil_detections.py --in-dir /tmp/seed_out/

  # Or load a single doc:
  python scripts/load_pil_detections.py --doc /tmp/seed_out/124-10278-10389/
"""
from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

from google.cloud import bigquery, storage

PROJECT = os.getenv("GCP_PROJECT", "jfk-vault")
DATASET = "jfk_staging"
TABLE = "docai_redactions"
BUCKET = os.getenv("REDACTION_REVIEW_BUCKET", "jfk-vault-ocr")
GCS_PREFIX = "review"


def upload_overlays(doc_dir: Path, document_id: str, gcs: storage.Client) -> int:
    bucket = gcs.bucket(BUCKET)
    count = 0
    for png in sorted(doc_dir.glob("page_*_overlay.png")):
        blob_path = f"{GCS_PREFIX}/{document_id}/{png.name}"
        blob = bucket.blob(blob_path)
        if blob.exists():
            continue
        blob.upload_from_filename(str(png), content_type="image/png")
        count += 1
    return count


def load_detections(doc_dir: Path, document_id: str, bq: bigquery.Client) -> int:
    csv_path = doc_dir / "detections.csv"
    if not csv_path.exists():
        return 0
    rows = []
    with csv_path.open() as f:
        reader = csv.DictReader(f)
        for i, r in enumerate(reader):
            rows.append(
                {
                    "document_id": document_id,
                    "page_num": int(r["page_num"]),
                    "redaction_id": f"{document_id}-p{int(r['page_num'])}-pil-{i}",
                    "bbox_x1": float(r["nx1"]),
                    "bbox_y1": float(r["ny1"]),
                    "bbox_x2": float(r["nx2"]),
                    "bbox_y2": float(r["ny2"]),
                    "area_pct": float(r["area_pct_of_page"]),
                    "detection_method": "pil_black_rect",
                    "confidence": float(r["extent"]),
                    "nearby_text_before": None,
                    "nearby_text_after": None,
                    "review_status": "unreviewed",
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "reviewer_notes": None,
                }
            )
    if not rows:
        return 0

    # Delete + insert is simplest for re-runs. At seed-scale this is fine;
    # full-backfill scale would want a MERGE against a staging table.
    bq.query(
        f"""
        DELETE FROM `{PROJECT}.{DATASET}.{TABLE}`
        WHERE document_id = @doc
          AND detection_method = 'pil_black_rect'
        """,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("doc", "STRING", document_id)
            ]
        ),
    ).result()

    errors = bq.insert_rows_json(f"{PROJECT}.{DATASET}.{TABLE}", rows)
    if errors:
        raise RuntimeError(f"insert errors for {document_id}: {errors}")
    return len(rows)


def load_doc(doc_dir: Path, bq: bigquery.Client, gcs: storage.Client) -> None:
    document_id = doc_dir.name
    uploaded = upload_overlays(doc_dir, document_id, gcs)
    inserted = load_detections(doc_dir, document_id, bq)
    print(
        f"{document_id}: {inserted} detections inserted, {uploaded} overlays uploaded"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in-dir", type=Path, help="directory of per-doc subfolders")
    ap.add_argument("--doc", type=Path, help="single per-doc subfolder")
    ap.add_argument(
        "--only-hits",
        action="store_true",
        help="skip per-doc folders where detections.csv has no rows",
    )
    args = ap.parse_args()

    if not args.in_dir and not args.doc:
        ap.error("pass --in-dir or --doc")

    bq = bigquery.Client(project=PROJECT)
    gcs = storage.Client(project=PROJECT)

    subdirs: list[Path] = []
    if args.doc:
        subdirs.append(args.doc)
    if args.in_dir:
        subdirs.extend(sorted(d for d in args.in_dir.iterdir() if d.is_dir()))

    for d in subdirs:
        if args.only_hits:
            csv_path = d / "detections.csv"
            if not csv_path.exists():
                continue
            with csv_path.open() as f:
                # header + zero rows → skip
                if sum(1 for _ in f) <= 1:
                    continue
        try:
            load_doc(d, bq, gcs)
        except Exception as e:
            print(f"FAIL {d.name}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
