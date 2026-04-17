-- 90_dq_reports.sql
--
-- Purpose:
--   Data-quality views over the ABBYY → NARA join. These are read-only
--   views (not materialized tables) so they always reflect the latest
--   state of the staging + curated layers.
--
-- Dependencies:
--   - jfk_staging.abbyy_documents
--   - jfk_staging.abbyy_text_chunks
--   - jfk_staging.abbyy_to_nara_map
--   - jfk_curated.jfk_records
--   - jfk_curated.jfk_text_chunks

-- -----------------------------------------------------------------------
-- Unmatched ABBYY documents
-- -----------------------------------------------------------------------
-- ABBYY files whose normalized_key cannot be joined to a NARA record.
-- Usually means the RIF belongs to a release we haven't loaded yet
-- (e.g. the 2025 release manifest once published).
create or replace view jfk_staging.dq_unmatched_abbyy as
select
  a.abbyy_doc_id,
  a.normalized_key,
  a.source_filename,
  a.source_path,
  a.release_batch
from jfk_staging.abbyy_documents a
left join jfk_staging.abbyy_to_nara_map m using (abbyy_doc_id)
where m.document_id is null;

-- -----------------------------------------------------------------------
-- Duplicate ABBYY matches on the NARA side
-- -----------------------------------------------------------------------
-- NARA records with >1 ABBYY source. Typically a main file plus a
-- parenthetical CIA/FBI variant. Expected but logged for auditability.
create or replace view jfk_staging.dq_duplicate_abbyy_matches as
select
  m.document_id,
  m.naid,
  count(*) as abbyy_variants,
  array_agg(m.abbyy_doc_id order by m.abbyy_doc_id) as abbyy_doc_ids,
  array_agg(a.source_filename order by m.abbyy_doc_id) as source_filenames
from jfk_staging.abbyy_to_nara_map m
join jfk_staging.abbyy_documents a using (abbyy_doc_id)
group by m.document_id, m.naid
having count(*) > 1;

-- -----------------------------------------------------------------------
-- Short or empty OCR chunks
-- -----------------------------------------------------------------------
-- Chunks kept after the >40-char filter in sql/11 but that still look
-- thin (<120 chars) — worth sampling manually to decide whether the
-- threshold needs tuning.
create or replace view jfk_staging.dq_short_chunks as
select
  chunk_id,
  document_id,
  source_type,
  chunk_chars,
  chunk_text
from jfk_curated.jfk_text_chunks
where chunk_chars < 120;

-- -----------------------------------------------------------------------
-- OCR coverage by release set
-- -----------------------------------------------------------------------
-- Percentage of NARA records (per release set) that have ABBYY OCR.
-- Expected: high coverage of 2025 release (canonical), partial of others.
create or replace view jfk_staging.dq_ocr_coverage_by_release as
with base as (
  select
    coalesce(n.release_set, 'unknown') as release_set,
    n.record_num as document_id,
    case when m.document_id is not null then 1 else 0 end as has_abbyy
  from jfk_raw.nara_manifest n
  left join jfk_staging.abbyy_to_nara_map m on m.document_id = n.record_num
  group by release_set, document_id, has_abbyy
)
select
  release_set,
  count(*) as records,
  sum(has_abbyy) as records_with_abbyy,
  round(100.0 * sum(has_abbyy) / count(*), 1) as pct_with_ocr
from base
group by release_set
order by release_set;

-- -----------------------------------------------------------------------
-- Join-quality summary
-- -----------------------------------------------------------------------
create or replace view jfk_staging.dq_join_summary as
select
  match_method,
  match_confidence,
  count(*) as n
from jfk_staging.abbyy_to_nara_map
group by match_method, match_confidence
order by match_method, match_confidence;
