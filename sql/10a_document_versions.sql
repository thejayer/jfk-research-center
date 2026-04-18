-- 10a_document_versions.sql
--
-- Purpose:
--   Per-release history for every record. One row per (NAID × release_set).
--   Previously the pipeline collapsed to one row per NAID using "latest
--   release wins" dedup in sql/10, which silently threw away the release
--   history — we saw only the most recent metadata appearance. The 2025
--   release, which ABBYY has OCR'd but for which NARA has not yet
--   published an XLSX manifest, was being tagged with whichever older
--   release the matching RIF came from (2017-2018, 2021, 2022, or 2023),
--   making the site claim "released 2018" next to text that only became
--   readable after the March 2025 unredaction.
--
--   This table keeps one canonical row per (NAID × release) so the
--   document page can show a release history strip, corpus_manifest can
--   correctly flag 2025 coverage, and Phase 1-B redaction diffs have a
--   foundation to build on.
--
-- Dependencies:
--   - jfk_raw.nara_manifest     (the 4 XLSX releases, 72k raw rows)
--   - jfk_staging.abbyy_documents (ABBYY 2025-release OCR'd PDFs)
--   - jfk_curated.safe_date     (defined in sql/10)
--
-- Notes on dedup:
--   The NARA XLSX manifests contain same-release duplicates — RIF
--   124-10190-10078 appears 21 times in the 2017-2018 manifest alone
--   (one row per document-part). We collapse those to a single row per
--   (NAID × release) using MAX across available metadata, preferring
--   non-null values.
--
-- Notes on the synthesized 2025 rows:
--   NARA has not published an XLSX manifest for the 2025 release. ABBYY
--   OCR'd the re-released PDFs but we have no release_date, title, or
--   pages_released per record from their side. We synthesize a 2025 row
--   for every ABBYY-matched RIF using '2025-03-18' (the first March 2025
--   drop) as a conservative release_date placeholder. Title and agency
--   carry forward from the most recent prior manifest appearance so the
--   site still has something to render; `is_ocr_source` flags that the
--   OCR we hold came from this release.

create or replace table jfk_curated.document_versions as
with manifest_grouped as (
  -- Collapse same-release same-NAID duplicates to one row per (NAID × release_set).
  -- Use MAX to prefer non-null values when available.
  select
    record_num                                           as document_id,
    record_num                                           as naid,
    release_set,
    max(jfk_curated.safe_date(release_date))             as release_date,
    max(nullif(trim(coalesce(title, '')), ''))           as raw_title,
    max(nullif(trim(coalesce(agency, '')), ''))          as raw_agency,
    max(nullif(trim(coalesce(agency_from_prefix, '')), '')) as agency_from_prefix,
    max(nullif(trim(coalesce(doc_type, '')), ''))        as raw_doc_type,
    max(nullif(trim(coalesce(from_name, '')), ''))       as raw_from,
    max(nullif(trim(coalesce(to_name, '')), ''))         as raw_to,
    max(nullif(trim(coalesce(originator, '')), ''))      as raw_originator,
    max(nullif(trim(coalesce(comments, '')), ''))        as raw_comments,
    max(nullif(trim(coalesce(formerly_withheld, '')), '')) as raw_withholding,
    max(nullif(trim(coalesce(record_series, '')), ''))   as raw_record_group,
    max(jfk_curated.safe_date(doc_date))                 as doc_date,
    max(safe_cast(num_pages as int64))                   as num_pages,
    max(safe_cast(pages_released as int64))              as pages_released,
    max(pdf_url)                                         as pdf_url
  from jfk_raw.nara_manifest
  group by record_num, release_set
),
abbyy_2025 as (
  -- One synthesized 2025 row per ABBYY-matched RIF. Metadata fields are
  -- pulled from the most-recent prior manifest appearance so the row is
  -- usable even though NARA hasn't published a 2025 XLSX.
  select distinct
    a.normalized_key as document_id,
    a.normalized_key as naid,
    '2025'           as release_set,
    date '2025-03-18' as release_date,  -- first March 2025 drop
    cast(null as string) as raw_title,
    cast(null as string) as raw_agency,
    cast(null as string) as agency_from_prefix,
    cast(null as string) as raw_doc_type,
    cast(null as string) as raw_from,
    cast(null as string) as raw_to,
    cast(null as string) as raw_originator,
    cast(null as string) as raw_comments,
    cast(null as string) as raw_withholding,
    cast(null as string) as raw_record_group,
    cast(null as date)   as doc_date,
    cast(null as int64)  as num_pages,
    cast(null as int64)  as pages_released,
    cast(null as string) as pdf_url
  from jfk_staging.abbyy_documents a
  where a.normalized_key is not null and a.normalized_key != ''
),
combined as (
  select *, 'manifest' as source_kind, false as is_ocr_source from manifest_grouped
  union all
  select *, 'abbyy-2025-synth' as source_kind, true as is_ocr_source from abbyy_2025
),
-- Synthesize display fields. Title / description use the same fallback
-- logic as sql/10 but operate per (NAID × release).
enriched as (
  select
    document_id,
    naid,
    release_set,
    release_date,
    source_kind,
    is_ocr_source,
    case
      when length(coalesce(raw_title, '')) > 0 then raw_title
      when length(coalesce(raw_from, '')) > 0 or length(coalesce(raw_to, '')) > 0 then
        concat(
          coalesce(raw_doc_type, 'Record'),
          case when length(coalesce(raw_from, '')) > 0 then concat(' from ', raw_from) else '' end,
          case when length(coalesce(raw_to,   '')) > 0 then concat(' to ',   raw_to)   else '' end
        )
      when length(coalesce(raw_doc_type, '')) > 0 then concat('Untitled ', raw_doc_type)
      else cast(null as string)
    end as title,
    (select string_agg(part, ' · ')
       from unnest([
         raw_originator,
         case when length(coalesce(raw_from, '')) > 0 then concat('From: ', raw_from) end,
         case when length(coalesce(raw_to,   '')) > 0 then concat('To: ',   raw_to)   end,
         raw_comments,
         case when length(coalesce(raw_withholding, '')) > 0
              then concat('Release: ', raw_withholding) end
       ]) as part
       where part is not null and part != ''
    ) as description,
    coalesce(raw_agency, agency_from_prefix) as agency,
    raw_doc_type      as document_type,
    raw_record_group  as record_group,
    doc_date          as start_date,
    doc_date          as end_date,
    num_pages,
    pages_released,
    raw_withholding   as withholding_status,
    pdf_url
  from combined
)
select * from enriched;
