-- 30_search_indexes.sql
--
-- Purpose:
--   Create BigQuery search indexes over the string columns that back the
--   app's `/api/search` endpoint. With these indexes in place, calls to
--   `SEARCH(column, '…')` run with log-time token lookup rather than a
--   full scan of every row.
--
-- Dependencies:
--   - jfk_curated.jfk_records
--   - jfk_curated.jfk_text_chunks
--
-- Notes:
--   - Indexes are asynchronous: after create, there is a build period
--     before queries benefit. Check status via
--       select * from `region-us`.INFORMATION_SCHEMA.SEARCH_INDEXES
--       where table_name in ('jfk_records','jfk_text_chunks');
--   - Search indexes add storage cost; apply after the curated tables
--     stabilize.

create search index if not exists idx_jfk_records_title
on jfk_curated.jfk_records(title)
options (analyzer = 'LOG_ANALYZER');

create search index if not exists idx_jfk_records_description
on jfk_curated.jfk_records(description)
options (analyzer = 'LOG_ANALYZER');

create search index if not exists idx_jfk_text_chunks_text
on jfk_curated.jfk_text_chunks(chunk_text)
options (analyzer = 'LOG_ANALYZER');
