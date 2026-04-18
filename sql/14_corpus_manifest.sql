-- 14_corpus_manifest.sql
--
-- Purpose:
--   Single-row view describing the shape of the indexed corpus. Used by the
--   scope banner on / and /search to tell users this is a curated subset of
--   the full NARA JFK Assassination Records Collection (~37K of ~300K),
--   and which declassification releases are / are not yet indexed.
--
-- Dependencies: jfk_curated.jfk_records

create or replace view jfk_curated.corpus_manifest as
select
  (select count(distinct document_id) from jfk_curated.jfk_records)         as total_records,
  (select countif(has_ocr)             from jfk_curated.jfk_records)         as records_with_ocr,
  (select max(release_date)            from jfk_curated.jfk_records)         as latest_indexed_release_date,

  -- Release coverage flags. The pipeline tracks release_set verbatim from
  -- the NARA XLSX manifests; 2025 and 2026 releases have no XLSX yet, so
  -- these flags stay false until ingestion catches up.
  exists(select 1 from jfk_curated.jfk_records
          where release_set = '2017-2018')                                   as has_2017_2018_release,
  exists(select 1 from jfk_curated.jfk_records where release_set = '2021')   as has_2021_release,
  exists(select 1 from jfk_curated.jfk_records where release_set = '2022')   as has_2022_release,
  exists(select 1 from jfk_curated.jfk_records where release_set = '2023')   as has_2023_release,
  exists(select 1 from jfk_curated.jfk_records where release_set = '2025')   as has_2025_release,
  exists(select 1 from jfk_curated.jfk_records where release_set = '2026')   as has_2026_release,

  -- Human-readable coverage note for the banner. Regenerate when releases
  -- are ingested.
  '~37K of ~300K records in the Collection. 2025 and 2026 unredacted releases are not yet indexed (tracked on the /about/methodology page).' as coverage_note
;
