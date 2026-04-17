-- 21_mvp_topic_views.sql
--
-- Purpose:
--   Per-topic MVP tables that back the /topic/[slug] pages. Each table
--   is one row per record that belongs to the topic.
--
-- Dependencies:
--   - jfk_curated.jfk_records
--   - jfk_curated.jfk_document_entity_map  (for agency-driven topics)
--
-- Notes:
--   - Agency-driven topics (CIA, FBI, HSCA, Warren Commission) are
--     defined as the union of (a) records where the entity appears in
--     title/description and (b) records whose agency field matches.
--   - Non-entity topics (Mexico City, Cuba, 1963 timeline) use keyword
--     matching on the title + description haystack.

-- -----------------------------------------------------------------------
-- mvp.oswald_mentions: entity-based mentions for the Oswald entity page
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.oswald_mentions as
select
  r.document_id,
  r.naid,
  r.title,
  r.description,
  r.agency,
  r.start_date,
  r.source_url,
  m.confidence,
  m.match_source,
  m.score
from jfk_curated.jfk_records         r
join jfk_curated.jfk_document_entity_map m using (document_id)
where m.entity_id = 'oswald';

-- -----------------------------------------------------------------------
-- mvp.ruby_mentions
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.ruby_mentions as
select r.*, m.confidence, m.score
from jfk_curated.jfk_records r
join jfk_curated.jfk_document_entity_map m using (document_id)
where m.entity_id = 'ruby';

-- -----------------------------------------------------------------------
-- mvp.cia_docs — CIA either by agency or by entity mention
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.cia_docs as
with by_agency as (
  select document_id from jfk_curated.jfk_records where agency = 'CIA'
),
by_entity as (
  select document_id from jfk_curated.jfk_document_entity_map where entity_id = 'cia'
)
select r.*,
  case when r.agency = 'CIA' then 'high' else 'medium' end as confidence
from jfk_curated.jfk_records r
where r.document_id in (select document_id from by_agency)
   or r.document_id in (select document_id from by_entity);

-- -----------------------------------------------------------------------
-- mvp.fbi_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.fbi_docs as
with by_agency as (
  select document_id from jfk_curated.jfk_records where agency = 'FBI'
),
by_entity as (
  select document_id from jfk_curated.jfk_document_entity_map where entity_id = 'fbi'
)
select r.*,
  case when r.agency = 'FBI' then 'high' else 'medium' end as confidence
from jfk_curated.jfk_records r
where r.document_id in (select document_id from by_agency)
   or r.document_id in (select document_id from by_entity);

-- -----------------------------------------------------------------------
-- mvp.hsca_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.hsca_docs as
with by_agency as (
  select document_id from jfk_curated.jfk_records where agency = 'HSCA'
),
by_entity as (
  select document_id from jfk_curated.jfk_document_entity_map where entity_id = 'hsca'
)
select r.*,
  case when r.agency = 'HSCA' then 'high' else 'medium' end as confidence
from jfk_curated.jfk_records r
where r.document_id in (select document_id from by_agency)
   or r.document_id in (select document_id from by_entity);

-- -----------------------------------------------------------------------
-- mvp.warren_commission_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.warren_commission_docs as
select r.*, coalesce(m.confidence, 'medium') as confidence
from jfk_curated.jfk_records r
left join jfk_curated.jfk_document_entity_map m
  on m.document_id = r.document_id and m.entity_id = 'warren-commission'
where regexp_contains(lower(coalesce(r.title, '')),       r'\bwarren commission\b')
   or regexp_contains(lower(coalesce(r.description, '')), r'\bwarren commission\b')
   or regexp_contains(lower(coalesce(r.record_group,'')), r'\bwc\b|\bwarren\b');

-- -----------------------------------------------------------------------
-- mvp.mexico_city_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.mexico_city_docs as
select r.*
from jfk_curated.jfk_records r
where regexp_contains(lower(coalesce(r.title, '')),       r'\bmexico city\b|\bmexico\b|\bmexi\b')
   or regexp_contains(lower(coalesce(r.description, '')), r'\bmexico city\b')
   or regexp_contains(lower(coalesce(r.title, '')),       r'\bkostikov\b|\bduran\b|\bsilvia duran\b|\bcuban consulate\b');

-- -----------------------------------------------------------------------
-- mvp.cuba_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.cuba_docs as
select r.*
from jfk_curated.jfk_records r
where regexp_contains(lower(coalesce(r.title, '')),       r'\b(cuba|cuban|castro|jmwave|dre|fpcc)\b')
   or regexp_contains(lower(coalesce(r.description, '')), r'\b(cuba|cuban|castro|jmwave|dre|fpcc)\b');

-- -----------------------------------------------------------------------
-- mvp.timeline_1963_docs
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.timeline_1963_docs as
select r.*
from jfk_curated.jfk_records r
where r.start_date between date '1963-01-01' and date '1963-12-31';

-- -----------------------------------------------------------------------
-- mvp.featured_documents — editorial rank for the homepage
-- -----------------------------------------------------------------------
-- Ordered by (title-hit Oswald first, then most pages) so the homepage's
-- "recent" list has meaningful content even before a hand-curated list.
create or replace table jfk_mvp.featured_documents as
with scored as (
  select
    r.document_id,
    r.title,
    r.agency,
    r.start_date,
    r.pages_released,
    (select max(case when m.confidence = 'high' then m.score end)
       from jfk_curated.jfk_document_entity_map m
      where m.document_id = r.document_id) as title_entity_score,
    coalesce(r.pages_released, 0) as pages
  from jfk_curated.jfk_records r
  where r.title is not null and length(r.title) > 10
)
select document_id, row_number() over (
  order by title_entity_score desc nulls last, pages desc, start_date desc
) as rank
from scored
limit 100;
