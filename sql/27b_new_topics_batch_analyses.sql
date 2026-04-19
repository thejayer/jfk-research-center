-- 27b_new_topics_batch_analyses.sql
--
-- Purpose:
--   Run the Phase 2-B Open-Questions MAP stage on ONLY the 5 new topics
--   added in sql/21b (tippit-murder, dealey-plaza, church-committee,
--   arrb-releases, mob-castro-plots). Appends into
--   jfk_topic_batch_questions rather than CREATE OR REPLACE, so the
--   existing 6 topics\' batches are preserved and we avoid the ~$25
--   cost of re-running the MAP stage over CIA and FBI.
--
--   The prompt structure + validator logic mirror sql/27 verbatim; keep
--   the two files in sync if the prompt changes. Re-running this file
--   deduplicates by slug (DELETE then INSERT) so it\'s idempotent.
--
-- Dependencies:
--   - jfk_curated.gemini_pro              (sql/24)
--   - jfk_mvp.{tippit_murder,dealey_plaza,church_committee,
--              arrb_releases,mob_castro_plots}_docs  (sql/21b)
--
-- Cost:
--   ~22 batches × ~$0.10/batch on Gemini 2.5 Pro ≈ $2-3 per rebuild.

-- Clear any prior rows for the new topics so re-runs overwrite cleanly.
delete from jfk_curated.jfk_topic_batch_questions
where slug in (
  'tippit-murder', 'dealey-plaza', 'church-committee',
  'arrb-releases', 'mob-castro-plots'
);

create or replace table jfk_curated._new_topics_batch_input as
with topic_meta as (
  select 'tippit-murder' as slug, 'Tippit Murder' as title union all
  select 'dealey-plaza', 'Dealey Plaza' union all
  select 'church-committee', 'Church Committee' union all
  select 'arrb-releases', 'ARRB & Declassification' union all
  select 'mob-castro-plots', 'Organized Crime & Castro Plots'
),
all_topic_docs as (
  select 'tippit-murder' as slug, r.document_id, r.title, r.description,
         r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.tippit_murder_docs` r where r.title is not null
  union all
  select 'dealey-plaza', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.dealey_plaza_docs` r where r.title is not null
  union all
  select 'church-committee', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.church_committee_docs` r where r.title is not null
  union all
  select 'arrb-releases', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.arrb_releases_docs` r where r.title is not null
  union all
  select 'mob-castro-plots', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.mob_castro_plots_docs` r where r.title is not null
),
ranked as (
  select
    slug, document_id, title, description, agency, start_date, pages_released,
    row_number() over (
      partition by slug
      order by pages_released desc nulls last, start_date desc nulls last, document_id
    ) as rn
  from all_topic_docs
),
with_batch as (
  select *, div(rn - 1, 150) as batch_num
  from ranked
),
batches as (
  select
    slug,
    batch_num,
    count(*) as doc_count_in_batch,
    array_agg(document_id order by rn) as doc_ids,
    string_agg(
      format('%s | %s | %s | %s | %s',
        document_id,
        ifnull(title, ''),
        ifnull(agency, '?'),
        ifnull(cast(start_date as string), '?'),
        substr(ifnull(description, ''), 1, 450)
      ),
      '\n' order by rn
    ) as doc_list
  from with_batch
  group by slug, batch_num
),
batch_input as (
  select
    b.slug,
    b.batch_num,
    b.doc_count_in_batch,
    b.doc_ids,
    m.title as topic_title,
    concat(
      'You are a research analyst reading records from the JFK Assassination Records Collection at the U.S. National Archives (records released under the JFK Records Act: FBI, CIA, Warren Commission, HSCA, and related files).\n\n',
      'Topic: ', m.title, '\n',
      'Batch: ', cast(b.batch_num + 1 as string), ' — this is one slice of the full topic. ',
      'You are seeing ', cast(b.doc_count_in_batch as string), ' records. Other batches cover the rest of the topic; do NOT try to summarize the whole topic.\n\n',
      'Each line below is one record: document_id | title | agency | date | description excerpt\n\n',
      b.doc_list,
      '\n\nTASK: Identify up to 5 OPEN QUESTIONS suggested by these specific records. An open question is anything a careful archival researcher would flag as worth more investigation — a contradiction between records, a timing oddity, a redaction pattern, an unexplained reference, a gap or anomaly. Ignore records that are routine or unremarkable; if nothing in this batch is noteworthy, return an empty array.\n\n',
      'RULES:\n',
      '- Neutral, archival tone. Do NOT assert that any theory is correct. Do NOT advocate for or against the official account. Simply note what is in tension, missing, or unexplained.\n',
      '- Every question must cite at least one document_id from the batch above via the supporting_doc_ids field. Do not invent ids or cite anything outside the batch.\n',
      '- A single question should be grounded in real material from the records shown, not speculation.\n',
      '- Keep each question to a single clear sentence. The summary expands on it in 2-4 neutral sentences.\n',
      '- tension_type must be one of: contradiction, timing, redaction, unexplained_reference, pattern, gap.\n\n',
      'Return STRICT JSON matching this exact shape and NOTHING else (no markdown fencing, no prose):\n',
      '{"questions": [\n',
      '  {"question": "<one-sentence question>", "summary": "<2-4 neutral sentences>", "supporting_doc_ids": ["<id1>", "<id2>"], "tension_type": "<category>"}\n',
      ']}\n\n',
      'If nothing is noteworthy, return: {"questions": []}'
    ) as prompt
  from batches b
  join topic_meta m using (slug)
)
select * from batch_input;

create or replace table jfk_curated._new_topics_batch_raw as
select
  slug,
  batch_num,
  doc_count_in_batch,
  doc_ids,
  topic_title,
  ml_generate_text_llm_result as raw_response
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select slug, batch_num, doc_count_in_batch, doc_ids, topic_title, prompt
     from jfk_curated._new_topics_batch_input),
  struct(
    0.2 as temperature,
    2048 as max_output_tokens,
    true as flatten_json_output
  )
);

create temp function filter_valid_ids(ids array<string>, valid array<string>)
returns array<string>
language js as """
  const set = new Set(valid);
  return (ids || []).filter((id) => set.has((id || '').trim()));
""";

insert into jfk_curated.jfk_topic_batch_questions (
  slug, batch_num, question_index, topic_title, question, summary,
  supporting_doc_ids, tension_type, model, generated_at
)
with parsed as (
  select
    slug, batch_num, doc_ids, topic_title,
    regexp_replace(
      regexp_replace(raw_response, r'^\s*```(?:json)?\s*', ''),
      r'\s*```\s*$', ''
    ) as cleaned
  from jfk_curated._new_topics_batch_raw
  where raw_response is not null
),
questions_raw as (
  select slug, batch_num, doc_ids, topic_title,
         json_query_array(cleaned, '$.questions') as q_array
  from parsed
),
exploded as (
  select slug, batch_num, doc_ids, topic_title, q_elem, q_idx
  from questions_raw, unnest(q_array) q_elem with offset q_idx
  where q_array is not null
)
select
  slug, batch_num, q_idx as question_index, topic_title,
  json_value(q_elem, '$.question')                               as question,
  json_value(q_elem, '$.summary')                                as summary,
  filter_valid_ids(
    array(select json_value(x) from unnest(json_query_array(q_elem, '$.supporting_doc_ids')) x),
    doc_ids
  )                                                              as supporting_doc_ids,
  json_value(q_elem, '$.tension_type')                           as tension_type,
  'gemini-2.5-pro'                                               as model,
  current_timestamp()                                            as generated_at
from exploded
where json_value(q_elem, '$.question') is not null;

drop table if exists jfk_curated._new_topics_batch_input;
drop table if exists jfk_curated._new_topics_batch_raw;
