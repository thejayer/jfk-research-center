-- sql/47 — timeline_event_documents join table.
--
-- Curated many-to-many mapping from timeline_events.event_id →
-- jfk_records.document_id so /timeline can surface canonical source
-- documents per event ("open this event's record" rather than only
-- "open this event's related entity / external source URL").
--
-- sort_order lets curators pin the most-authoritative doc first.
-- note is optional editorial commentary (e.g. "full text at pp. 4–9").
--
-- Seed scope is deliberately conservative: only the 3 primary-source
-- reports already in jfk_records (document_ids starting with ps-).
-- Expanding to per-event NAIDs is a curation task, not engineering,
-- and belongs in later waves.

CREATE TABLE IF NOT EXISTS `jfk-vault.jfk_curated.timeline_event_documents` (
  event_id     STRING NOT NULL,
  document_id  STRING NOT NULL,
  sort_order   INT64 NOT NULL,
  note         STRING,
  PRIMARY KEY (event_id, document_id) NOT ENFORCED
);

MERGE `jfk-vault.jfk_curated.timeline_event_documents` t
USING (
  SELECT 'tl-1964-09-24-wc-report'   AS event_id, 'ps-warren-report'  AS document_id, 1 AS sort_order, CAST(NULL AS STRING) AS note
  UNION ALL SELECT 'tl-1998-09-30-arrb-report', 'ps-arrb-report',   1, NULL
  UNION ALL SELECT 'tl-1976-04-23-church-report','ps-church-book-v', 1, 'Book V of the Church Committee Final Report.'
) src
ON t.event_id = src.event_id AND t.document_id = src.document_id
WHEN NOT MATCHED THEN
  INSERT (event_id, document_id, sort_order, note)
  VALUES (src.event_id, src.document_id, src.sort_order, src.note);
