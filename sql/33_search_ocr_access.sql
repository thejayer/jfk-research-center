-- 33_search_ocr_access.sql
--
-- Purpose:
--   Cheap access path for public /api/search so a typical query does not
--   scan jfk_text_chunks.chunk_text (the fat OCR column) twice per request.
--
--   search_ocr_document_tokens
--     One row per (token, document_id) extracted from OCR chunks.
--     CLUSTER BY token so `token >= 'oswald' AND token < 'oswale'` reads
--     one cluster, not the whole OCR corpus.
--
--   search_ocr_chunks
--     OCR-only projection of jfk_text_chunks (no description-fallback
--     rows, no unused columns). CLUSTER BY document_id so mention excerpts
--     and /api/document page reads only touch that document's blocks.
--
-- Dependencies:
--   - jfk_curated.jfk_text_chunks (sql/11 + sql/18)
--
-- Notes:
--   - No Vertex / no new GCP product. Storage is a second copy of OCR
--     tokens + OCR chunk bodies already in curated.
--   - CREATE OR REPLACE so a warehouse rebuild refreshes tokens after
--     new OCR lands. Cheap relative to a LIKE scan on every search.
--   - Token regex must stay in lockstep with lib/search-tokens.ts:
--     lowercase [a-z0-9]{3,}.

create or replace table `jfk-vault.jfk_curated.search_ocr_document_tokens`
cluster by token
as
select
  token,
  document_id
from (
  select
    document_id,
    token
  from `jfk-vault.jfk_curated.jfk_text_chunks`,
  unnest(regexp_extract_all(lower(chunk_text), r'[a-z0-9]{3,}')) as token
  where source_type in ('abbyy_ocr', 'docai_ocr')
)
group by token, document_id;

create or replace table `jfk-vault.jfk_curated.search_ocr_chunks`
cluster by document_id
as
select
  document_id,
  chunk_id,
  chunk_order,
  chunk_text,
  page_label,
  source_type
from `jfk-vault.jfk_curated.jfk_text_chunks`
where source_type in ('abbyy_ocr', 'docai_ocr');
