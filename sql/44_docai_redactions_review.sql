-- sql/44 — Redaction review workflow schema.
--
-- Adds human-in-the-loop review columns to jfk_staging.docai_redactions and
-- creates the jfk_staging.docai_review_queue view the /admin/redactions UI
-- reads from. One-shot migration; re-running the ALTERs is idempotent via
-- IF NOT EXISTS.
--
-- Prereq: jfk_staging.docai_redactions table already exists.

-- Review columns. docai_redactions was originally shaped for DocAI output,
-- but we also write pil_black_rect detections into it; review_status is the
-- unified workflow state either way.
ALTER TABLE `jfk-vault.jfk_staging.docai_redactions`
  ADD COLUMN IF NOT EXISTS review_status STRING,
  ADD COLUMN IF NOT EXISTS reviewed_by   STRING,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewer_notes STRING;

-- Default new rows to 'unreviewed' at insert time — API inserts do this.
-- For any pre-existing rows (DocAI run), backfill once.
UPDATE `jfk-vault.jfk_staging.docai_redactions`
SET review_status = 'unreviewed'
WHERE review_status IS NULL;

-- Per-document aggregate: one row per document_id, ranked by how much human
-- attention the doc needs. The UI reads this to build the queue.
CREATE OR REPLACE VIEW `jfk-vault.jfk_staging.docai_review_queue` AS
WITH per_doc AS (
  SELECT
    document_id,
    COUNT(*) AS total_detections,
    COUNTIF(review_status = 'unreviewed')    AS unreviewed_count,
    COUNTIF(review_status = 'confirmed')     AS confirmed_count,
    COUNTIF(review_status = 'rejected')      AS rejected_count,
    COUNTIF(review_status = 'auto_confirmed') AS auto_count,
    MIN(page_num) AS first_page,
    MAX(page_num) AS last_page,
    -- mean extent is the best proxy we have for per-doc detection quality
    AVG(confidence) AS mean_confidence,
    -- max per-detection area, useful for "how redacted is this doc"
    MAX(area_pct) AS max_area_pct,
    MAX(detection_method) AS detection_method
  FROM `jfk-vault.jfk_staging.docai_redactions`
  GROUP BY document_id
),
doc_meta AS (
  -- Join richer metadata when available. docai_documents may not have every
  -- redacted doc yet (we seed the queue ahead of full OCR); LEFT JOIN so
  -- orphaned-but-detected docs still surface.
  SELECT
    d.document_id,
    d.num_pages,
    d.release_set,
    d.mean_alpha_ratio,
    d.ocr_quality_band
  FROM `jfk-vault.jfk_staging.docai_documents` d
),
curated AS (
  SELECT
    r.document_id,
    r.title,
    r.agency,
    r.release_set AS curated_release_set,
    r.num_pages   AS curated_num_pages
  FROM `jfk-vault.jfk_curated.jfk_records` r
)
SELECT
  p.document_id,
  p.total_detections,
  p.unreviewed_count,
  p.confirmed_count,
  p.rejected_count,
  p.auto_count,
  p.first_page,
  p.last_page,
  p.mean_confidence,
  p.max_area_pct,
  p.detection_method,
  -- metadata: prefer docai_documents (fresh OCR pass), fall back to curated.
  COALESCE(m.num_pages,  c.curated_num_pages) AS num_pages,
  COALESCE(m.release_set, c.curated_release_set) AS release_set,
  c.title,
  c.agency,
  m.mean_alpha_ratio,
  m.ocr_quality_band,
  -- priority: more unreviewed detections first, more total detections as
  -- tiebreaker. High-priority = more work left + more evidence the doc
  -- actually has redactions worth examining.
  (p.unreviewed_count * 10 + p.total_detections) AS review_priority
FROM per_doc p
LEFT JOIN doc_meta m USING (document_id)
LEFT JOIN curated  c USING (document_id)
WHERE p.unreviewed_count > 0;
