-- 27_topic_batch_analyses.sql
--
-- Purpose:
--   MAP STAGE of the "Open Questions" pipeline. Unlike sql/26 (which
--   samples 30 docs per topic), this reads EVERY record in each topic,
--   breaks them into batches of BATCH_SIZE docs, and asks Gemini 2.5
--   Pro to extract unresolved threads / contradictions / open questions
--   from each batch as structured JSON. The REDUCE stage in sql/28
--   merges/dedupes/ranks the results into a per-topic long-form article.
--
-- Output:
--   jfk_curated.jfk_topic_batch_questions — one row per open question,
--     with (slug, batch_num, question, summary, supporting_doc_ids,
--     tension_type). Plus a raw table jfk_curated._topic_batch_raw for
--     audit / debug.
--
-- Framing:
--   This is NOT a conspiracy page. The prompt asks the model to note
--   what is in tension, missing, or unexplained — without drawing any
--   conclusion about whether the official account is correct. See
--   CLAUDE.md (neutral-framing principle).
--
-- Dependencies:
--   - jfk_curated.gemini_pro   (sql/24_remote_models.sql)
--   - jfk_mvp.<topic>_docs     (sql/21_mvp_topic_views.sql)
--
-- Cost:
--   Topic sizes (as of Apr 2026): WC 129, HSCA 1,834, MX 2,086, CIA
--   17,194, FBI 18,713, CUBA 2,844. At BATCH_SIZE=150 that is ~287
--   batches × ~75k input / ~1k output tokens on Gemini 2.5 Pro, i.e.
--   on the order of ~$25-30 per full rebuild. Gated behind both
--   --skip-summaries and --skip-open-questions in rebuild_warehouse.sh.

-- Keep BATCH_SIZE in lockstep with the value used to build the prompt
-- context below. Changing it changes cost (bigger batch = fewer calls).

-- ---------------------------------------------------------------------
-- Assemble every record in every topic into a single stream, row-number
-- them per slug, and group into deterministic batches.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_batch_input as
with topic_meta as (
  select 'warren-commission' as slug, 'Warren Commission' as title union all
  select 'hsca', 'House Select Committee on Assassinations' union all
  select 'mexico-city', 'Mexico City' union all
  select 'cia', 'CIA Records' union all
  select 'fbi', 'FBI Records' union all
  select 'cuba', 'Cuba & Cuban Exiles'
),
all_topic_docs as (
  select 'warren-commission' as slug, r.document_id, r.title, r.description,
         r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.warren_commission_docs` r where r.title is not null
  union all
  select 'hsca', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.hsca_docs` r where r.title is not null
  union all
  select 'mexico-city', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.mexico_city_docs` r where r.title is not null
  union all
  select 'cia', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.cia_docs` r where r.title is not null
  union all
  select 'fbi', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.fbi_docs` r where r.title is not null
  union all
  select 'cuba', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
    from `jfk-vault.jfk_mvp.cuba_docs` r where r.title is not null
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

-- ---------------------------------------------------------------------
-- Fan out: one Gemini Pro call per batch.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_batch_raw as
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
     from jfk_curated._topic_batch_input),
  struct(
    0.2 as temperature,
    2048 as max_output_tokens,
    true as flatten_json_output
  )
);

-- ---------------------------------------------------------------------
-- Parse the JSON responses and explode into one row per question.
-- Strip any supporting_doc_id that isn't actually in the batch's doc_ids
-- (same protection as sql/26's citation validator).
-- ---------------------------------------------------------------------
create temp function filter_valid_ids(ids array<string>, valid array<string>)
returns array<string>
language js as """
  const set = new Set(valid);
  return (ids || []).filter((id) => set.has((id || '').trim()));
""";

create or replace table jfk_curated.jfk_topic_batch_questions as
with parsed as (
  -- Some Gemini responses come wrapped in ```json fences despite the
  -- instruction; strip them defensively before JSON parsing.
  select
    slug,
    batch_num,
    doc_ids,
    topic_title,
    regexp_replace(
      regexp_replace(raw_response, r'^\s*```(?:json)?\s*', ''),
      r'\s*```\s*$', ''
    ) as cleaned
  from jfk_curated._topic_batch_raw
  where raw_response is not null
),
questions_raw as (
  select
    slug,
    batch_num,
    doc_ids,
    topic_title,
    json_query_array(cleaned, '$.questions') as q_array
  from parsed
),
exploded as (
  select
    slug,
    batch_num,
    doc_ids,
    topic_title,
    q_elem,
    q_idx
  from questions_raw, unnest(q_array) q_elem with offset q_idx
  where q_array is not null
)
select
  slug,
  batch_num,
  q_idx as question_index,
  topic_title,
  json_value(q_elem, '$.question') as question,
  json_value(q_elem, '$.summary') as summary,
  filter_valid_ids(
    array(
      select json_value(x)
      from unnest(json_query_array(q_elem, '$.supporting_doc_ids')) x
    ),
    doc_ids
  ) as supporting_doc_ids,
  json_value(q_elem, '$.tension_type') as tension_type,
  'gemini-2.5-pro' as model,
  current_timestamp() as generated_at
from exploded
where json_value(q_elem, '$.question') is not null;

drop table if exists jfk_curated._topic_batch_input;
-- keep _topic_batch_raw for audit; small table, and useful when the
-- JSON parser fails on a specific batch's output.
