-- 26_topic_articles.sql
--
-- Purpose:
--   Generate long-form (~600-900 word) analysis articles per topic,
--   with inline citations, via Vertex AI Gemini 2.5 Pro. Writes to
--   `jfk_curated.jfk_topic_articles` (one row per slug). Displayed as
--   the "Long-form analysis" option on the /topic/[slug] page.
--
-- Dependencies:
--   - jfk_curated.gemini_pro  (sql/24_remote_models.sql)
--   - jfk_mvp.<topic>_docs    (sql/21_mvp_topic_views.sql)
--
-- Citation format:
--   The prompt asks the model to emit `[doc:<document_id>]` tokens
--   inline after factual claims. The UI layer parses those tokens,
--   dedupes them, and renders superscript links to /document/<id>.
--
-- Cost:
--   6 topics × ~6k input / ~1.2k output tokens on Gemini 2.5 Pro =
--   a few cents per rebuild. Pair with --skip-summaries on the rebuild
--   script to omit both AI steps during local iterations.

-- ---------------------------------------------------------------------
-- Build a richer prompt context than 25_topic_summaries: 30 docs per
-- topic, longer description excerpts (450 chars), and explicit
-- instructions to cite specific document_ids.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_article_input as
with topic_meta as (
  select 'warren-commission' as slug, 'Warren Commission' as title,
         'Presidential commission led by Chief Justice Earl Warren that produced the first federal report on the assassination (1963-1964).' as seed
  union all select 'hsca', 'House Select Committee on Assassinations',
         'Congressional re-investigation that examined acoustic, medical, and intelligence evidence a decade after the Warren Report (1976-1979).'
  union all select 'mexico-city', 'Mexico City',
         'Oswald\'s documented visit to Mexico City and the CIA station\'s surveillance of the Cuban and Soviet embassies (Sep-Oct 1963).'
  union all select 'cia', 'CIA Records',
         'Agency records spanning Oswald\'s 201 file, the Directorate of Plans, and the Mexico City and Miami stations.'
  union all select 'fbi', 'FBI Records',
         'Bureau files comprising the Oswald HQ and Dallas Field Office investigations and the Ruby case.'
  union all select 'cuba', 'Cuba & Cuban Exiles',
         'Records concerning Cuba, Fidel Castro, anti-Castro exile activity, and related Agency operations.'
),
all_docs as (
  select 'warren-commission' as slug, r.document_id, r.title as doc_title,
         r.description as doc_description, r.agency, r.start_date, r.pages_released
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
  select *,
         row_number() over (
           partition by slug
           order by pages_released desc nulls last, start_date desc nulls last
         ) as rn
  from all_docs
),
top_docs as (select * from ranked where rn <= 30),
topic_context as (
  select
    m.slug,
    m.title,
    array_agg(td.document_id order by td.rn) as source_doc_ids,
    concat(
      'You are a research analyst writing a long-form analysis article on a topic drawn from the JFK Assassination Records Collection at the U.S. National Archives (records released under the JFK Records Act: FBI, CIA, Warren Commission, HSCA, and related files).\n\n',
      'Topic: ', any_value(m.title), '\n',
      'Background: ', any_value(m.seed), '\n\n',
      'You have been given a sample of 30 records from the collection. Each line below contains document_id | title | agency | date | description excerpt:\n',
      string_agg(
        format('%s | %s | %s | %s | %s',
          td.document_id,
          ifnull(td.doc_title, ''),
          ifnull(td.agency, '?'),
          ifnull(cast(td.start_date as string), '?'),
          substr(ifnull(td.doc_description, ''), 1, 450)
        ),
        '\n' order by td.rn
      ),
      '\n\nWrite a 600-900 word analysis article that synthesizes what the collection reveals about this topic. Cover (a) historical context and significance, (b) the types of records held and what they document, (c) notable patterns, timeframes, or connecting threads across the records, and (d) what a researcher approaching this topic should understand going in.\n\n',
      'CITATION FORMAT: When you make a specific claim grounded in one of the sample records, immediately follow the sentence with an inline citation token in the exact form [doc:<document_id>] — using the document_id from the sample above. Examples:\n',
      '  The commission relied heavily on FBI interview reports [doc:104-10004-10143].\n',
      '  Memoranda between the CIA and the Commission reveal coordination on witness lists [doc:124-10004-10022][doc:104-10012-10432].\n',
      'Every factual paragraph should contain at least two citation tokens. Cite only document_ids that appear in the sample above — do NOT invent ids or cite external sources.\n\n',
      'STYLE RULES:\n',
      '- Plain prose only. No headings, bullets, or markdown formatting.\n',
      '- Separate paragraphs with a blank line.\n',
      '- Neutral, archival, analytical tone. Not conspiratorial.\n',
      '- Ground every non-trivial claim in the sample records (via citation) or in well-known, uncontroversial historical facts (no citation needed for those).\n',
      '- Do not invent specific quotes, names, or dates that do not appear in the sample.\n',
      '- Do not mention that you were shown a sample, that this is an article, or that you are an AI.\n',
      '- Write in the third person throughout.'
    ) as prompt
  from topic_meta m
  join top_docs td using (slug)
  group by m.slug, m.title
)
select * from topic_context;

-- ---------------------------------------------------------------------
-- Call Gemini Pro once per topic and stash the raw output in a staging
-- table. We validate citations in the next step.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_article_raw as
select
  slug,
  title,
  ml_generate_text_llm_result as raw_article,
  source_doc_ids
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select slug, title, source_doc_ids, prompt from jfk_curated._topic_article_input),
  struct(
    0.3 as temperature,
    4096 as max_output_tokens,
    true as flatten_json_output
  )
);

-- ---------------------------------------------------------------------
-- Strip [doc:<id>] citations whose id is NOT in source_doc_ids. The
-- model occasionally emits ids that look real but aren't in the sample;
-- unchecked they would render as broken links. A JS UDF keeps the
-- cleanup step inline (temp functions are in-query only, so the final
-- table write lives in the same statement).
-- ---------------------------------------------------------------------
create temp function strip_invalid_citations(article string, valid_ids array<string>)
returns struct<cleaned string, stripped array<string>>
language js as """
  const set = new Set(valid_ids);
  const stripped = [];
  const cleaned = article.replace(/\\[doc:([^\\]]+)\\]/g, (match, id) => {
    const trimmed = id.trim();
    if (set.has(trimmed)) return match;
    stripped.push(trimmed);
    return '';
  });
  return { cleaned: cleaned, stripped: stripped };
""";

create or replace table jfk_curated.jfk_topic_articles as
with cleaned as (
  select
    slug,
    title,
    strip_invalid_citations(raw_article, source_doc_ids) as c,
    source_doc_ids
  from jfk_curated._topic_article_raw
)
select
  slug,
  title,
  c.cleaned as article,
  c.stripped as invalid_citation_ids,
  array_length(c.stripped) as invalid_citation_count,
  source_doc_ids,
  array_length(source_doc_ids) as source_doc_count,
  'gemini-2.5-pro' as model,
  current_timestamp() as generated_at
from cleaned;

drop table if exists jfk_curated._topic_article_input;
drop table if exists jfk_curated._topic_article_raw;
