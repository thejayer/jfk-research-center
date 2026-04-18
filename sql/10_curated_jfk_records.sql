-- 10_curated_jfk_records.sql
--
-- Purpose:
--   Build the canonical `jfk_curated.jfk_records` table: one row per
--   unique Record Number (RIF) from the NARA JFK Assassination Records
--   Collection, with latest-release precedence AND a release_history
--   array so downstream surfaces can show per-release information.
--
-- Dependencies:
--   - jfk_curated.document_versions (sql/10a — one row per (NAID × release))
--   - jfk_raw.nara_manifest         (only for the safe_date UDF below)
--
-- Notes:
--   - Metadata columns (title, description, agency, document_type, etc.)
--     come from the most-recent MANIFEST-sourced row. The synthesized
--     2025 rows lack metadata, so we don't pull title/desc from them.
--   - `release_set` (the single "latest" release label shown on cards)
--     takes the 2025 synthesized row if present — that's where the
--     content actually came from. Otherwise it falls back to the latest
--     manifest row.
--   - `release_history` holds one struct per (release_set, release_date,
--     is_ocr_source) sorted earliest → latest so the UI can render a
--     strip without extra queries.
--   - Schema changed on 2026-04-18 (added release_history array).
--     Downstream rebuilds must drop + re-create this table; the block
--     below handles that idempotently.

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

-- Drop if the table exists with the pre-release_history schema so the
-- rebuild below picks up the new shape. TRUNCATE+INSERT cannot accept a
-- changed schema; this one-time drop paves the way. Subsequent rebuilds
-- (with schema unchanged) will TRUNCATE+INSERT and preserve search
-- indexes as before.
begin
  declare needs_drop bool default (
    select exists(
      select 1 from `jfk-vault.jfk_curated.INFORMATION_SCHEMA.TABLES`
      where table_name = 'jfk_records'
    )
    and not exists(
      select 1 from `jfk-vault.jfk_curated.INFORMATION_SCHEMA.COLUMNS`
      where table_name = 'jfk_records' and column_name = 'release_history'
    )
  );
  if needs_drop then
    execute immediate 'drop table `jfk-vault.jfk_curated.jfk_records`';
  end if;
end;

begin
  create or replace temp table _versions_ordered as
  select
    v.*,
    case v.release_set
      when '2025'      then 1
      when '2023'      then 2
      when '2022'      then 3
      when '2021'      then 4
      when '2017-2018' then 5
      else 6
    end as release_order
  from jfk_curated.document_versions v;

  create or replace temp table _new_records as
  with
  -- Metadata from the most recent MANIFEST row (not synthesized 2025).
  manifest_ranked as (
    select *,
      row_number() over (partition by naid order by release_order asc) as manifest_rn
    from _versions_ordered
    where source_kind = 'manifest'
  ),
  metadata_row as (
    select * from manifest_ranked where manifest_rn = 1
  ),
  -- Overall latest release label (can be '2025' via synthesized OCR row).
  latest_row as (
    select *,
      row_number() over (partition by naid order by release_order asc) as overall_rn
    from _versions_ordered
  ),
  latest_by_naid as (
    select naid, release_set as latest_release_set, release_date as latest_release_date
    from latest_row where overall_rn = 1
  ),
  -- OCR flag and release history aggregation.
  agg as (
    select
      naid,
      logical_or(is_ocr_source) as has_ocr,
      array_agg(
        struct(release_set, release_date, is_ocr_source)
        order by release_order desc
      ) as release_history
    from _versions_ordered
    group by naid
  )
  select
    m.document_id                                    as document_id,
    m.naid                                           as naid,
    coalesce(m.title, concat('Untitled Record'))     as title,
    m.description                                    as description,
    m.record_group                                   as record_group,
    m.agency                                         as agency,
    'JFK Assassination Records Collection'           as collection_name,
    m.start_date                                     as start_date,
    m.end_date                                       as end_date,
    l.latest_release_date                            as release_date,
    l.latest_release_set                             as release_set,
    m.pdf_url                                        as source_url,
    cast(null as string)                             as thumbnail_url,
    m.pdf_url                                        as digital_object_url,
    m.document_type                                  as document_type,
    a.has_ocr                                        as has_ocr,
    case when length(trim(coalesce(m.pdf_url, ''))) > 0 then true else false end as has_digital_object,
    m.num_pages                                      as num_pages,
    m.pages_released                                 as pages_released,
    m.withholding_status                             as withholding_status,
    a.release_history                                as release_history
  from metadata_row m
  join latest_by_naid l using (naid)
  join agg           a using (naid);

  create table if not exists jfk_curated.jfk_records as
    select * from _new_records limit 0;

  truncate table jfk_curated.jfk_records;
  insert into jfk_curated.jfk_records select * from _new_records;
end;
