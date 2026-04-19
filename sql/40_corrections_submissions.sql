-- 40_corrections_submissions.sql
--
-- Purpose:
--   Backing table for the public /corrections form. Each submission
--   captures which on-site surface the reader was looking at when they
--   clicked "Report an error", their description of the issue, and an
--   optional contact email. Status defaults to 'new' and is moved
--   through 'triaged' / 'fixed' / 'rejected' by the (forthcoming)
--   admin triage view.
--
-- Schema:
--   submission_id     UUID generated client-side; primary key.
--   submitted_at      Server-side ingest timestamp.
--   surface           Free-form slug describing the surface — e.g.
--                     'entity_bio', 'topic_summary', 'timeline_event',
--                     'evidence_item', 'open_questions_thread',
--                     'document_metadata', 'established_fact', 'other'.
--   target_id         The id within that surface — entity slug, topic
--                     slug, NAID, established-fact id, etc. Empty when
--                     the user reports a general site issue.
--   issue             Required. The reader's description.
--   suggested_fix     Optional rewrite.
--   submitter_email   Optional contact email.
--   status            'new' | 'triaged' | 'fixed' | 'rejected'.
--   user_agent        Best-effort UA string captured by the API route.
--   notes             Internal notes added during triage.
--
-- Idempotent: create-if-not-exists so re-running the file does not
-- truncate accumulated submissions.

create table if not exists jfk_curated.corrections_submissions (
  submission_id   string  not null,
  submitted_at    timestamp not null,
  surface         string  not null,
  target_id       string,
  issue           string  not null,
  suggested_fix   string,
  submitter_email string,
  -- 'new' | 'triaged' | 'fixed' | 'rejected'. The INSERT path sets 'new';
  -- BigQuery does not support column-level DEFAULT in CREATE TABLE.
  status          string  not null,
  user_agent      string,
  notes           string
);
