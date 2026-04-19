-- 14_corpus_manifest.sql
--
-- Purpose:
--   Single-row view describing the shape of the indexed corpus. Used by
--   the scope banner on / and /search to tell users this is a curated
--   subset of the full NARA JFK Assassination Records Collection (~37K
--   of ~300K), and which declassification releases are / are not yet
--   indexed.
--
-- Release-tagging model (as of sql/10 rewrite, 2026-04-18):
--   A record is tagged as belonging to release R if document_versions
--   contains a row for that (naid, R). The 2017-2023 releases are
--   populated from NARA XLSX manifests; the 2025 release is populated
--   from ABBYY-OCR'd PDFs as synthesized rows. The 2026 release remains
--   unindexed pending a NARA manifest or an ABBYY expansion.
--
-- Dependencies:
--   - jfk_curated.jfk_records       (latest-version view)
--   - jfk_curated.document_versions (per-release rows)

create or replace view jfk_curated.corpus_manifest as
select
  (select count(distinct document_id) from jfk_curated.jfk_records)         as total_records,
  (select countif(has_ocr)             from jfk_curated.jfk_records)         as records_with_ocr,
  (select count(*) from jfk_curated.jfk_text_chunks
    where source_type = 'abbyy_ocr')                                         as ocr_passages,
  (select max(release_date)            from jfk_curated.jfk_records)         as latest_indexed_release_date,

  -- Per-release presence flags, derived from document_versions (the
  -- authoritative per-release table) rather than from jfk_records
  -- (which only shows the latest release per NAID).
  exists(select 1 from jfk_curated.document_versions
          where release_set = '2017-2018')                                   as has_2017_2018_release,
  exists(select 1 from jfk_curated.document_versions where release_set = '2021')   as has_2021_release,
  exists(select 1 from jfk_curated.document_versions where release_set = '2022')   as has_2022_release,
  exists(select 1 from jfk_curated.document_versions where release_set = '2023')   as has_2023_release,
  exists(select 1 from jfk_curated.document_versions where release_set = '2025')   as has_2025_release,
  exists(select 1 from jfk_curated.document_versions where release_set = '2026')   as has_2026_release,

  -- Per-release record counts (distinct NAIDs that appear in that release).
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2017-2018') as records_in_2017_2018,
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2021')      as records_in_2021,
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2022')      as records_in_2022,
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2023')      as records_in_2023,
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2025')      as records_in_2025,
  (select count(distinct naid) from jfk_curated.document_versions where release_set = '2026')      as records_in_2026,

  -- Records where the OCR we index came from the 2025 release (i.e. any
  -- version row has is_ocr_source = true AND release_set = '2025').
  (select count(distinct naid)
     from jfk_curated.document_versions
    where release_set = '2025' and is_ocr_source = true)                     as records_with_2025_ocr
;
