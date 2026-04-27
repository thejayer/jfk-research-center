-- sql/49 — Seed release_text_versions for the corpus OCR backlog.
--
-- Inserts one row per (document_id, release_set) for every backlog
-- doc-version present in document_versions across the four NARA-XLSX
-- releases (2017-2018 / 2021 / 2022 / 2023). Skips rows already
-- present in release_text_versions (the 20 smoke-test rows seeded
-- 2026-04-27 via direct INSERT, plus anything a partial run has
-- already populated).
--
-- All seeded rows start at fetch_status='pending', docai_status='pending'.
-- The orchestration script (extended jfk_docai_ingest.py) drives state
-- transitions from there.
--
-- Pre-2017 releases (1992 / 1993 / 1994) are NOT in nara_manifest, so
-- they are not seeded. 2025 is punted — it has no manifest pdf_url and
-- needs a separate acquisition path; will be added later.
--
-- Run-once-ish: idempotent via the LEFT JOIN guard, so re-running after
-- partial progress is safe (won't reset in-flight rows).

INSERT INTO `jfk-vault.jfk_curated.release_text_versions` (
  document_id,
  release_set,
  source_pdf_url,
  fetch_status,
  docai_status,
  updated_at
)
SELECT
  dv.document_id,
  dv.release_set,
  dv.pdf_url      AS source_pdf_url,
  'pending'       AS fetch_status,
  'pending'       AS docai_status,
  CURRENT_TIMESTAMP() AS updated_at
FROM `jfk-vault.jfk_curated.document_versions` dv
LEFT JOIN `jfk-vault.jfk_curated.release_text_versions` rtv
  USING (document_id, release_set)
WHERE rtv.document_id IS NULL
  AND dv.release_set IN ('2017-2018', '2021', '2022', '2023')
  AND dv.pdf_url IS NOT NULL
  AND dv.pdf_url != '';
