-- 42_open_questions_status.sql
--
-- Purpose:
--   Adds resolution-status columns to jfk_topic_batch_questions and
--   auto-tags any thread whose question or summary mentions a
--   declassified cryptonym from sql/41_cryptonym_glossary as
--   `resolved`. The audit flagged "unexplained reference" threads that
--   in fact reference well-documented operations (LIENVOY, ZRRIFLE,
--   AMLASH, etc.); this migration closes that mismatch.
--
-- Status values:
--   'open'                Default. No declassified resolution found.
--   'partially_resolved'  Some context exists; key facts still redacted.
--   'resolved'            Documented in citation_registry / glossary.
--
-- Idempotent: ALTER COLUMN IF NOT EXISTS, then UPDATE driven by a
-- regex/IN scan against the glossary. Re-running re-applies the same
-- mappings without disturbing manual edits to other status values
-- (the UPDATE only sets `open` rows, never overwrites `partially_resolved`
-- or manually-set `resolved`).

alter table jfk_curated.jfk_topic_batch_questions
  add column if not exists status                  string,
  add column if not exists resolution_text         string,
  add column if not exists resolution_naids        array<string>,
  add column if not exists resolution_citation_ids array<string>;

-- Backfill: any thread that references a declassified cryptonym
-- (case-insensitive, word-boundary match against either question or
-- summary) is auto-resolved. The resolution_text quotes the glossary
-- meaning and names the first public source. Done as a MERGE so BQ
-- doesn't reject the correlated subquery shape.
merge jfk_curated.jfk_topic_batch_questions q
using (
  with matches as (
    select
      q.batch_num,
      q.question_index,
      cg.cryptonym,
      cg.meaning,
      cg.first_public_source,
      cg.source_citation_id,
      length(cg.cryptonym) as crypto_len
    from jfk_curated.jfk_topic_batch_questions q
    join jfk_curated.cryptonym_glossary cg
      on cg.status = 'declassified'
     and (
       regexp_contains(upper(q.question), concat(r'\b', cg.cryptonym, r'\b'))
       or regexp_contains(upper(coalesce(q.summary, '')), concat(r'\b', cg.cryptonym, r'\b'))
     )
    where q.status is null or q.status = 'open'
  ),
  picked as (
    select * from matches
    qualify row_number() over (
      partition by batch_num, question_index
      order by crypto_len desc
    ) = 1
  ),
  citations as (
    select
      batch_num,
      question_index,
      array_agg(distinct source_citation_id ignore nulls) as resolution_citation_ids
    from matches
    where source_citation_id != ''
    group by batch_num, question_index
  )
  select
    p.batch_num,
    p.question_index,
    concat(
      p.cryptonym, ' is ', p.meaning,
      ' First publicly identified in: ', p.first_public_source, '.'
    ) as resolution_text,
    coalesce(c.resolution_citation_ids, []) as resolution_citation_ids
  from picked p
  left join citations c using (batch_num, question_index)
) m
on  q.batch_num      = m.batch_num
and q.question_index = m.question_index
when matched then update set
  status                  = 'resolved',
  resolution_text         = m.resolution_text,
  resolution_citation_ids = m.resolution_citation_ids;

-- Default any remaining null statuses to 'open' so the UI never sees null.
update jfk_curated.jfk_topic_batch_questions
   set status = 'open'
 where status is null;
