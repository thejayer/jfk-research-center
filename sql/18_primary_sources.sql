-- 18_primary_sources.sql
--
-- Purpose:
--   Promote supplementary primary-source documents (Warren Commission
--   Report, ARRB Final Report, Church Committee Book V) from the staging
--   tables into jfk_records + jfk_text_chunks so they appear alongside
--   NARA records in search.
--
--   These are not NARA XLSX-manifest records — they are public-domain
--   reports and finding-aid-level documents that contextualize the
--   collection. They get special collection_name + agency tags so the UI
--   can distinguish them from NARA records.
--
-- Dependencies:
--   - jfk_staging.primary_source_docs    (scripts/ingest_primary_sources.py)
--   - jfk_staging.primary_source_chunks  (idem)
--   - jfk_curated.jfk_records            (sql/10 — must run first)
--   - jfk_curated.jfk_text_chunks        (sql/11 — must run first)
--
-- Rebuild order note:
--   sql/10 and sql/11 TRUNCATE + INSERT, so this file must run AFTER them
--   in rebuild_warehouse.sh. Each rebuild re-appends these rows.

-- ---------------------------------------------------------------------
-- Append 3 rows to jfk_records with synthetic release_history.
-- ---------------------------------------------------------------------
insert into jfk_curated.jfk_records (
  document_id, naid, title, description, record_group, agency,
  collection_name, start_date, end_date, release_date, release_set,
  source_url, thumbnail_url, digital_object_url, document_type,
  has_ocr, has_digital_object, num_pages, pages_released,
  withholding_status, release_history
)
select
  d.doc_id                                                           as document_id,
  d.doc_id                                                           as naid,
  d.title                                                            as title,
  format(
    '%s, %d. %d chunks of full text indexed for search. Primary-source report published outside the JFK Assassination Records Collection; linked here for contextual reading.',
    d.agency, d.year, d.num_chunks
  )                                                                  as description,
  'Primary source report'                                            as record_group,
  d.agency                                                           as agency,
  d.title                                                            as collection_name,
  safe.parse_date('%Y', cast(d.year as string))                      as start_date,
  safe.parse_date('%Y', cast(d.year as string))                      as end_date,
  safe.parse_date('%Y', cast(d.year as string))                      as release_date,
  'primary-source'                                                   as release_set,
  d.source_url                                                       as source_url,
  cast(null as string)                                               as thumbnail_url,
  d.source_url                                                       as digital_object_url,
  'Report'                                                           as document_type,
  true                                                               as has_ocr,
  true                                                               as has_digital_object,
  cast(null as int64)                                                as num_pages,
  cast(null as int64)                                                as pages_released,
  cast(null as string)                                               as withholding_status,
  [struct(
    'primary-source'                                        as release_set,
    safe.parse_date('%Y', cast(d.year as string))           as release_date,
    true                                                    as is_ocr_source
  )]                                                                 as release_history
from jfk_staging.primary_source_docs d
where d.doc_id not in (
  select document_id from jfk_curated.jfk_records where release_set = 'primary-source'
);

-- ---------------------------------------------------------------------
-- Append chunks to jfk_text_chunks with source_type='primary_source'.
-- ---------------------------------------------------------------------
insert into jfk_curated.jfk_text_chunks (
  chunk_id, document_id, naid, chunk_order, chunk_text, chunk_chars,
  token_estimate, page_label, source_type, abbyy_doc_id
)
select
  concat(c.doc_id, '-', cast(c.chunk_order as string), '-primary_source') as chunk_id,
  c.doc_id                                                                as document_id,
  c.doc_id                                                                as naid,
  c.chunk_order                                                           as chunk_order,
  c.chunk_text                                                            as chunk_text,
  length(c.chunk_text)                                                    as chunk_chars,
  cast(length(c.chunk_text) / 4 as int64)                                 as token_estimate,
  nullif(c.section_label, '')                                             as page_label,
  'primary_source'                                                        as source_type,
  cast(null as string)                                                    as abbyy_doc_id
from jfk_staging.primary_source_chunks c
where not exists (
  select 1 from jfk_curated.jfk_text_chunks t
   where t.document_id = c.doc_id
     and t.source_type = 'primary_source'
);
