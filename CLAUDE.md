# CLAUDE.md — JFK Research Center

Operational context for agents working on this project. Read this before
making changes. Keep it up to date as the project evolves.

---

## What this is

Production-quality Next.js App Router MVP for researching the JFK
assassination records. Metadata comes from NARA; OCR text from ABBYY's
JFK-OCR repo. Deployed to Cloud Run, backed by BigQuery.

Live: **https://jfk-research-center-690906762945.us-central1.run.app**

---

## Environment

- **VM**: `vm-jfk` in `us-central1-f`, Debian 12 (~10 GB root disk).
  Home is `/home/austincwiley`. Project lives in
  `/home/austincwiley/jfk-research-center`.
- **Disk is tight.** The LFS mirror of abbyy/JFK-OCR is ~130 MB but
  total workspace inflates fast. Default to the streaming ingest mode
  (`scripts/ingest_abbyy.py` without `--clone`). If you see ENOSPC,
  the shell itself will wedge — clean up with
  `sudo rm -rf /tmp/abbyy /tmp/jfk-data`.
- **Auth**: the user (austincwiley@gmail.com) ran
  `gcloud auth login --no-browser --update-adc`; their user ADC is
  active. The VM's compute SA (`690906762945-compute@...`) only has
  the default restricted scopes — it cannot call GCP APIs from this
  SSH session. Use the user's gcloud identity.
- **On Cloud Run**, the runtime SA is that same compute default SA,
  but there it has `roles/editor` which is enough for BigQuery.
- **Source control**: this project is versioned at
  `https://github.com/thejayer/jfk-research-center` (private). The VM
  has `gh` CLI authenticated as `thejayer`. Make commits with
  `austincwiley@gmail.com` as the author (set as the local
  `user.email`). `gh` token carries `repo` scope, enough to push +
  manage the repo. Cloud Run still deploys from `--source=.` (local
  tree → GCS tar → Cloud Build → Artifact Registry), not from
  GitHub; git is for history and recovery, not CI.

---

## GCP resources

| Resource | Name |
|---|---|
| Project | `jfk-vault` |
| Region | `us-central1` |
| Cloud Run service | `jfk-research-center` |
| Cloud Run runtime SA | `690906762945-compute@developer.gserviceaccount.com` |
| BigQuery datasets | `jfk_raw`, `jfk_staging`, `jfk_curated`, `jfk_mvp` (all in `US`) |
| Artifact Registry repo | `cloud-run-source-deploy` (auto-created on first deploy) |

Environment variable on Cloud Run:
- `JFK_BQ_PROJECT=jfk-vault`

---

## Data architecture

```
  NARA XLSX manifests           ABBYY JFK-OCR (Git LFS)
  (archives.gov)                 (github.com/abbyy/JFK-OCR)
          │                              │
          ▼                              ▼
  scripts/normalize_          scripts/ingest_abbyy.py
  nara_manifests.py                (streaming mode)
          │                              │
          ▼                              ▼
  jfk_raw.nara_manifest        jfk_staging.abbyy_documents
  (72k rows, 4 releases)       jfk_staging.abbyy_text_chunks
                                          │
                              sql/05_abbyy_to_nara_map.sql
                                          │
                                          ▼
                               jfk_staging.abbyy_to_nara_map
                               (RIF-equality join, match_confidence='high')
          │                              │
          │     sql/10 (records)         │     sql/11 (chunks)
          │     sql/12 (entities)        │
          └───────────┬──────────────────┘
                      ▼
  jfk_curated.jfk_records              (37,138 rows, dedup-by-latest-release)
  jfk_curated.jfk_text_chunks          (abbyy_ocr OR description fallback)
  jfk_curated.jfk_entities             (9 hand-curated)
  jfk_curated.jfk_document_entity_map  (title/desc/ocr tiered)
                      │
                      ▼
  jfk_mvp.oswald_mentions, ruby_mentions
  jfk_mvp.cia_docs, fbi_docs, hsca_docs
  jfk_mvp.warren_commission_docs, mexico_city_docs, cuba_docs
  jfk_mvp.timeline_1963_docs, featured_documents
                      │
                      ▼
  Next.js /api/* routes read via lib/warehouse.ts (BigQuery client)
  Pages fetch /api/* via lib/api-client.ts
```

**Counts snapshot (post OCR integration):**
- NARA records: 37,138 unique RIFs · 2,162 (5.8%) have ABBYY OCR attached (`has_ocr = true`)
- Entity-map entries: ~36k (mostly title/description matches)
- Topic tables: CIA 17,194 · FBI 18,713 · HSCA 1,834 · Cuba 2,844 · Mexico City 2,086 · 1963 timeline 5,734 · Warren Commission 129 · Oswald 176 · Ruby 7
- Text chunks: 144,676 total = 112,445 `abbyy_ocr` (100% with `page_label`) + 32,231 `description` fallback

**ABBYY OCR coverage:**
- 2,182 PDFs in repo → 2,168 ingested → **2,162 matched to NARA records** (~99.4%, 14 unparseable-filename skips, 6 via parenthetical_strip)
- Covers the 2025 release; older releases remain metadata-only until
  ABBYY expands the corpus

---

## Key files

```
app/
  layout.tsx, page.tsx, globals.css       (root shell + design tokens)
  search/page.tsx                          (sticky search, filters, mention/doc tabs)
  entity/[slug]/page.tsx                   (hero, timeline, excerpts, related)
  topic/[slug]/page.tsx                    (hero, doc grid, related entities)
  document/[id]/page.tsx                   (metadata panel, OCR panel, source links)
  api/{home,search,entity/[slug],topic/[slug],document/[id]}/route.ts

lib/
  api-types.ts         Canonical response contract (UI boundary)
  api-client.ts        Server-side fetcher used by pages; hits internal /api
  warehouse.ts         BigQuery adapter — pages never import this directly
  mock-data.ts         Legacy mock layer (kept for offline demos)
  search.ts            parseSearchParams + filter URL helpers
  format.ts            date/number/highlight helpers
  constants.ts         Featured slugs, confidence levels

components/
  layout/              site-header, site-footer, shell, theme-toggle
  search/              search-bar, search-filters, search-result-card, mention-snippet
  entities/            entity-hero, entity-timeline, related-entities, entity-document-list
  topics/              topic-hero, topic-document-grid
  documents/           document-header, metadata-panel, ocr-panel, source-links
  ui/                  badge (+ ConfidenceBadge), button, card, section-heading, stat-pill, empty-state

sql/
  00_raw_notes.md                           Full architecture doc
  05_abbyy_to_nara_map.sql                  Join table (ABBYY → NARA)
  10_curated_jfk_records.sql                Canonical record table
  11_curated_jfk_text_chunks.sql            ABBYY OCR chunks + desc fallback
  12_curated_jfk_entities.sql               9 hand-curated entities
  13_curated_jfk_document_entity_map.sql    Title/desc/OCR confidence tiers
  20_mvp_oswald_mentions.sql                Oswald passages with scoring
  21_mvp_topic_views.sql                    Per-topic + featured tables
  30_search_indexes.sql                     BigQuery SEARCH indexes (optional)
  40_sample_queries.sql                     Reference queries for the API routes
  90_dq_reports.sql                         DQ views: unmatched, dupes, coverage, join_summary

scripts/
  normalize_nara_manifests.py   XLSX → unified CSV for jfk_raw.nara_manifest
  ingest_abbyy.py               Streaming ABBYY → staging (default disk-safe mode)
  rebuild_warehouse.sh          Runs the promotion SQL files in order
  export_mock_data.ts           Dev utility, not load-bearing
```

---

## Commands cheatsheet

```bash
# --- Local dev ---
npm install
gcloud auth application-default login    # one-time
npm run dev                              # http://localhost:3000

# --- Typecheck + build ---
npx tsc --noEmit
npm run build

# --- Data pipeline ---
# (1) NARA manifests → CSV → BigQuery (only when a new release drops)
for r in 2017-2018 2021 2022 2023; do
  curl -sSL -o /tmp/jfk-$r.xlsx \
    https://www.archives.gov/files/research/jfk/national-archives-jfk-assassination-records-$r-release.xlsx
done
python3 scripts/normalize_nara_manifests.py \
  --inputs /tmp/jfk-*.xlsx --out /tmp/jfk-data/jfk-records.csv
bq load --source_format=CSV --skip_leading_rows=1 --allow_quoted_newlines \
  --replace jfk_raw.nara_manifest /tmp/jfk-data/jfk-records.csv \
  record_num:STRING,file_name:STRING,release_date:STRING,formerly_withheld:STRING,agency:STRING,doc_date:STRING,doc_type:STRING,file_num:STRING,to_name:STRING,from_name:STRING,title:STRING,num_pages:STRING,originator:STRING,record_series:STRING,review_date:STRING,comments:STRING,pages_released:STRING,release_set:STRING,agency_from_prefix:STRING,pdf_url:STRING

# (2) ABBYY OCR → BigQuery staging (streaming; safe on small VMs)
python3 scripts/ingest_abbyy.py \
  --out-dir /tmp/abbyy-out --project jfk-vault --dataset jfk_staging
# Options:
#   --clone (clone repo + git lfs pull; faster for repeat runs)
#   --limit 25 --skip-load (quick sanity check)

# (3) Rebuild all curated/mvp tables + DQ views
./scripts/rebuild_warehouse.sh --project jfk-vault

# --- Data-quality spot checks ---
bq query --use_legacy_sql=false \
  'SELECT * FROM `jfk-vault.jfk_staging.dq_join_summary`'
bq query --use_legacy_sql=false \
  'SELECT * FROM `jfk-vault.jfk_staging.dq_ocr_coverage_by_release`'
bq query --use_legacy_sql=false \
  'SELECT * FROM `jfk-vault.jfk_staging.dq_unmatched_abbyy` LIMIT 20'

# --- Deploy ---
gcloud run deploy jfk-research-center \
  --source=. --region=us-central1 --project=jfk-vault \
  --allow-unauthenticated --port=8080 \
  --memory=1Gi --cpu=1 --max-instances=3 --min-instances=0 \
  --set-env-vars="JFK_BQ_PROJECT=jfk-vault" --quiet
```

---

## Gotchas & past fixes

- **BigQuery doesn't have `concat_ws`.** Use
  `(SELECT STRING_AGG(part, ' · ') FROM UNNEST([...]) part WHERE part IS NOT NULL)`.
- **BigQuery string literals.** `'can''t'` is fragile in some clauses;
  prefer `'can\'t'` (backslash escape).
- **Next.js 15 force-static + fetch.** Pages that fetch their own
  `/api/*` routes cannot be prerendered at build time because the
  server isn't running. All pages use `export const dynamic = "force-dynamic"`.
- **Cloud Build default SA.** Newer projects need an explicit
  `roles/cloudbuild.builds.builder` grant on
  `690906762945-compute@…` even though it has `roles/editor`.
  Already granted.
- **GCE VM access scopes.** The VM was created with the default
  restricted scopes; calls from the VM's SA fail with
  "insufficient authentication scopes." We worked around this by
  authenticating as the user. To change permanently: stop VM →
  `gcloud compute instances set-service-account vm-jfk --scopes=cloud-platform`
  → start.
- **LFS pointers vs. blobs.** `git clone` fetches pointers (130 bytes
  each) unless you also `git lfs install && git lfs pull`. The streaming
  ingester side-steps this by calling
  `media.githubusercontent.com/media/abbyy/JFK-OCR/main/Data/<file>`
  directly.
- **URL encode filenames.** Some ABBYY files have parenthetical
  suffixes like `"104-10004-10143 (C06932208).pdf"`. `urllib.request`
  rejects unencoded spaces; always `urllib.parse.quote()` the basename.
- **`bash` shell can wedge after ENOSPC.** The bash-tool wrapper
  writes `pwd -P >| /tmp/claude-XXXX-cwd` at the end; if `/tmp` can't
  take the write, every subsequent command returns exit 1 with no
  output. Diagnosis: run `df -h /` via `! df -h /` — if disk is full,
  clean and re-SSH.

---

## Current state (keep this section fresh)

**Last updated:** 2026-04-17 (Open Questions pipeline + /open-questions)

- **Topics index page** at `/topics` lists all 6 topics; `/api/topics`
  backs it via `fetchAllTopics()`. Homepage featured-topics grid has
  a "See all" CTA; topic breadcrumb "Topics" → `/topics` (was `/search`).
- **AI topic summaries + articles** are both live.
  - `jfk_curated.jfk_topic_summaries` (1 row/slug) — short 140-200
    word summary from Gemini 2.5 Flash via `sql/25_topic_summaries.sql`.
  - `jfk_curated.jfk_topic_articles` (1 row/slug) — long-form 600-900
    word analysis with inline `[doc:<id>]` citations from Gemini 2.5
    Pro via `sql/26_topic_articles.sql`. Prompt bundles 30 docs per
    topic (longer description excerpts) and forces citation tokens.
  - Remote models live in `sql/24_remote_models.sql` (`gemini_flash`
    + `gemini_pro`), both bound to connection `jfk-vault.us.vertex_ai`.
  - UI: `/topic/[slug]` hero shows a split pill ("Short summary" /
    "Long-form analysis") when both are present. Article citations
    are parsed client-side in `components/topics/topic-body.tsx`:
    `[doc:XYZ]` → numbered superscript link `[1]` opening
    `/document/XYZ` in a new tab. Falls back to the hardcoded
    `TOPIC_CATALOG[slug].summary` if neither AI row is present.
  - Rebuild with `--skip-summaries` to omit all three AI SQL files
    (24, 25, 26) during local iterations.
  - `sql/26` runs a JS UDF after generation that strips any
    `[doc:<id>]` whose id isn't in the per-topic source_doc_ids
    (captured in `invalid_citation_ids` for audit). Spot-check with:
    `bq query --use_legacy_sql=false 'SELECT slug, invalid_citation_count FROM jfk-vault.jfk_curated.jfk_topic_articles ORDER BY slug'`.
- **Open Questions (corpus-wide map-reduce).** `/open-questions` landing
  page + `/open-questions/[slug]` per-topic pages. Three SQL files drive
  the pipeline:
  - `sql/27_topic_batch_analyses.sql` — MAP stage. Partitions every
    record in every topic into batches of 150, calls Gemini 2.5 Pro
    per batch, extracts structured JSON open-questions (one-sentence
    question + 2-4 sentence summary + supporting_doc_ids +
    tension_type ∈ {contradiction, timing, redaction,
    unexplained_reference, pattern, gap}). Writes
    `jfk_curated.jfk_topic_batch_questions` (one row per question).
  - `sql/28_topic_open_questions.sql` — REDUCE stage. Per slug, bundles
    all batch questions, asks Pro to merge/dedupe and write a 700-1000
    word article with `[doc:id]` citations. Writes
    `jfk_curated.jfk_topic_open_questions` (one row per slug). Citations
    validated against the union of supporting_doc_ids for that slug.
  - `sql/29_global_open_questions.sql` — CROSS-TOPIC synthesis. Bundles
    the 6 per-topic articles and asks Pro for a landing-page article
    (600-900 words) surfacing threads that cut across topics. Writes
    `jfk_curated.jfk_global_open_questions` (one row, slug='global').
  - Cost: ~287 batches × ~$0.10 ≈ $25-30 for a full rebuild across all
    six topics. Gated behind both `--skip-summaries` and
    `--skip-open-questions` in `rebuild_warehouse.sh`. Use
    `--skip-open-questions` if you want the cheap 24/25/26 AI content
    without paying for the map-reduce pipeline.
  - UI: `components/open-questions/article-body.tsx` reuses the
    `[doc:id]` → numbered superscript link pattern from
    `topic-body.tsx` (duplicated, not extracted — intentional). The
    per-topic page also renders the underlying batch questions grouped
    by tension_type so readers can drill from the article into evidence.
- **Vertex AI connection** `jfk-vault.us.vertex_ai` (BQ → Vertex) exists
  with `roles/aiplatform.user` on its connection SA
  (`bqcx-690906762945-gkx3@gcp-sa-bigquery-condel.iam.gserviceaccount.com`).
  This was a one-time manual step, documented in `sql/24_remote_models.sql`
  header; don't re-create it.
- ABBYY OCR is **live** in the deployed Cloud Run service. Documents that
  have OCR (`has_ocr = true`) show an `OCR` chip on cards across search,
  entity, and topic pages; the document page shows real per-page OCR text.
- Ingester emits `page_label` per chunk (physical page number, "p. 1" …).
  `jfk_curated.jfk_text_chunks` has `page_label` populated for 100% of
  `abbyy_ocr` chunks (description-fallback chunks are null, by design).
- `sql/10_*` and `sql/11_*` use a `TRUNCATE + INSERT` pattern inside a
  `BEGIN…END` block rather than `CREATE OR REPLACE TABLE`, so BigQuery
  search indexes on those tables will **survive a rebuild**. Schema
  changes still require dropping the destination table to refresh.
- `sql/30_search_indexes.sql` is repaired (had a `curated.` → `jfk_curated.`
  typo) and dry-run-validates. **Indexes have not been built yet** —
  applying them is pure cost until the query layer swaps `LIKE`/`REGEXP_CONTAINS`
  for `SEARCH()`. `rebuild_warehouse.sh` still runs this step by default;
  pass `--skip-indexes` to omit it.
- Project is now under git at
  `https://github.com/thejayer/jfk-research-center` (private, one
  "Initial commit" landed so far — further work should go in as
  separate logical commits: ingester vs. SQL vs. UI vs. docs).

**Useful diagnostic queries:**

```bash
# OCR coverage in curated
bq query --use_legacy_sql=false \
  'SELECT has_ocr, COUNT(*) FROM `jfk-vault.jfk_curated.jfk_records` GROUP BY has_ocr'

# Are search indexes built?
for ds in jfk_curated jfk_staging; do
  bq query --project_id=jfk-vault --use_legacy_sql=false --format=pretty \
    "SELECT table_name, index_name, index_status
       FROM \`jfk-vault.$ds.INFORMATION_SCHEMA.SEARCH_INDEXES\`"
done

# DQ
bq query --use_legacy_sql=false \
  'SELECT * FROM `jfk-vault.jfk_staging.dq_join_summary`'
```

---

## Open TODOs

- **Consider NARA 2025 release manifest.** NARA hasn't published an XLSX
  for the 2025 release yet. Until they do, the 14 unmatched ABBYY RIFs
  stay in `dq_unmatched_abbyy`. Monitor archives.gov/research/jfk/release-2025.
- **Search index on OCR chunks.** `sql/30_search_indexes.sql` is ready
  but **not worth applying at current scale**. BigQuery only
  auto-maintains search indexes once a table passes ~10 GiB;
  `jfk_text_chunks` is ~135 MB, so any index sits at 0% coverage
  (`TEMPORARILY DISABLED`) and does nothing. Additionally, `SEARCH()`
  is token-based while current `LIKE '%q%'` queries are substring —
  migrating would drop a few percent of matches (e.g. OCR noise
  `KOSTIKOV2`). Revisit when the corpus grows ~10×.

---

## Style & process notes

- **Mock vs. warehouse**: API routes import from `@/lib/warehouse.ts`.
  `@/lib/mock-data.ts` is not imported anywhere in production code; it
  exists for local demos or tests.
- **No Tailwind, no CSS framework.** Design tokens in
  `app/globals.css`; most component styling is inline React `style` on
  server components so it renders server-side without runtime CSS-in-JS.
- **Confidence semantics** (in UI and DB): `high` = entity name in
  title, `medium` = in description, `low` = in OCR text only. Never
  guess — always reflect where the match landed.
- **No lorem ipsum.** All content is neutral and archival.
- **Neutral framing — surface tensions, don't assert conclusions.**
  The collection contains real ambiguities, redactions, and
  unreconciled records; the site may name them openly (see the
  Open Questions feature) but must not take a position on whether
  the official story is correct. Prefer phrasing like "the record
  is inconsistent on X" over "X proves Y." No conspiracy advocacy,
  and no defense-of-orthodoxy either.
- **Tests**: `npm test` runs Vitest (`lib/__tests__/*.test.ts`). Node
  env, `@/*` alias matches the TS paths config. Adapter/warehouse
  tests would need a BigQuery mock — not written yet.
- **CI/CD**: `.github/workflows/deploy.yml` runs on push to `main`:
  typecheck → `gcloud run deploy --source=.`. Auths via the
  `GCP_SA_KEY` repo secret (JSON key for `jfk-deployer@jfk-vault`).
  If you rotate or revoke the key, regenerate with
  `gcloud iam service-accounts keys create` and update the secret via
  `gh secret set GCP_SA_KEY --repo=thejayer/jfk-research-center`.
