-- 10_curated_jfk_records.sql
--
-- Purpose:
--   Build the canonical `jfk_curated.jfk_records` table: one row per
--   unique Record Number (RIF) from the NARA JFK Assassination Records
--   Collection, with latest-release precedence.
--
-- Dependencies:
--   - jfk_raw.nara_manifest (unified CSV of the 2017-2018, 2021, 2022,
--     and 2023 XLSX manifests; see scripts/normalize_nara_manifests.py)
--   - jfk_staging.abbyy_documents (used only to compute has_ocr; the
--     table is produced by scripts/ingest_abbyy.py)
--
-- Notes:
--   - Each record can appear multiple times (re-released with fewer
--     redactions). We keep the row from the latest release_set.
--   - Dates in the manifest are strings, usually MM/DD/YYYY, sometimes
--     with "00" as day ("07/00/1978"). `safe_date` normalizes these:
--     0-day becomes day 1, 0-month becomes month 1.
--   - `agency` is coalesced with an agency-from-prefix inference
--     (e.g. "104-..." → CIA) so the ~14k rows missing an explicit
--     Agency still surface on the relevant pages.

create or replace function jfk_curated.safe_date(s string)
  returns date
  as ((
    with p as (
      select regexp_extract_all(coalesce(s, ''), r'\d+') as parts
    )
    select case
      when array_length(p.parts) < 3 then null
      else safe.date(
        cast(p.parts[offset(2)] as int64),
        cast(if(cast(p.parts[offset(0)] as int64) = 0, 1, cast(p.parts[offset(0)] as int64)) as int64),
        cast(if(cast(p.parts[offset(1)] as int64) = 0, 1, cast(p.parts[offset(1)] as int64)) as int64)
      )
    end
    from p
  ));

-- Rebuild uses truncate+insert rather than CREATE OR REPLACE TABLE so that
-- search indexes on this table survive a rebuild. Schema changes (adding
-- or renaming columns) still require dropping and re-creating the table,
-- since INSERT would then fail with a schema mismatch.
begin
  create or replace temp table _new_records as
  with ranked as (
    select
      m.*,
      -- Prefer the most recent release for a given record_num
      row_number() over (
        partition by m.record_num
        order by case m.release_set
          when '2023'      then 1
          when '2022'      then 2
          when '2021'      then 3
          when '2017-2018' then 4
          else 5
        end
      ) as rn
    from jfk_raw.nara_manifest m
  ),
  abbyy_keys as (
    select distinct normalized_key
    from jfk_staging.abbyy_documents
    where normalized_key is not null and normalized_key != ''
  )
  select
    -- Core identifiers
    record_num as document_id,
    record_num as naid,

    -- Title: prefer explicit Title; fall back to a generated one from
    -- From/To/Subject; fall back to "Untitled [doc_type]" as last resort.
    case
      when length(trim(coalesce(title, ''))) > 0 then trim(title)
      when length(trim(coalesce(from_name, ''))) > 0
        or length(trim(coalesce(to_name,   ''))) > 0 then
          concat(
            coalesce(nullif(trim(doc_type), ''), 'Record'),
            case when length(trim(coalesce(from_name, ''))) > 0
                 then concat(' from ', trim(from_name)) else '' end,
            case when length(trim(coalesce(to_name, ''))) > 0
                 then concat(' to ', trim(to_name)) else '' end
          )
      else concat('Untitled ', coalesce(nullif(trim(doc_type), ''), 'Record'))
    end as title,

    -- Description: synthesize from the metadata we have
    (select string_agg(part, ' · ')
       from unnest([
         nullif(trim(coalesce(originator, '')), ''),
         case when length(trim(coalesce(from_name, ''))) > 0
              then concat('From: ', trim(from_name)) end,
         case when length(trim(coalesce(to_name, ''))) > 0
              then concat('To: ',   trim(to_name))   end,
         nullif(trim(coalesce(comments, '')), ''),
         case when length(trim(coalesce(formerly_withheld, ''))) > 0
              then concat('Release: ', trim(formerly_withheld)) end
       ]) as part
       where part is not null and part != ''
    ) as description,

    nullif(trim(coalesce(record_series, '')), '') as record_group,
    coalesce(
      nullif(trim(coalesce(agency,             '')), ''),
      nullif(trim(coalesce(agency_from_prefix, '')), '')
    )                                          as agency,
    'JFK Assassination Records Collection'     as collection_name,
    jfk_curated.safe_date(doc_date)            as start_date,
    jfk_curated.safe_date(doc_date)            as end_date,
    jfk_curated.safe_date(release_date)        as release_date,
    release_set,
    pdf_url                                    as source_url,
    cast(null as string)                       as thumbnail_url,
    pdf_url                                    as digital_object_url,
    nullif(trim(coalesce(doc_type, '')), '')   as document_type,
    record_num in (select normalized_key from abbyy_keys) as has_ocr,
    case when length(trim(coalesce(pdf_url, ''))) > 0 then true else false end as has_digital_object,
    safe_cast(num_pages      as int64)         as num_pages,
    safe_cast(pages_released as int64)         as pages_released,
    nullif(trim(coalesce(formerly_withheld, '')), '') as withholding_status
  from ranked
  where rn = 1;

  create table if not exists jfk_curated.jfk_records as
    select * from _new_records limit 0;

  truncate table jfk_curated.jfk_records;
  insert into jfk_curated.jfk_records select * from _new_records;
end;
