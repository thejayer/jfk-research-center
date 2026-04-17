-- 24_remote_models.sql
--
-- Purpose:
--   Register remote models in BigQuery that call Vertex AI Gemini so
--   other SQL steps can invoke ML.GENERATE_TEXT(...) without an
--   application-layer SDK.
--
-- Prerequisites (one-time, run manually — not part of rebuild):
--   1. gcloud services enable aiplatform.googleapis.com --project=jfk-vault
--   2. bq mk --connection --location=US --project_id=jfk-vault \
--        --connection_type=CLOUD_RESOURCE vertex_ai
--   3. Grab the connection's service account:
--        bq show --connection --location=US --project_id=jfk-vault \
--          --format=prettyjson vertex_ai   # serviceAccountId
--   4. gcloud projects add-iam-policy-binding jfk-vault \
--        --member="serviceAccount:<that-email>" \
--        --role="roles/aiplatform.user"
--
-- Notes:
--   - Endpoint is the Gemini model name; swap here to change models
--     globally.
--   - CREATE OR REPLACE is safe; it just rebinds metadata.

create or replace model `jfk_curated.gemini_flash`
remote with connection `jfk-vault.us.vertex_ai`
options (endpoint = 'gemini-2.5-flash');
