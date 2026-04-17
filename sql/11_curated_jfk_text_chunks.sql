-- 11_curated_jfk_text_chunks.sql
--
-- Purpose:
--   Build `jfk_curated.jfk_text_chunks`: one row per searchable passage.
--   ABBYY OCR is the preferred source; the NARA description field is
--   the fallback when no ABBYY chunks are available for a document.
--
-- Dependencies:
--   - jfk_staging.abbyy_text_chunks     (loaded by scripts/ingest_abbyy.py)
--   - jfk_staging.abbyy_to_nara_map     (sql/05)
--   - jfk_curated.jfk_records           (sql/10)
--
-- source_type values:
--   'abbyy_ocr'   — per-page text from ABBYY-enhanced PDF, chunked at ~1,200 chars
--   'description' — fallback: a single chunk holding the NARA description
--   'nara_ocr'    — reserved for future use if NARA ever adds an OCR layer
--
-- Precedence:
--   For any given document_id, if at least one ABBYY chunk exists, the
--   description fallback is NOT produced. This avoids double-counting
--   the same content across source_types in downstream entity matching.

-- Rebuild uses truncate+insert so search indexes on this table survive a
-- rebuild. Schema changes (adding/renaming columns) still require a drop
-- and recreate.
begin
  create or replace temp table _new_chunks as
  with abbyy_chunks as (
    -- If multiple ABBYY variants map to the same document_id (e.g. parenthetical
    -- siblings), keep the chunk set from the first abbyy_doc_id (stable choice
    -- via row_number over the alphabetical abbyy_doc_id).
    select
      m.document_id,
      m.naid,
      c.chunk_order,
      c.chunk_text,
      c.chunk_chars,
      c.token_estimate,
      c.page_label,
      c.abbyy_doc_id
    from jfk_staging.abbyy_to_nara_map m
    join jfk_staging.abbyy_text_chunks c using (abbyy_doc_id)
    qualify row_number() over (
      partition by m.document_id, c.chunk_order
      order by m.abbyy_doc_id
    ) = 1
  ),
  docs_with_abbyy as (
    select distinct document_id from abbyy_chunks
  ),
  description_fallback as (
    select
      r.document_id,
      r.naid,
      0 as chunk_order,
      trim(r.description) as chunk_text,
      length(trim(r.description)) as chunk_chars,
      cast(length(r.description) / 4 as int64) as token_estimate,
      cast(null as string) as page_label,
      cast(null as string) as abbyy_doc_id
    from jfk_curated.jfk_records r
    where r.description is not null
      and length(trim(r.description)) >= 20
      and r.document_id not in (select document_id from docs_with_abbyy)
  ),
  all_chunks as (
    select
      *,
      'abbyy_ocr' as source_type
    from abbyy_chunks
    union all
    select
      *,
      'description' as source_type
    from description_fallback
  )
  select
    concat(document_id, '-', cast(chunk_order as string), '-', source_type) as chunk_id,
    document_id,
    naid,
    chunk_order,
    chunk_text,
    chunk_chars,
    token_estimate,
    page_label,
    source_type,
    abbyy_doc_id
  from all_chunks
  where length(trim(chunk_text)) > 40;

  create table if not exists jfk_curated.jfk_text_chunks as
    select * from _new_chunks limit 0;

  truncate table jfk_curated.jfk_text_chunks;
  insert into jfk_curated.jfk_text_chunks select * from _new_chunks;
end;
