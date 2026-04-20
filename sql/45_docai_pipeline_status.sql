-- sql/45 — Document AI pipeline status views.
--
-- Read-only DQ views over the docai_* staging tables. No side effects;
-- does not insert, update, or kick off any OCR processing.
--
-- Views:
--   docai_pipeline_summary      — single-row overall counters
--   docai_pipeline_by_release   — per-release progress + page-band
--                                 (sync-eligible ≤30 vs batch-needed >30)
--   docai_pipeline_errors       — last 200 errors from docai_processing_log

CREATE OR REPLACE VIEW `jfk-vault.jfk_staging.docai_pipeline_summary` AS
WITH q AS (
  SELECT
    COUNT(*)                                         AS queued_total,
    COUNTIF(num_pages BETWEEN 1 AND 30)              AS queued_sync_eligible,
    COUNTIF(num_pages > 30)                          AS queued_batch_needed
  FROM `jfk-vault.jfk_staging.docai_backfill_queue`
),
d AS (
  SELECT
    COUNT(*)                                              AS processed_total,
    COUNTIF(processing_status = 'loaded')                 AS processed_loaded,
    COUNTIF(processing_status != 'loaded')                AS processed_other,
    COUNTIF(mean_page_confidence < 0.70
            AND mean_page_confidence IS NOT NULL)         AS low_confidence_count,
    AVG(mean_page_confidence)                             AS mean_page_confidence_avg,
    AVG(mean_alpha_ratio)                                 AS mean_alpha_ratio_avg
  FROM `jfk-vault.jfk_staging.docai_documents`
)
SELECT
  q.queued_total,
  q.queued_sync_eligible,
  q.queued_batch_needed,
  d.processed_total,
  d.processed_loaded,
  d.processed_other,
  d.low_confidence_count,
  d.mean_page_confidence_avg,
  d.mean_alpha_ratio_avg,
  SAFE_DIVIDE(d.processed_loaded, d.processed_loaded + q.queued_total)
    AS fraction_complete
FROM q, d;

CREATE OR REPLACE VIEW `jfk-vault.jfk_staging.docai_pipeline_by_release` AS
WITH by_release_queue AS (
  SELECT
    release_set,
    COUNT(*)                             AS queued_docs,
    COUNTIF(num_pages BETWEEN 1 AND 30)  AS queued_sync_eligible,
    COUNTIF(num_pages > 30)              AS queued_batch_needed,
    AVG(num_pages)                       AS queued_mean_pages,
    MAX(num_pages)                       AS queued_max_pages
  FROM `jfk-vault.jfk_staging.docai_backfill_queue`
  GROUP BY release_set
),
by_release_processed AS (
  SELECT
    release_set,
    COUNT(*)                                                AS processed_docs,
    COUNTIF(processing_status = 'loaded')                   AS processed_loaded,
    AVG(mean_page_confidence)                               AS mean_page_confidence_avg,
    AVG(mean_alpha_ratio)                                   AS mean_alpha_ratio_avg,
    COUNTIF(mean_page_confidence < 0.70
            AND mean_page_confidence IS NOT NULL)           AS low_confidence_count,
    COUNTIF(has_redactions)                                 AS has_redactions_count
  FROM `jfk-vault.jfk_staging.docai_documents`
  GROUP BY release_set
)
SELECT
  COALESCE(q.release_set, p.release_set) AS release_set,
  COALESCE(q.queued_docs,           0)   AS queued_docs,
  COALESCE(q.queued_sync_eligible,  0)   AS queued_sync_eligible,
  COALESCE(q.queued_batch_needed,   0)   AS queued_batch_needed,
  q.queued_mean_pages,
  q.queued_max_pages,
  COALESCE(p.processed_docs,        0)   AS processed_docs,
  COALESCE(p.processed_loaded,      0)   AS processed_loaded,
  p.mean_page_confidence_avg,
  p.mean_alpha_ratio_avg,
  COALESCE(p.low_confidence_count,  0)   AS low_confidence_count,
  COALESCE(p.has_redactions_count,  0)   AS has_redactions_count
FROM by_release_queue q
FULL OUTER JOIN by_release_processed p USING (release_set)
ORDER BY release_set;

CREATE OR REPLACE VIEW `jfk-vault.jfk_staging.docai_pipeline_errors` AS
SELECT
  document_id,
  release_set,
  step,
  status,
  processor_version,
  error_class,
  error_message,
  event_at
FROM `jfk-vault.jfk_staging.docai_processing_log`
WHERE status = 'error'
ORDER BY event_at DESC
LIMIT 200;
