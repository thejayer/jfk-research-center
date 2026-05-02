-- 51_release_topic_addenda.sql
--
-- Purpose:
--   Per-(topic, release_set) addendum articles GROUNDED IN OCR EXCERPTS.
--   Unlike sql/26 (topic articles, metadata-only prompt), this builds
--   chunk-rich prompts so Gemini cites specific passages from the actual
--   release text, not just descriptions.
--
--   Initial scope: the 2021 NARA release × {mexico-city, cuba,
--   mob-castro-plots}. Surfaces what the FBI Mexico legat backlog,
--   the Oswald 201 file, and AMLASH-related material contribute that
--   the older metadata-only articles couldn't see.
--
-- Output:
--   jfk_curated.jfk_topic_release_addenda — one row per (slug,
--   release_set). Surfaced on /topic/[slug] as a "What the {release}
--   release reveals" section underneath the existing long-form article.
--
-- Cost:
--   3 topics × 1 Gemini Pro call. Per-topic prompt is ~50-90 KB
--   (25 docs × up to 5 chunks × 1k chars). Roughly $0.50-1.00 per run.
--
-- Idempotent: re-runs DELETE+INSERT for the (slug, release_set) keys
--   that this run produces, leaving any other rows untouched.
--
-- Dependencies:
--   - jfk_curated.gemini_pro                                  (sql/24)
--   - jfk_curated.jfk_text_chunks                             (sql/11)
--   - jfk_curated.jfk_records                                 (sql/10)
--   - jfk_mvp.{mexico_city,cuba,mob_castro_plots}_docs        (sql/21, 21b)

-- ---------------------------------------------------------------------
-- 1. Pick top 25 docs per topic from the target release, by num_pages.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._release_addenda_input as
with topic_meta as (
  select 'mexico-city'      as slug, 'Mexico City' as title,
         '2021'              as release_set,
         'NARA JFK Records release, October 2021' as release_label union all
  select 'cuba',              'Cuba & Cuban Exiles',
         '2021', 'NARA JFK Records release, October 2021' union all
  select 'mob-castro-plots',  'Organized Crime & Castro Plots',
         '2021', 'NARA JFK Records release, October 2021'
),
topic_docs as (
  select 'mexico-city' as slug, r.document_id, r.title as doc_title,
         r.description, r.agency, r.num_pages
    from `jfk-vault.jfk_mvp.mexico_city_docs` r
    join `jfk-vault.jfk_curated.jfk_records`  j using (document_id)
    where j.release_set = '2021'
  union all
  select 'cuba', r.document_id, r.title, r.description, r.agency, r.num_pages
    from `jfk-vault.jfk_mvp.cuba_docs` r
    join `jfk-vault.jfk_curated.jfk_records` j using (document_id)
    where j.release_set = '2021'
  union all
  select 'mob-castro-plots', r.document_id, r.title, r.description, r.agency, r.num_pages
    from `jfk-vault.jfk_mvp.mob_castro_plots_docs` r
    join `jfk-vault.jfk_curated.jfk_records` j using (document_id)
    where j.release_set = '2021'
),
ranked_docs as (
  select
    slug, document_id, doc_title, description, agency, num_pages,
    row_number() over (
      partition by slug
      order by num_pages desc nulls last, document_id
    ) as rn
  from topic_docs
),
top_docs as (
  select * from ranked_docs where rn <= 25
),

-- ---------------------------------------------------------------------
-- 2. For each top doc, grab up to 5 representative chunks: first,
--    early-body (#5), middle, three-quarter, last. Skip very short
--    chunks (<80 chars) — usually OCR noise, not substance.
-- ---------------------------------------------------------------------
chunk_picks as (
  select
    t.slug, t.document_id, t.doc_title, t.description, t.agency, t.num_pages,
    c.chunk_order, c.chunk_text, c.page_label,
    row_number() over (partition by t.slug, t.document_id order by c.chunk_order) as chunk_rn,
    count(*)     over (partition by t.slug, t.document_id) as chunk_total
  from top_docs t
  join `jfk-vault.jfk_curated.jfk_text_chunks` c using (document_id)
  where c.source_type in ('docai_ocr', 'abbyy_ocr')
    and c.chunk_text is not null
    and length(trim(c.chunk_text)) >= 80
),
selected_chunks as (
  select distinct
    slug, document_id, doc_title, description, agency, num_pages,
    chunk_order, chunk_text, page_label
  from chunk_picks
  where chunk_rn = 1
     or chunk_rn = least(5, chunk_total)
     or chunk_rn = cast(chunk_total / 2 as int64)
     or chunk_rn = cast(chunk_total * 3 / 4 as int64)
     or chunk_rn = chunk_total
),

-- ---------------------------------------------------------------------
-- 3. Per-doc excerpt block (chunks formatted in chunk_order).
-- ---------------------------------------------------------------------
doc_excerpt as (
  select
    slug, document_id,
    any_value(doc_title)   as doc_title,
    any_value(description) as description,
    any_value(agency)      as agency,
    any_value(num_pages)   as num_pages,
    string_agg(
      format('  [chunk %d, page %s]\n  %s',
        chunk_order,
        ifnull(page_label, '?'),
        substr(chunk_text, 1, 1000)
      ),
      '\n\n' order by chunk_order
    ) as excerpts
  from selected_chunks
  group by slug, document_id
),

-- ---------------------------------------------------------------------
-- 4. Per-topic bundle of all doc blocks + valid-id whitelist.
-- ---------------------------------------------------------------------
topic_bundle as (
  select
    slug,
    string_agg(
      format(
        'DOCUMENT %s — %s (%s, %s pages)\n  Description: %s\n%s',
        document_id,
        ifnull(doc_title, 'Untitled Record'),
        ifnull(agency, '?'),
        ifnull(cast(num_pages as string), '?'),
        substr(ifnull(description, ''), 1, 200),
        excerpts
      ),
      '\n\n---\n\n'
    ) as doc_block,
    array_agg(distinct document_id) as source_doc_ids
  from doc_excerpt
  group by slug
),

-- ---------------------------------------------------------------------
-- 5. Build the prompt. Same neutrality rules as sql/26 + sql/28.
-- ---------------------------------------------------------------------
prompt_build as (
  select
    m.slug,
    m.title       as topic_title,
    m.release_set,
    m.release_label,
    b.source_doc_ids,
    array_length(b.source_doc_ids) as source_doc_count,
    concat(
      'You are a research analyst writing a short addendum section for an archival research site on the JFK Assassination Records Collection.\n\n',
      'Topic: ', m.title, '\n',
      'Release: ', m.release_label, '\n\n',
      'Below are excerpts from the actual OCR text of the most substantial ', m.release_set, ' release documents that fall under this topic. Each block is one document, identified by its NARA record number, with up to five short excerpts pulled from the start, body, middle, three-quarter, and end of the file. OCR is imperfect; treat fragmentary passages as fragmentary.\n\n',
      b.doc_block,
      '\n\nTASK: Write a 400-600 word analytical section. The user is reading the topic page and already saw a generic summary above; THIS section should answer "what does the ', m.release_set, ' release specifically contribute to ', m.title, '" — what kinds of records, what threads, what operational detail.\n\n',
      'GUIDELINES:\n',
      '- Ground every specific factual claim in the excerpts above. After any sentence that makes a specific claim, append [doc:<document_id>] using a record number from the blocks above.\n',
      '- Quote evocative or contested phrases verbatim, in quotation marks, when they sharpen the point.\n',
      '- Do NOT invent content. If an excerpt is partial or noisy, say so or skip it.\n',
      '- Do NOT write generic background you would have written without these excerpts. The whole point is to add specifics tied to THIS material.\n',
      '- Neutral, archival tone. Surface tensions; do not adjudicate them. Phrasing like "the cable suggests" or "the file documents" is preferred over "this proves".\n',
      '- Plain prose, no headings, no bullets, no markdown. 3-5 paragraphs separated by blank lines. Third person.\n',
      '- Cite ONLY document_ids that appear above. Every factual paragraph should contain at least two citation tokens.\n',
      '- Do NOT mention that you were given excerpts, that this is AI-generated, or that it is an addendum. Just write the section.\n\n',
      'Begin now.'
    ) as prompt
  from topic_meta m
  join topic_bundle b using (slug)
)
select * from prompt_build;

-- ---------------------------------------------------------------------
-- 6. One Gemini Pro call per topic.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._release_addenda_raw as
select
  slug,
  topic_title,
  release_set,
  source_doc_ids,
  source_doc_count,
  ml_generate_text_llm_result as raw_article
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select slug, topic_title, release_set, source_doc_ids, source_doc_count, prompt
     from jfk_curated._release_addenda_input),
  struct(
    0.3 as temperature,
    4096 as max_output_tokens,
    true as flatten_json_output
  )
);

-- ---------------------------------------------------------------------
-- 7. Strip [doc:id] tokens for ids not in the source whitelist.
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

-- ---------------------------------------------------------------------
-- 8. Idempotent persist: ensure the table exists, delete this run's
--    keys, then insert.
-- ---------------------------------------------------------------------
create table if not exists jfk_curated.jfk_topic_release_addenda (
  slug                    string,
  topic_title             string,
  release_set             string,
  article                 string,
  invalid_citation_ids    array<string>,
  invalid_citation_count  int64,
  source_doc_ids          array<string>,
  source_doc_count        int64,
  model                   string,
  generated_at            timestamp
);

delete from jfk_curated.jfk_topic_release_addenda
where slug in ('mexico-city', 'cuba', 'mob-castro-plots')
  and release_set = '2021';

insert into jfk_curated.jfk_topic_release_addenda
select
  slug,
  topic_title,
  release_set,
  c.cleaned                                  as article,
  c.stripped                                 as invalid_citation_ids,
  array_length(c.stripped)                   as invalid_citation_count,
  source_doc_ids,
  source_doc_count,
  'gemini-2.5-pro'                           as model,
  current_timestamp()                        as generated_at
from (
  select
    slug, topic_title, release_set, source_doc_ids, source_doc_count,
    strip_invalid_citations(raw_article, source_doc_ids) as c
  from jfk_curated._release_addenda_raw
);

drop table if exists jfk_curated._release_addenda_input;
-- keep _release_addenda_raw for audit; small table, useful for debugging
-- if a topic's article comes back malformed.
