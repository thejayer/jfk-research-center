-- 31_chunk_embeddings.sql
--
-- Purpose:
--   Vector search for /search semantic mode (Phase 5-A). Embeds every
--   OCR chunk in `jfk_curated.jfk_text_chunks` with Vertex AI's
--   text-embedding-005 model, stores the 768-dim vectors in
--   `jfk_curated.chunk_embeddings`, and creates a cosine IVF vector
--   index for sub-second similarity search.
--
-- Prerequisites:
--   - sql/11 (jfk_text_chunks) must be populated.
--   - The vertex_ai connection from sql/24 must exist. The embedding
--     model gets registered here so it's co-located with its usage.
--
-- Cost:
--   ~148k OCR chunks (abbyy_ocr + docai_ocr) × ~250-300 tokens/chunk
--   ≈ 40M tokens. Vertex text-embedding-005 billing is ~$0.025 per 1M
--   input tokens, so one full rebuild costs ~$1. Subsequent incremental
--   runs over only new chunks would be cheaper; this file does a full
--   rebuild each time for simplicity.
--
-- Runtime:
--   ML.GENERATE_EMBEDDING batches under the hood but the full generation
--   over 186k rows typically takes 15–40 minutes depending on Vertex
--   throughput. Run it as a one-off `bq query` job; do not wire it into
--   scripts/rebuild_warehouse.sh until you want every rebuild to pay the
--   time and money cost.
--
-- Task types:
--   - RETRIEVAL_DOCUMENT for the corpus-side embeddings (this file).
--   - RETRIEVAL_QUERY for runtime query embeddings (warehouse.ts).
--   Google's retrieval embeddings are asymmetric; using the wrong task
--   type on either side silently degrades recall.

create or replace model `jfk_curated.text_embedding`
remote with connection `jfk-vault.us.vertex_ai`
options (endpoint = 'text-embedding-005');

-- Drop any prior vector index before recreating the underlying table.
-- BigQuery won't let you CREATE OR REPLACE TABLE while a vector index is
-- attached. A BEGIN/EXCEPTION wrapper swallows the "table not found"
-- error on the very first run before chunk_embeddings has ever existed.
begin
  execute immediate '''
    drop vector index if exists chunk_embeddings_idx
      on `jfk-vault.jfk_curated.chunk_embeddings`
  ''';
exception when error then
  select null as swallow_missing_table;
end;

create or replace table jfk_curated.chunk_embeddings
as
select
  chunk_id,
  document_id,
  naid,
  chunk_order,
  page_label,
  source_type,
  ml_generate_embedding_result as embedding,
  ml_generate_embedding_status as embedding_status
from ml.generate_embedding(
  model `jfk_curated.text_embedding`,
  (
    select
      chunk_id,
      document_id,
      naid,
      chunk_order,
      page_label,
      source_type,
      chunk_text as content
    from `jfk-vault.jfk_curated.jfk_text_chunks`
    where source_type in ('abbyy_ocr', 'docai_ocr')
      and chunk_text is not null
      and length(trim(chunk_text)) >= 40
  ),
  struct(
    'RETRIEVAL_DOCUMENT' as task_type,
    true as flatten_json_output
  )
);

-- IVF index with cosine distance. Cosine suits normalized embeddings
-- (text-embedding-005 output is L2-normalized) and is the default
-- recommendation for retrieval. The IVF index auto-tunes list count at
-- this table scale; no OPTIONS needed.
create vector index chunk_embeddings_idx
  on `jfk-vault.jfk_curated.chunk_embeddings`(embedding)
  options (index_type = 'IVF', distance_type = 'COSINE');
