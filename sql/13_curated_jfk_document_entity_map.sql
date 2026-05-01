-- 13_curated_jfk_document_entity_map.sql
--
-- Purpose:
--   Build `jfk_curated.jfk_document_entity_map`: one row per
--   (document, entity) pair with a confidence bucket.
--
-- Dependencies:
--   - jfk_curated.jfk_records
--   - jfk_curated.jfk_text_chunks       (now ABBYY-backed)
--   - jfk_curated.jfk_entities
--
-- Confidence tiers:
--     high    → alias hit as a whole word in the record title
--     medium  → alias hit in the NARA description
--     low     → alias hit in an OCR chunk (ABBYY text) but not in
--               title or description. This is the new tier unlocked
--               by ABBYY OCR; in the metadata-only world it was
--               effectively unreachable.

create or replace table jfk_curated.jfk_document_entity_map as
with alias_expansion as (
  select
    e.entity_id,
    lower(regexp_replace(alias, r'([.\\+*?\[\]{}()|^$])', r'\\\1')) as alias_re
  from jfk_curated.jfk_entities e,
  unnest(e.aliases) as alias
),
doc_fields as (
  select
    r.document_id,
    lower(coalesce(r.title, '')) as title_lc,
    lower(coalesce(r.description, '')) as desc_lc
  from jfk_curated.jfk_records r
),
title_desc_hits as (
  select
    d.document_id,
    ae.entity_id,
    max(case when regexp_contains(d.title_lc, format(r'\b%s\b', ae.alias_re)) then 1 else 0 end) as title_hit,
    max(case when regexp_contains(d.desc_lc,  format(r'\b%s\b', ae.alias_re)) then 1 else 0 end) as description_hit
  from doc_fields d
  cross join alias_expansion ae
  group by d.document_id, ae.entity_id
),
ocr_hits as (
  -- Alias presence in any OCR-sourced chunk for the document.
  -- Both abbyy_ocr (2025 re-OCR) and docai_ocr (Document AI over the
  -- original release PDFs) count as OCR for tier purposes — the
  -- confidence tier is "we found it in OCR text" regardless of engine.
  select
    c.document_id,
    ae.entity_id,
    1 as ocr_hit
  from jfk_curated.jfk_text_chunks c
  join alias_expansion ae
    on regexp_contains(lower(c.chunk_text), format(r'\b%s\b', ae.alias_re))
  where c.source_type in ('abbyy_ocr', 'docai_ocr')
  group by c.document_id, ae.entity_id
),
combined as (
  select
    coalesce(td.document_id, oh.document_id) as document_id,
    coalesce(td.entity_id,   oh.entity_id)   as entity_id,
    coalesce(td.title_hit,       0) as title_hit,
    coalesce(td.description_hit, 0) as description_hit,
    coalesce(oh.ocr_hit,         0) as ocr_hit
  from title_desc_hits td
  full outer join ocr_hits oh
    using (document_id, entity_id)
)
select
  document_id,
  entity_id,
  case
    when title_hit       = 1 then 'title'
    when description_hit = 1 then 'description'
    when ocr_hit         = 1 then 'ocr'
  end as match_source,
  case
    when title_hit       = 1 then 'high'
    when description_hit = 1 then 'medium'
    when ocr_hit         = 1 then 'low'
  end as confidence,
  (title_hit * 1.0) + (description_hit * 0.6) + (ocr_hit * 0.35) as score,
  cast(null as string) as match_text
from combined
where title_hit = 1 or description_hit = 1 or ocr_hit = 1;
