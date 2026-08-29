-- 35_search_ocr_pages.sql
--
-- Purpose:
--   Cheap page-at-a-time OCR body for /api/document. search_ocr_chunks is
--   143 MB in a single cluster block, so `document_id = @id` still bills
--   ~137 MiB. This file splits the same OCR bodies across 256 integer
--   partitions so one page fetch can prune to ~0.5 MB of text and bill
--   the on-demand 10 MiB floor.
--
--   APPLY THIS FILE BEFORE merging / deploying the app change. Until it
--   exists, the document reader keeps has_ocr honest and says the
--   transcript is temporarily unavailable (no 500, no 500-char card
--   excerpt as the body, no fallback to search_ocr_chunks / jfk_text_chunks).
--
-- Tables:
--   search_ocr_page_meta
--     One row per OCR document. No chunk_text. CLUSTER BY document_id.
--     App reads shard + chunk bounds here, then queries one page.
--
--   search_ocr_pages
--     Full OCR chunk_text, PARTITION BY doc_shard (0-255),
--     CLUSTER BY document_id, chunk_order,
--     require_partition_filter = TRUE.
--     Queries MUST filter doc_shard with a parameter/literal. Computing
--     the shard only as MOD(FARM_FINGERPRINT(@id)) in the same WHERE
--     clause is not a reliable prune — the app passes @shard from meta.
--
-- Dependencies:
--   - jfk_curated.jfk_text_chunks (sql/11 + sql/18)
--
-- Notes:
--   - Source is abbyy_ocr + docai_ocr only (same as sql/33 and sql/34).
--     Description-fallback rows are not a document-page transcript.
--   - No Vertex / no new GCP product / no BI Engine.
--   - Search cards stay on search_ocr_card_excerpts (sql/34). Do not
--     point /api/search at these tables.
--   - One-time CREATE scans chunk_text once. Runtime reads do not.

create or replace table `jfk-vault.jfk_curated.search_ocr_page_meta`
cluster by document_id
as
select
  document_id,
  count(*) as chunk_count,
  min(chunk_order) as first_chunk_order,
  max(chunk_order) as last_chunk_order,
  mod(abs(farm_fingerprint(document_id)), 256) as doc_shard
from `jfk-vault.jfk_curated.jfk_text_chunks`
where source_type in ('abbyy_ocr', 'docai_ocr')
group by document_id;

create or replace table `jfk-vault.jfk_curated.search_ocr_pages`
partition by range_bucket(doc_shard, generate_array(0, 256, 1))
cluster by document_id, chunk_order
options (require_partition_filter = true)
as
select
  document_id,
  chunk_id,
  chunk_order,
  chunk_text,
  page_label,
  source_type,
  mod(abs(farm_fingerprint(document_id)), 256) as doc_shard,
  lag(chunk_order) over (
    partition by document_id
    order by chunk_order, chunk_id
  ) as prev_chunk_order,
  lead(chunk_order) over (
    partition by document_id
    order by chunk_order, chunk_id
  ) as next_chunk_order
from `jfk-vault.jfk_curated.jfk_text_chunks`
where source_type in ('abbyy_ocr', 'docai_ocr');
