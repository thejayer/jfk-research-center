-- 28_topic_open_questions.sql
--
-- Purpose:
--   REDUCE STAGE of the "Open Questions" pipeline. Takes the per-batch
--   questions from sql/27 and synthesizes one long-form article per
--   topic: merge near-duplicates, cluster related threads, rank by
--   evidentiary weight, and write a neutral analytical piece with
--   inline [doc:<id>] citations. Writes to
--   `jfk_curated.jfk_topic_open_questions` (one row per slug).
--
-- Dependencies:
--   - jfk_curated.jfk_topic_batch_questions (sql/27)
--   - jfk_curated.gemini_pro (sql/24)
--
-- Framing reminder:
--   Same constraints as sql/27. The article surfaces tensions; it does
--   not adjudicate them. See CLAUDE.md neutral-framing principle.
--
-- Cost:
--   6 topics × ~30k input / ~3k output tokens = roughly $0.30 total per
--   rebuild. Negligible next to sql/27's map-stage cost.

-- ---------------------------------------------------------------------
-- Per-topic: assemble the bundle of batch-level questions plus the
-- union of all cited doc_ids (the citation whitelist for validation).
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_open_questions_input as
with exploded_ids as (
  select slug, id
    from jfk_curated.jfk_topic_batch_questions,
         unnest(supporting_doc_ids) id
),
topic_valid_ids as (
  select slug, array_agg(distinct id) as valid_ids
    from exploded_ids
   group by slug
),
topic_questions as (
  select
    slug,
    any_value(topic_title) as topic_title,
    count(*) as input_question_count,
    string_agg(
      format(
        '- Q: %s\n  Summary: %s\n  Cites: %s\n  Type: %s',
        ifnull(question, ''),
        ifnull(summary, ''),
        array_to_string(supporting_doc_ids, ', '),
        ifnull(tension_type, '?')
      ),
      '\n' order by batch_num, question_index
    ) as question_list
  from jfk_curated.jfk_topic_batch_questions
  group by slug
),
prompt_build as (
  select
    t.slug,
    t.topic_title,
    t.input_question_count,
    v.valid_ids,
    concat(
      'You are a research analyst writing the "Open Questions" article for one topic in an archival research site on the JFK Assassination Records Collection.\n\n',
      'Topic: ', t.topic_title, '\n\n',
      'An earlier pass of this pipeline read every record in the topic in batches and extracted candidate open questions. Many are redundant or near-duplicates. Your job is to synthesize them into a clean, readable long-form piece that captures the actual unresolved threads the collection raises.\n\n',
      'Candidate open questions extracted from the batches (in batch order):\n',
      t.question_list,
      '\n\nWrite a ', '700-1000', ' word article titled as if it were the body of a web page called "Open Questions in ', t.topic_title, '". Structure:\n',
      '- An opening paragraph (neutral) describing what kinds of tensions this topic contains and how to read them.\n',
      '- Then 4-7 paragraphs, each focused on ONE distinct thread (a contradiction, an unexplained reference, a redaction pattern, a timing oddity, or a structural gap). Merge near-duplicate candidate questions into a single thread.\n',
      '- A closing paragraph noting the limits of inference — what the records can and cannot tell us.\n\n',
      'CITATION FORMAT: immediately after any sentence that makes a specific factual claim grounded in a record, append [doc:<document_id>] — using an id from the "Cites:" lines above. Examples:\n',
      '  The station reported Oswald-s contact as routine [doc:104-10004-10143]. A later cable contradicts that framing [doc:104-10012-10432].\n',
      '  Every factual paragraph should contain at least two citation tokens.\n',
      'Cite only document_ids that appear in the candidate list — do NOT invent ids.\n\n',
      'STYLE RULES:\n',
      '- Neutral, archival, analytical tone. No advocacy. Do NOT argue that any particular theory is correct or incorrect. Surface the tension; do not resolve it.\n',
      '- Plain prose, no headings, no bullets, no markdown. Separate paragraphs with a blank line.\n',
      '- Third person throughout.\n',
      '- Do not mention that you were given a candidate list, that this is an AI output, or that batches were used.\n',
      '- If two candidates contradict each other, present BOTH framings rather than picking one.\n',
      '- Use phrasing like "the record is inconsistent on X" or "this leaves open the question of Y", not "this proves Z".'
    ) as prompt
  from topic_questions t
  join topic_valid_ids v using (slug)
)
select * from prompt_build;

-- ---------------------------------------------------------------------
-- Call Gemini once per topic.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_open_questions_raw as
select
  slug,
  topic_title,
  input_question_count,
  valid_ids,
  ml_generate_text_llm_result as raw_article
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select slug, topic_title, input_question_count, valid_ids, prompt
     from jfk_curated._topic_open_questions_input),
  struct(
    0.3 as temperature,
    6144 as max_output_tokens,
    true as flatten_json_output
  )
);

-- ---------------------------------------------------------------------
-- Strip [doc:<id>] tokens whose id isn't in the validated whitelist,
-- then persist the final article.
-- ---------------------------------------------------------------------
create temp function strip_invalid_citations(article string, valid array<string>)
returns struct<cleaned string, stripped array<string>>
language js as """
  const set = new Set(valid || []);
  const stripped = [];
  const cleaned = (article || '').replace(/\\[doc:([^\\]]+)\\]/g, (match, id) => {
    const trimmed = (id || '').trim();
    if (set.has(trimmed)) return match;
    stripped.push(trimmed);
    return '';
  });
  return { cleaned: cleaned, stripped: stripped };
""";

create or replace table jfk_curated.jfk_topic_open_questions as
with cleaned as (
  select
    slug,
    topic_title,
    input_question_count,
    valid_ids,
    strip_invalid_citations(raw_article, valid_ids) as c
  from jfk_curated._topic_open_questions_raw
)
select
  slug,
  topic_title,
  c.cleaned as article,
  c.stripped as invalid_citation_ids,
  array_length(c.stripped) as invalid_citation_count,
  valid_ids as source_doc_ids,
  array_length(valid_ids) as source_doc_count,
  input_question_count,
  'gemini-2.5-pro' as model,
  current_timestamp() as generated_at
from cleaned;

drop table if exists jfk_curated._topic_open_questions_input;
drop table if exists jfk_curated._topic_open_questions_raw;
