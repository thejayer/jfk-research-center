-- 26b_wc_rebalance.sql
--
-- Purpose:
--   Regenerate the Warren Commission topic article with a rebalanced
--   prompt that explicitly orders coverage: (1) the Commission's central
--   conclusions, (2) its methodology and evidentiary record, (3) known
--   agency withholdings and subsequent review (HSCA, NAS/Ramsey, ARRB).
--
--   The Phase-0 audit found the original shared prompt (sql/26) produced a
--   WC article that over-weighted CIA withholding vs. the Commission's
--   actual findings. This file updates only the `warren-commission` row in
--   `jfk_curated.jfk_topic_articles`; other topics are untouched.
--
-- Dependencies:
--   - jfk_curated.gemini_pro         (sql/24)
--   - jfk_mvp.warren_commission_docs (sql/21)
--   - jfk_curated.jfk_topic_articles (sql/26 — must have been run at
--     least once so the target row exists)
--
-- Cost: one Gemini Pro call, a few cents.

create or replace table jfk_curated._wc_rebalance_input as
with docs as (
  select
    r.document_id,
    r.title,
    r.description,
    r.agency,
    r.start_date,
    r.pages_released,
    row_number() over (
      order by r.pages_released desc nulls last, r.start_date desc nulls last
    ) as rn
  from `jfk-vault.jfk_mvp.warren_commission_docs` r
  where r.title is not null
),
top_docs as (select * from docs where rn <= 30)
select
  'warren-commission' as slug,
  'Warren Commission' as title,
  array_agg(td.document_id order by td.rn) as source_doc_ids,
  concat(
    'You are a research analyst writing a long-form analysis article for the Warren Commission topic page of an archival reading room of the JFK Assassination Records Collection at the U.S. National Archives.\n\n',
    'Background: The President\'s Commission on the Assassination of President Kennedy (Warren Commission) was established by Executive Order 11130 on November 29, 1963. Chaired by Chief Justice Earl Warren, it heard testimony from 552 witnesses across 26 volumes and published its 888-page report in September 1964.\n\n',
    'You have been given a sample of 30 records from the collection. Each line below contains document_id | title | agency | date | description excerpt:\n',
    string_agg(
      format('%s | %s | %s | %s | %s',
        td.document_id,
        ifnull(td.title, ''),
        ifnull(td.agency, '?'),
        ifnull(cast(td.start_date as string), '?'),
        substr(ifnull(td.description, ''), 1, 450)
      ),
      '\n' order by td.rn
    ),
    '\n\nWrite a 700-900 word analysis article about the Warren Commission as documented in this collection. You MUST cover the material in this order and in roughly these proportions:\n\n',
    '  (1) CONCLUSIONS — approximately 35-40%% of the article. State the Commission\'s central findings: that Lee Harvey Oswald acted alone in assassinating President Kennedy and murdering Officer J. D. Tippit; that no credible evidence of conspiracy was identified; and the single-bullet theory (that one round wounded both Kennedy and Governor Connally). Describe the evidentiary basis for these conclusions as it appears in the records.\n\n',
    '  (2) METHODOLOGY & RECORDS — approximately 30-35%%. Describe how the Commission worked: the 552 witnesses, the use of FBI and Secret Service investigative reports, the 26 volumes of hearings and exhibits, the staff memoranda, and what kinds of documents the Commission relied on.\n\n',
    '  (3) CRITICISM, WITHHOLDINGS & SUBSEQUENT REVIEW — approximately 25-30%%. Describe the known limits: materials withheld by the CIA or FBI from the Commission (where the records document this), criticisms that emerged, and how later bodies engaged with the work: HSCA (1979) affirmed most findings but concluded probable conspiracy on acoustic grounds; the NAS/Ramsey Panel (1982) rejected that acoustic finding; the ARRB (1994-98) added declassified material but did not overturn the Commission\'s core conclusions on the shooting itself.\n\n',
    'CITATION FORMAT: immediately after any sentence that makes a specific factual claim grounded in one of the sample records, append [doc:<document_id>] — using an id from the sample above. Every factual paragraph should contain at least two citation tokens. Cite only document_ids that appear in the sample — do NOT invent ids. General historical context (dates, statutory background, the existence of the HSCA and NAS Panel) does not require a citation.\n\n',
    'STYLE RULES:\n',
    '- Plain prose only. No headings, bullets, or markdown.\n',
    '- Separate paragraphs with a blank line.\n',
    '- Neutral, archival, analytical tone. Not conspiratorial, and not defensive of any orthodoxy.\n',
    '- Do NOT begin the article with criticisms, withholdings, or the phrase "despite". Begin with what the Commission concluded.\n',
    '- Do NOT use the words remarkably, curiously, suspiciously, conveniently, shadowy, mysterious, allegedly (unless inside a direct quote).\n',
    '- Do not invent specific quotes, names, or dates that do not appear in the sample.\n',
    '- Do not mention that you were shown a sample, that this is an article, or that you are an AI.\n',
    '- Write in the third person throughout.'
  ) as prompt
from top_docs td;

create or replace table jfk_curated._wc_rebalance_raw as
select
  slug,
  title,
  source_doc_ids,
  ml_generate_text_llm_result as raw_article
from ml.generate_text(
  model `jfk_curated.gemini_pro`,
  (select slug, title, source_doc_ids, prompt from jfk_curated._wc_rebalance_input),
  struct(
    0.3 as temperature,
    4096 as max_output_tokens,
    true as flatten_json_output
  )
);

-- Strip [doc:<id>] citations whose id is NOT in source_doc_ids.
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

-- MERGE the rebalanced row back into the shared jfk_topic_articles table.
merge `jfk_curated.jfk_topic_articles` t
using (
  select
    r.slug,
    r.title,
    strip_invalid_citations(r.raw_article, r.source_doc_ids) as c,
    r.source_doc_ids
  from jfk_curated._wc_rebalance_raw r
) s
on t.slug = s.slug
when matched then update set
  article                 = s.c.cleaned,
  invalid_citation_ids    = s.c.stripped,
  invalid_citation_count  = array_length(s.c.stripped),
  source_doc_ids          = s.source_doc_ids,
  source_doc_count        = array_length(s.source_doc_ids),
  model                   = 'gemini-2.5-pro',
  generated_at            = current_timestamp()
when not matched then insert (
  slug, title, article, invalid_citation_ids, invalid_citation_count,
  source_doc_ids, source_doc_count, model, generated_at
) values (
  s.slug, s.title, s.c.cleaned, s.c.stripped, array_length(s.c.stripped),
  s.source_doc_ids, array_length(s.source_doc_ids),
  'gemini-2.5-pro', current_timestamp()
);

drop table if exists jfk_curated._wc_rebalance_input;
drop table if exists jfk_curated._wc_rebalance_raw;
