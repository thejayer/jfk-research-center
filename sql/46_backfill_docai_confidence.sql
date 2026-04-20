-- sql/46 — Backfill docai_pages.page_confidence and
-- docai_documents.mean_page_confidence for docs loaded before the
-- v2.1 parser fix (scripts/jfk_docai_ingest.py::parse_document,
-- shipped 2026-04-20).
--
-- Source of truth: docai_tokens.confidence. The ingest script wrote
-- per-token confidence correctly all along; only the page-level
-- aggregation in Python was broken (v2.1 dropped page.layout.confidence).
--
-- Safe to re-run: UPDATEs are deterministic given the tokens table.

-- Per-page: set page_confidence to the token-avg for that page.
UPDATE `jfk-vault.jfk_staging.docai_pages` p
SET page_confidence = t.conf
FROM (
  SELECT document_id, page_num, AVG(confidence) AS conf
  FROM `jfk-vault.jfk_staging.docai_tokens`
  WHERE confidence IS NOT NULL AND confidence > 0
  GROUP BY document_id, page_num
) t
WHERE p.document_id = t.document_id
  AND p.page_num    = t.page_num;

-- Per-doc: mean across the (now-corrected) page_confidence values.
UPDATE `jfk-vault.jfk_staging.docai_documents` d
SET mean_page_confidence = p.conf
FROM (
  SELECT document_id, AVG(page_confidence) AS conf
  FROM `jfk-vault.jfk_staging.docai_pages`
  WHERE page_confidence IS NOT NULL AND page_confidence > 0
  GROUP BY document_id
) p
WHERE d.document_id = p.document_id;
