-- 34_search_ocr_card_excerpts.sql
--
-- Purpose:
--   Thin OCR excerpt table for public /api/search cards and mention
--   excerpts. search_ocr_chunks is 143 MB in a single cluster block, so
--   even `document_id = @id` and literal IN lists bill ~128 MiB. This
--   table is one short excerpt per OCR document (~2k rows × ~500 chars
--   ≈ 1–2 MB). A full scan bills the on-demand 10 MiB minimum.
--
--   APPLY THIS FILE BEFORE merging / deploying the app change. Until it
--   exists, snippet/mention jobs degrade to title/description (no 500,
--   no fallback to search_ocr_chunks / jfk_text_chunks).
--
-- Dependencies:
--   - jfk_curated.jfk_text_chunks (sql/11 + sql/18)
--
-- Notes:
--   - No Vertex / no new GCP product.
--   - Excerpt is SUBSTR of the first OCR chunk (lowest chunk_order),
--     500 chars. Not query-specific; the card may not highlight the
--     typed term. Document totals / OCR-id hits are unchanged.
--   - /api/document full-page OCR still reads search_ocr_chunks (137 MiB
--     leak, out of scope for this file).

create or replace table `jfk-vault.jfk_curated.search_ocr_card_excerpts`
as
select
  document_id,
  chunk_id,
  chunk_order,
  page_label,
  substr(chunk_text, 1, 500) as excerpt
from `jfk-vault.jfk_curated.jfk_text_chunks`
where source_type in ('abbyy_ocr', 'docai_ocr')
qualify row_number() over (
  partition by document_id
  order by chunk_order, chunk_id
) = 1;
