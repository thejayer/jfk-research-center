-- 36_document_topic_map.sql
--
-- Purpose:
--   Thin document_id → topic_slug map for /api/document. Live 00168
--   still runs a UNION ALL of EXISTS over 11 full-width jfk_mvp.*_docs
--   tables on every document open (~110 MiB × N). Those tables are
--   SELECT r.* copies of jfk_records; EXISTS cannot prune them cheaply.
--
--   APPLY THIS FILE BEFORE merging / deploying the app change. Until it
--   exists, document topic chips degrade to empty (no 500, no fallback
--   to the fat EXISTS union).
--
-- Table:
--   jfk_curated.document_topic_map
--     One row per (document_id, topic_slug). No record body columns.
--     CLUSTER BY document_id so `document_id = @id` stays at the
--     on-demand 10 MiB floor even if clustering is a no-op (full scan
--     of two string columns is still tiny).
--
-- Dependencies:
--   - jfk_mvp.*_docs from sql/21 + sql/21b
--     (same 11 slugs as lib/warehouse.ts MVP_QUERYABLE_TOPIC_SLUGS)
--
-- Notes:
--   - physical-evidence is not an MVP docs table; omit it.
--   - No Vertex / no new GCP product.
--   - Search stays on tokens + card excerpts. Page OCR stays on sql/35.
--   - One-time CREATE reads document_id only from each MVP table.

create or replace table `jfk-vault.jfk_curated.document_topic_map`
cluster by document_id
as
select document_id, 'warren-commission' as topic_slug
  from `jfk-vault.jfk_mvp.warren_commission_docs`
union all
select document_id, 'hsca'
  from `jfk-vault.jfk_mvp.hsca_docs`
union all
select document_id, 'mexico-city'
  from `jfk-vault.jfk_mvp.mexico_city_docs`
union all
select document_id, 'cia'
  from `jfk-vault.jfk_mvp.cia_docs`
union all
select document_id, 'fbi'
  from `jfk-vault.jfk_mvp.fbi_docs`
union all
select document_id, 'cuba'
  from `jfk-vault.jfk_mvp.cuba_docs`
union all
select document_id, 'tippit-murder'
  from `jfk-vault.jfk_mvp.tippit_murder_docs`
union all
select document_id, 'dealey-plaza'
  from `jfk-vault.jfk_mvp.dealey_plaza_docs`
union all
select document_id, 'church-committee'
  from `jfk-vault.jfk_mvp.church_committee_docs`
union all
select document_id, 'arrb-releases'
  from `jfk-vault.jfk_mvp.arrb_releases_docs`
union all
select document_id, 'mob-castro-plots'
  from `jfk-vault.jfk_mvp.mob_castro_plots_docs`;
