-- 25_topic_summaries.sql
--
-- Purpose:
--   Generate short AI summaries (2-3 paragraphs) for each topic that
--   backs the /topic/[slug] pages. Writes to
--   `jfk_curated.jfk_topic_summaries` (one row per slug).
--
-- Dependencies:
--   - jfk_curated.gemini_flash (sql/24_remote_models.sql)
--   - jfk_mvp.<topic>_docs tables (sql/21_mvp_topic_views.sql)
--
-- Cost:
--   6 topics × ~3k input / ~300 output tokens via Gemini 2.5 Flash =
--   pennies per rebuild. Add a `--skip-summaries` flag to the rebuild
--   script to avoid the call on noop schema changes.
--
-- Grounding / safety:
--   - Prompt passes ~20 real records per topic (title, agency, date,
--     description excerpt) and tells the model to ground its claims
--     in them.
--   - Temperature is low (0.2) to discourage speculation.
--   - source_doc_ids is stored on the row so the UI can render
--     "summary based on N records" and link back to them.

-- ---------------------------------------------------------------------
-- Pull the top ~20 docs per topic (ranked like fetchTopic does in the
-- app), carrying the slug and seed metadata through so we can build a
-- single prompt per topic in the next step.
-- ---------------------------------------------------------------------
create or replace table jfk_curated._topic_summary_input as
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
  union all select 'tippit-murder', 'Tippit Murder',
         'Records examining the murder of Dallas Police Officer J. D. Tippit at East 10th Street and Patton Avenue on November 22, 1963, approximately 45 minutes after the assassination of President Kennedy.'
  union all select 'dealey-plaza', 'Dealey Plaza',
         'Records concerning the motorcade, Dealey Plaza geography, the Texas School Book Depository, the Zapruder film, the grassy knoll, the triple underpass, and eyewitness accounts of the shooting scene.'
  union all select 'church-committee', 'Church Committee',
         'The 1975-76 Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities, which examined CIA and FBI conduct in the JFK investigation and published Book V of its final report on the subject.'
  union all select 'arrb-releases', 'ARRB & Declassification',
         'The Assassination Records Review Board (1994-98) and the ongoing declassification history of the JFK Assassination Records Collection — the meta-story of how the federal government has released these records over time.'
  union all select 'mob-castro-plots', 'Organized Crime & Castro Plots',
         'CIA operations against Fidel Castro and their organized-crime-intermediary angle: AMLASH (Rolando Cubela), ZRRIFLE, Operation Mongoose, and the mob figures Santo Trafficante Jr., Carlos Marcello, Sam Giancana, and Johnny Roselli.'
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
  union all
  select 'tippit-murder', r.document_id, r.title, r.description, r.agency, r.start_date, r.pages_released
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
  select *,
         row_number() over (
           partition by slug
           order by pages_released desc nulls last, start_date desc nulls last
         ) as rn
  from all_docs
),
top_docs as (select * from ranked where rn <= 20),
topic_context as (
  select
    m.slug,
    m.title,
    array_agg(td.document_id order by td.rn) as source_doc_ids,
    concat(
      'You are writing a concise encyclopedic summary of a topic from the JFK Assassination Records Collection at the U.S. National Archives — records released under the JFK Records Act (FBI, CIA, Warren Commission, HSCA, and related files).\n\n',
      'Topic: ', any_value(m.title), '\n',
      'Background: ', any_value(m.seed), '\n\n',
      'Sample of records in this topic (title | agency | date | description excerpt):\n',
      string_agg(
        format('- %s | %s | %s | %s',
          ifnull(td.doc_title, ''),
          ifnull(td.agency, '?'),
          ifnull(cast(td.start_date as string), '?'),
          substr(ifnull(td.doc_description, ''), 1, 280)
        ),
        '\n' order by td.rn
      ),
      '\n\nWrite a 2-3 paragraph summary (140-200 words) describing what this topic covers, its historical significance, and the types of records the collection holds. Ground every claim in the sample above or in well-known, uncontroversial historical facts. Do not invent specific documents, quotes, or figures. Use a neutral archival tone. Plain prose only — no headings, bullets, or markdown. Do not mention that you were shown a sample or that this is a summary.'
    ) as prompt
  from topic_meta m
  join top_docs td using (slug)
  group by m.slug, m.title
)
select * from topic_context;

-- ---------------------------------------------------------------------
-- Call Gemini once per topic and persist the result.
-- ---------------------------------------------------------------------
create or replace table jfk_curated.jfk_topic_summaries as
select
  slug,
  title,
  ml_generate_text_llm_result as summary,
  source_doc_ids,
  array_length(source_doc_ids) as source_doc_count,
  'gemini-2.5-flash' as model,
  current_timestamp() as generated_at
from ml.generate_text(
  model `jfk_curated.gemini_flash`,
  (select slug, title, source_doc_ids, prompt from jfk_curated._topic_summary_input),
  struct(
    0.2 as temperature,
    1024 as max_output_tokens,
    true as flatten_json_output
  )
);

drop table if exists jfk_curated._topic_summary_input;
