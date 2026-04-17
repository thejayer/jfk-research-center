-- 20_mvp_oswald_mentions.sql
--
-- Purpose:
--   Every (document, chunk) pair that mentions Oswald, with confidence
--   buckets and a numeric score. This is the primary source for the
--   Oswald entity page's "matched passages" section.
--
-- Dependencies:
--   - jfk_curated.jfk_records
--   - jfk_curated.jfk_text_chunks    (ABBYY-backed where available)
--   - jfk_curated.jfk_entities       (for the canonical alias list)
--
-- Confidence semantics (match the global entity-map tiers):
--     high    → Oswald alias in the record title
--     medium  → alias in the record description
--     low     → alias in an ABBYY OCR chunk (but not title/description)
--
-- Unlike the pre-ABBYY version, this table now returns real quotable
-- OCR passages for the UI, not synthesized description text.

create or replace table jfk_mvp.oswald_mentions as
with oswald_aliases as (
  select 'lee harvey oswald' as alias, 1.00 as weight union all
  select 'lee h. oswald',            0.95 union all
  select 'harvey oswald',            0.90 union all
  select 'l. h. oswald',             0.85 union all
  select 'oswald',                   0.70 union all
  select 'lho',                      0.55 union all
  select 'alek j. hidell',           0.95 union all
  select 'a. j. hidell',             0.90 union all
  select 'alik hidell',              0.85 union all
  select 'o. h. lee',                0.75
),
alias_regex as (
  select string_agg(alias, '|') as alternation from oswald_aliases
),
-- Chunk-level hits (ABBYY or description fallback)
chunk_hits as (
  select
    c.document_id,
    c.naid,
    c.chunk_id,
    c.chunk_text,
    c.chunk_order,
    c.page_label,
    c.source_type,
    regexp_contains(
      lower(c.chunk_text),
      (select concat(r'\b(', alternation, r')\b') from alias_regex)
    ) as chunk_hit
  from jfk_curated.jfk_text_chunks c
),
-- Record-level hits on title / description
record_hits as (
  select
    r.document_id,
    r.naid,
    r.title,
    r.description,
    r.agency,
    r.start_date,
    r.source_url,
    regexp_contains(
      lower(coalesce(r.title, '')),
      (select concat(r'\b(', alternation, r')\b') from alias_regex)
    ) as title_hit,
    regexp_contains(
      lower(coalesce(r.description, '')),
      (select concat(r'\b(', alternation, r')\b') from alias_regex)
    ) as description_hit
  from jfk_curated.jfk_records r
)
select
  r.document_id,
  r.naid,
  c.chunk_id,
  r.title,
  r.description,
  r.agency,
  r.start_date,
  r.source_url,
  c.chunk_text,
  c.chunk_order,
  c.page_label,
  c.source_type,
  case
    when r.title_hit        then 'high'
    when r.description_hit  then 'medium'
    when c.chunk_hit        then 'low'
  end as confidence,
  (if(r.title_hit, 1.0, 0.0))
    + (if(r.description_hit, 0.6, 0.0))
    + (if(c.chunk_hit, 0.35, 0.0)) as score
from record_hits r
left join chunk_hits c using (document_id, naid)
where r.title_hit or r.description_hit or c.chunk_hit;
