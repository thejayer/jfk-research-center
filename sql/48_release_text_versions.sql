-- sql/48 — Release-text versions tracking table.
--
-- One row per (NAID × release_set) capturing where the PDF lives in GCS,
-- where the DocAI OCR output lives, and the orchestration state of the
-- fetch + OCR pipeline. Persists across warehouse rebuilds (it is NOT
-- recreated by sql/10a and is NOT a step in rebuild_warehouse.sh).
--
-- Relationship to jfk_curated.document_versions:
--   document_versions      → source-of-truth for "which (NAID, release)
--                            pairs exist", rebuilt from nara_manifest +
--                            abbyy_documents on every warehouse rebuild.
--   release_text_versions  → pipeline state for "have we fetched this PDF
--                            and OCR'd it, and where does it live now."
--                            Mutable, append/upsert-only.
--
-- Same primary key (document_id, release_set) — joinable for the eventual
-- 5-B public redaction-diff UI, which needs both halves: the fact that the
-- version exists (document_versions) and the OCR text bytes to diff
-- (release_text_versions → gcs_docai_uri).
--
-- This file is run-once. Re-running is a no-op via IF NOT EXISTS so the
-- table is never truncated by accident.

CREATE TABLE IF NOT EXISTS `jfk-vault.jfk_curated.release_text_versions` (
  document_id     STRING  NOT NULL,   -- NAID, matches document_versions.document_id
  release_set     STRING  NOT NULL,   -- '2017-2018' | '2021' | '2022' | '2023' | '2025'

  -- PDF acquisition
  source_pdf_url  STRING,             -- archives.gov URL actually fetched
  gcs_pdf_uri     STRING,             -- gs://jfk-vault-pdfs/by-naid/{naid}/{release}/document.pdf
  pdf_sha256      STRING,             -- sha256 of the bytes we wrote to GCS
  byte_size       INT64,              -- size of the PDF in bytes
  page_count      INT64,              -- pages observed in the actual PDF (may differ from manifest)
  fetched_at      TIMESTAMP,
  fetch_status    STRING,             -- pending | fetched | failed
  fetch_error     STRING,             -- nullable, populated on failure

  -- DocAI processing
  docai_status    STRING,             -- pending | running | complete | failed | skipped
  docai_run_id    STRING,             -- correlates with jfk_staging.docai_processing_log.run_id
  gcs_docai_uri   STRING,             -- gs://jfk-vault-ocr/by-naid/{naid}/{release}/docai/merged.json
  mean_page_conf  FLOAT64,            -- post-OCR confidence summary (parsed from DocAI tokens)
  docai_error     STRING,             -- nullable, populated on failure

  updated_at      TIMESTAMP NOT NULL,  -- caller sets to CURRENT_TIMESTAMP() on every write

  PRIMARY KEY (document_id, release_set) NOT ENFORCED
)
CLUSTER BY document_id, release_set;
