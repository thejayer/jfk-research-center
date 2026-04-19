-- 21b_mvp_new_topic_views.sql
--
-- Purpose:
--   Phase 2-B new topic MVP views. Extends jfk_mvp with 5 new topic
--   tables so the existing /topic/[slug] pipeline (AI summaries, AI
--   articles, open-questions map-reduce) picks them up automatically
--   once the corresponding topic_meta rows are added in sql/25/26/27.
--
--   The sixth new topic (physical-evidence) is intentionally NOT an
--   AI-driven topic — it surfaces the jfk_curated.physical_evidence
--   table via a special-case UI page and does not use the document
--   pipeline.
--
-- Dependencies:
--   - jfk_curated.jfk_records                  (sql/10)
--   - jfk_curated.jfk_document_entity_map      (sql/13)

-- -----------------------------------------------------------------------
-- mvp.tippit_murder_docs
--   Records examining the murder of Dallas Police Officer J. D. Tippit
--   at E. 10th Street and Patton Avenue on November 22, 1963.
--   The NARA metadata corpus is thin on Tippit-specific hits (most
--   agency files predate the shooting), so this view also folds in any
--   document whose OCR text contains a Tippit-keyword hit, including
--   the 3 primary-source reports we ingested (Warren Report, ARRB Final
--   Report, Church Book V) which discuss the shooting extensively.
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.tippit_murder_docs as
with by_meta as (
  select document_id from jfk_curated.jfk_records
  where regexp_contains(lower(coalesce(title, '')),
          r'\btippit\b|j\.?\s*d\.?\s*tippit|officer tippit')
     or regexp_contains(lower(coalesce(description, '')),
          r'\btippit\b|j\.?\s*d\.?\s*tippit|officer tippit')
),
by_ocr as (
  select distinct document_id from jfk_curated.jfk_text_chunks
  where regexp_contains(lower(chunk_text),
          r'\btippit\b|j\.?\s*d\.?\s*tippit|officer tippit')
)
select r.*
from jfk_curated.jfk_records r
where r.document_id in (select document_id from by_meta)
   or r.document_id in (select document_id from by_ocr);

-- -----------------------------------------------------------------------
-- mvp.dealey_plaza_docs
--   Records touching the scene — motorcade, Dealey Plaza geography,
--   Zapruder film, Book Depository geometry, witnesses. Same metadata +
--   OCR union as tippit_murder_docs.
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.dealey_plaza_docs as
with by_meta as (
  select document_id from jfk_curated.jfk_records
  where regexp_contains(lower(coalesce(title, '')),
          r'\bdealey plaza\b|texas school book depository|\btsbd\b|\bzapruder\b|grassy knoll|triple underpass|sniper.?s nest|book depository')
     or regexp_contains(lower(coalesce(description, '')),
          r'\bdealey plaza\b|texas school book depository|\btsbd\b|\bzapruder\b|grassy knoll|triple underpass|sniper.?s nest|book depository|elm street')
),
by_ocr as (
  select distinct document_id from jfk_curated.jfk_text_chunks
  where regexp_contains(lower(chunk_text),
          r'\bdealey plaza\b|\btsbd\b|\bzapruder\b|grassy knoll|triple underpass|book depository')
)
select r.*
from jfk_curated.jfk_records r
where r.document_id in (select document_id from by_meta)
   or r.document_id in (select document_id from by_ocr);

-- -----------------------------------------------------------------------
-- mvp.church_committee_docs
--   Records related to the 1975-76 Senate Select Committee to Study
--   Governmental Operations with Respect to Intelligence Activities
--   (Church Committee) examination of intelligence-agency conduct in
--   the JFK investigation.
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.church_committee_docs as
select r.*
from jfk_curated.jfk_records r
where regexp_contains(lower(coalesce(r.title, '')),
        r'\bchurch committee\b|\bsenate select committee\b|\bsscia\b|senator church|frank church|\bchurch\b.+intelligence|intelligence activities')
   or regexp_contains(lower(coalesce(r.description, '')),
        r'\bchurch committee\b|\bsenate select committee\b|\bsscia\b|senator church|frank church|intelligence activities');

-- -----------------------------------------------------------------------
-- mvp.arrb_releases_docs
--   Records touching the Assassination Records Review Board (1994-98),
--   its declassification activity, and the transfer of records to the
--   JFK Collection at NARA.
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.arrb_releases_docs as
select r.*
from jfk_curated.jfk_records r
where regexp_contains(lower(coalesce(r.title, '')),
        r'\barrb\b|assassination records review|review board|jfk records act|declassif|postponement')
   or regexp_contains(lower(coalesce(r.description, '')),
        r'\barrb\b|assassination records review|review board|jfk records act|declassif|postponement')
   or lower(coalesce(r.agency, '')) = 'arrb';

-- -----------------------------------------------------------------------
-- mvp.mob_castro_plots_docs
--   Records touching CIA operations against Fidel Castro and their
--   organized-crime-intermediary angle: AMLASH (Rolando Cubela),
--   ZRRIFLE, Operation Mongoose, and the mob figures Trafficante,
--   Marcello, Giancana, Roselli.
-- -----------------------------------------------------------------------
create or replace table jfk_mvp.mob_castro_plots_docs as
select r.*
from jfk_curated.jfk_records r
where regexp_contains(lower(coalesce(r.title, '')),
        r'\bamlash\b|\bzrrifle\b|\bmongoose\b|cubela|trafficante|marcello|giancana|roselli|rosselli|assassinat.+castro|castro.+assassinat|anti[- ]castro|jmwave|cia[- ]mafia|\bmafia\b|la cosa nostra')
   or regexp_contains(lower(coalesce(r.description, '')),
        r'\bamlash\b|\bzrrifle\b|\bmongoose\b|cubela|trafficante|marcello|giancana|roselli|rosselli|assassinat.+castro|castro.+assassinat|anti[- ]castro|jmwave|cia[- ]mafia|\bmafia\b|la cosa nostra');
