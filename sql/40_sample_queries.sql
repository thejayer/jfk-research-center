-- 40_sample_queries.sql
--
-- Purpose:
--   Read-only example queries illustrating how the API layer should
--   consume the curated and MVP tables. These queries are the shapes
--   the mock adapters in `lib/mock-data.ts` ultimately return.
--
-- Dependencies:
--   - All prior curated.* and mvp.* tables.

-- ---------------------------------------------------------------------------
-- /api/home :: stats
-- ---------------------------------------------------------------------------
select
  (select count(*) from curated.jfk_records)                         as document_count,
  (select count(*) from curated.jfk_text_chunks)                     as mention_count,
  (select count(*) from curated.jfk_entities)                        as entity_count,
  (select 5)                                                         as topic_count;

-- ---------------------------------------------------------------------------
-- /api/home :: recent documents
-- ---------------------------------------------------------------------------
select
  document_id,
  naid,
  title,
  agency,
  start_date,
  document_type
from curated.jfk_records
order by end_date desc nulls last, start_date desc nulls last
limit 6;

-- ---------------------------------------------------------------------------
-- /api/search :: documents matching a phrase (mode = document)
-- ---------------------------------------------------------------------------
select
  r.document_id,
  r.naid,
  r.title,
  r.agency,
  r.document_type,
  r.start_date,
  (select count(*) from curated.jfk_text_chunks c
    where c.document_id = r.document_id
      and search(c.chunk_text, @q)) as matched_chunks
from curated.jfk_records r
where search(r.title, @q) or search(r.description, @q)
   or exists (
     select 1
     from curated.jfk_text_chunks c
     where c.document_id = r.document_id
       and search(c.chunk_text, @q)
   )
order by
  -- Editorial boost for title hits
  cast(search(r.title, @q) as int64) desc,
  r.start_date desc nulls last
limit 50;

-- ---------------------------------------------------------------------------
-- /api/search :: mentions matching a phrase (mode = mention)
-- ---------------------------------------------------------------------------
select
  c.chunk_id,
  c.document_id,
  c.naid,
  r.title                            as document_title,
  c.chunk_text                       as excerpt,
  c.page_label
from curated.jfk_text_chunks c
join curated.jfk_records   r using (document_id, naid)
where search(c.chunk_text, @q)
order by c.document_id, c.chunk_order
limit 100;

-- ---------------------------------------------------------------------------
-- /api/entity/oswald :: top documents for the Oswald page
-- ---------------------------------------------------------------------------
select
  r.document_id,
  r.naid,
  r.title,
  r.agency,
  r.start_date,
  m.confidence,
  m.score
from curated.jfk_document_entity_map m
join curated.jfk_records            r using (document_id)
where m.entity_id = 'oswald'
order by m.score desc, r.start_date
limit 10;

-- ---------------------------------------------------------------------------
-- /api/entity/oswald :: mention excerpts
-- ---------------------------------------------------------------------------
select
  o.chunk_id,
  o.document_id,
  o.title,
  substr(o.chunk_text, 1, 400) as excerpt,
  o.confidence,
  o.score
from mvp.oswald_mentions o
order by o.score desc, o.document_id
limit 25;

-- ---------------------------------------------------------------------------
-- /api/topic/mexico-city
-- ---------------------------------------------------------------------------
select
  document_id,
  naid,
  title,
  agency,
  start_date,
  document_type
from mvp.mexico_city_docs
order by start_date desc nulls last
limit 50;

-- ---------------------------------------------------------------------------
-- /api/document/:id :: core document + first N OCR chunks
-- ---------------------------------------------------------------------------
declare target_id string default '104-10015-10048';

select
  r.*,
  (select array_agg(struct(c.chunk_order, c.chunk_text, c.page_label) order by c.chunk_order)
     from curated.jfk_text_chunks c
    where c.document_id = r.document_id
    limit 20) as chunks
from curated.jfk_records r
where r.document_id = target_id;

-- Related entities for the same document
select
  m.entity_id,
  e.entity_name,
  e.entity_type,
  m.confidence,
  m.score
from curated.jfk_document_entity_map m
join curated.jfk_entities e on e.entity_id = m.entity_id
where m.document_id = target_id
order by m.score desc;
