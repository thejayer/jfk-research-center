-- 05_abbyy_to_nara_map.sql
--
-- Purpose:
--   Build `jfk_staging.abbyy_to_nara_map`: one row per (abbyy_doc_id,
--   document_id) with an explicit match_method + match_confidence for
--   auditability.
--
-- Dependencies:
--   - jfk_staging.abbyy_documents     (loaded by scripts/ingest_abbyy.py)
--   - jfk_raw.nara_manifest           (loaded by scripts/normalize_nara_manifests.py)
--
-- Match strategy (ranked, highest-confidence first):
--
--   1. exact_rif
--      normalized_key = bare RIF (e.g. "104-10004-10156").
--      Direct equality against nara_manifest.record_num.
--      → match_confidence = 'high'
--
--   2. parenthetical_strip
--      Source filename contains a parenthetical suffix such as
--      "104-10004-10143 (C06932208).pdf". normalized_key is the RIF with
--      the suffix removed.
--      → match_confidence = 'high' (the RIF still uniquely identifies
--        the NARA record; the parenthetical is an internal CIA/FBI case id)
--
--   3. unmapped
--      ABBYY document whose normalized_key does not appear in the NARA
--      manifest. Surfaced via `jfk_staging.vw_unmatched_abbyy` and
--      not inserted into the map.
--
-- The map is many-to-one on the NARA side: several ABBYY copies of the
-- same RIF (the "parenthetical variants") map to one document_id. The
-- chunk-promotion step in sql/11 dedupes via a stable row_number()
-- so the curated table keeps a single OCR layer per document.

create or replace table jfk_staging.abbyy_to_nara_map as
with abbyy as (
  select
    abbyy_doc_id,
    normalized_key,
    source_filename
  from jfk_staging.abbyy_documents
),
nara as (
  -- Dedupe nara_manifest to one row per record_num (latest-release wins);
  -- the curated.jfk_records table already does this, but 05_ is allowed
  -- to run before 10_ if a caller re-runs pieces, so we recompute here.
  select
    record_num as document_id,
    record_num as naid
  from jfk_raw.nara_manifest
  group by record_num
),
exact_hits as (
  select
    a.normalized_key,
    a.abbyy_doc_id,
    n.document_id,
    n.naid,
    case
      when a.source_filename like '%(%' then 'parenthetical_strip'
      else 'exact_rif'
    end as match_method,
    'high' as match_confidence
  from abbyy a
  join nara n on n.document_id = a.normalized_key
)
select * from exact_hits;

-- Convenience view for DQ: ABBYY documents that did not map to any NARA record.
create or replace view jfk_staging.vw_unmatched_abbyy as
select
  a.abbyy_doc_id,
  a.normalized_key,
  a.source_filename,
  a.source_path
from jfk_staging.abbyy_documents a
left join jfk_staging.abbyy_to_nara_map m using (abbyy_doc_id)
where m.document_id is null;

-- Convenience view: NARA records that have at least one ABBYY match (useful
-- for scoping MVP queries to the "hot" corpus of OCR'd documents).
create or replace view jfk_staging.vw_documents_with_abbyy as
select
  r.document_id,
  r.naid,
  r.title,
  count(m.abbyy_doc_id) as abbyy_variants
from jfk_curated.jfk_records r
join jfk_staging.abbyy_to_nara_map m on m.document_id = r.document_id
group by r.document_id, r.naid, r.title;
