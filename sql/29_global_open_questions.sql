-- 29_global_open_questions.sql
--
-- Purpose:
--   CROSS-TOPIC SYNTHESIS. Reads the per-topic open-questions articles
--   produced by sql/28 and writes a single landing-page article that
--   surfaces threads that cut across multiple topics (e.g. a Mexico
--   City / CIA reporting inconsistency that also shows up in HSCA
--   review files).
--
-- Output:
--   jfk_curated.jfk_global_open_questions — one row, slug = 'global'.
--   Contains the hero article (with [doc:id] citations) for the
--   /open-questions landing page.
--
-- Framing reminder:
--   Same rules as sql/27 and sql/28 — surface tensions, do not
--   adjudicate them.
--
-- Cost:
--   1 call × ~15k input / ~2k output tokens on Pro = a few cents.

-- ---------------------------------------------------------------------
-- Bundle all per-topic articles into one prompt + build the citation
-- whitelist as the union of every source_doc_id across topics.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._global_open_questions_input as
with valid_pool as (
  select array_agg(distinct id) as valid_ids
    from jfk_curated.jfk_topic_open_questions,
         unnest(source_doc_ids) id
),
bundled as (
  select
    string_agg(
      concat('### ', topic_title, '\n\n', article),
      '\n\n---\n\n' order by slug
    ) as all_articles,
    count(*) as topic_count
  from jfk_curated.jfk_topic_open_questions
  where article is not null and length(article) > 0
),
prompt_build as (
  select
    b.topic_count,
    v.valid_ids,
    concat(
      'You are writing the landing-page article for a feature called "Open Questions" on an archival research site for the JFK Assassination Records Collection.\n\n',
      'Each topic in the collection already has its own Open Questions article. You are given the full text of those articles below, separated by horizontal rules. Your job is to synthesize a CROSS-CUTTING article that surfaces the threads that appear in more than one topic, and to orient a new reader to what kinds of unresolved material the collection as a whole contains.\n\n',
      '--- per-topic articles begin ---\n\n',
      b.all_articles,
      '\n\n--- per-topic articles end ---\n\n',
      'Write a ', '600-900', ' word article for the landing page. Structure:\n',
      '- Opening: what the reader is looking at and how to approach it — a records collection with genuine ambiguities, not a closed case but also not proof of any particular alternative theory.\n',
      '- 3-5 body paragraphs, each devoted to ONE cross-cutting thread that appears in more than one topic above. Name the topics it connects. Cite specific records.\n',
      '- Closing: a paragraph on what stays out of reach given what has been released, and an invitation to explore per-topic detail.\n\n',
      'CITATION FORMAT: append [doc:<document_id>] immediately after factual claims, using ONLY ids that appeared in the per-topic articles above (they are the only valid citation targets). Do not invent ids.\n\n',
      'STYLE RULES:\n',
      '- Neutral, archival, analytical tone. No conspiracy advocacy. No defense of any official account either. Surface tensions, do not resolve them.\n',
      '- Plain prose, no headings, no bullets, no markdown. Paragraphs separated by a blank line.\n',
      '- Third person throughout.\n',
      '- Do not mention that you were given per-topic articles, that this is AI-generated, or that a pipeline produced the inputs.\n',
      '- Where a thread could be read multiple ways, present the readings side-by-side with language like "the record is consistent with both X and Y."'
    ) as prompt
  from bundled b, valid_pool v
)
select * from prompt_build;

-- ---------------------------------------------------------------------
-- Call Gemini once to produce the global article.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._global_open_questions_raw as
select
  valid_ids,
  topic_count,
  ml_generate_text_llm_result as raw_article
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select valid_ids, topic_count, prompt
     from jfk_curated._global_open_questions_input),
  struct(
    0.3 as temperature,
    4096 as max_output_tokens,
    true as flatten_json_output
  )
);

-- ---------------------------------------------------------------------
-- Same citation-validation UDF as sql/28, then persist.
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

create or replace table jfk_curated.jfk_global_open_questions as
with cleaned as (
  select
    strip_invalid_citations(raw_article, valid_ids) as c,
    valid_ids,
    topic_count
  from jfk_curated._global_open_questions_raw
)
select
  'global' as slug,
  c.cleaned as article,
  c.stripped as invalid_citation_ids,
  array_length(c.stripped) as invalid_citation_count,
  valid_ids as source_doc_ids,
  array_length(valid_ids) as source_doc_count,
  topic_count,
  'gemini-2.5-pro' as model,
  current_timestamp() as generated_at
from cleaned;

drop table if exists jfk_curated._global_open_questions_input;
drop table if exists jfk_curated._global_open_questions_raw;
