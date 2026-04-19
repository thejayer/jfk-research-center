-- 32_entity_cooccurrence.sql
--
-- Purpose:
--   Per-(entity_a, entity_b, year) co-occurrence counts for the Phase
--   5-C network graph at /graph. A pair co-occurs in a record if both
--   entities are mapped to the same document at high/medium confidence.
--   Self-pairs and mirror duplicates are excluded by normalizing to
--   alphabetical ordering (entity_a < entity_b).
--
-- Dependencies:
--   - jfk_curated.jfk_document_entity_map (sql/13)
--   - jfk_curated.jfk_records             (sql/10; used for start_date)
--
-- Year handling:
--   Bucketed by EXTRACT(YEAR FROM start_date) from jfk_records, which
--   is the event-date metadata from NARA (see 4-B notes). Records
--   without a start_date or outside [1950, 2005] are excluded — the
--   misparsed 0063-01-01 outliers would otherwise show up in the slider.
--
-- Scale check:
--   37 k records × avg ~2 entities/record × pair combinatorics, filtered
--   to medium+ confidence, typically yields a few thousand rows. The
--   table is aggregated, so the read path at runtime just filters by
--   year range and sums counts per pair.

create or replace table jfk_curated.entity_cooccurrence as
with pairs as (
  select
    least(a.entity_id, b.entity_id)    as entity_a,
    greatest(a.entity_id, b.entity_id) as entity_b,
    a.document_id
  from `jfk-vault.jfk_curated.jfk_document_entity_map` a
  join `jfk-vault.jfk_curated.jfk_document_entity_map` b
    on a.document_id = b.document_id
   and a.entity_id < b.entity_id
  where a.confidence in ('high', 'medium')
    and b.confidence in ('high', 'medium')
)
select
  p.entity_a,
  p.entity_b,
  extract(year from r.start_date) as year,
  count(*) as cooccurrence_count
from pairs p
join `jfk-vault.jfk_curated.jfk_records` r
  using (document_id)
where r.start_date is not null
  and extract(year from r.start_date) between 1950 and 2005
group by entity_a, entity_b, year;
