# JFK Research Center

An editorial archival research site for records related to the assassination
of President John F. Kennedy. Metadata comes from the U.S. National Archives
JFK Records Collection; searchable OCR text comes from the
[abbyy/JFK-OCR](https://github.com/abbyy/JFK-OCR) repository.

## Data sources

| Role | Source | Coverage |
|---|---|---|
| Metadata | NARA XLSX manifests (2017-18, 2021, 2022, 2023 releases) | 37,138 unique record numbers |
| OCR text | [abbyy/JFK-OCR](https://github.com/abbyy/JFK-OCR), Git LFS | 2,176 unique RIFs with full OCR |

The warehouse joins these sources in `jfk_staging.abbyy_to_nara_map` and
promotes matched ABBYY chunks into `jfk_curated.jfk_text_chunks` with a
`source_type = 'abbyy_ocr'` discriminator. Records without ABBYY coverage
fall back to description-only chunking.

## Stack

- **Next.js 15** (App Router, TypeScript, React Server Components)
- **No CSS framework** — the design system lives in `app/globals.css`
  (tokens) and colocated inline styles (rendered on the server).
- **BigQuery** (eventual backend) — schema and example queries in `sql/`.

## Running locally

```bash
npm install
gcloud auth application-default login    # one-time, for BigQuery access
npm run dev
```

The app starts on `http://localhost:3000`. Every route is wired through
`lib/api-client.ts`, which fetches the internal `/api/*` endpoints. Those
endpoints read from BigQuery via `lib/warehouse.ts`. Set `JFK_BQ_PROJECT`
if your project is not `jfk-vault`.

For offline demos without a BigQuery connection, `lib/mock-data.ts` is still
in the tree and can be swapped back into an API route handler; the shape
is identical to the warehouse response.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` against the project |

## Project layout

```
app/                Next.js App Router pages and API routes
components/
  layout/           site header, footer, shell, theme toggle
  search/           search bar, filters, result cards, mention snippet
  entities/         hero, timeline, related entities, document list
  topics/           topic hero, document grid
  documents/        header, metadata panel, OCR panel, source links
  ui/               badge, button, card, section heading, stat pill, empty state
lib/
  api-types.ts      canonical UI-facing contract types
  api-client.ts     server-side fetcher used by pages; calls /api/*
  mock-data.ts      mock data factory (behind the API routes)
  format.ts         date, number, truncate, highlight helpers
  search.ts         search param parsing + URL building
  constants.ts      featured slugs, agency list, confidence levels
data/               JSON snapshots of mock payloads (not loaded at runtime)
sql/                BigQuery SQL for the curated + MVP warehouse layers
scripts/            helper scripts (e.g. export_mock_data.ts)
```

## Design system

Tokens are declared in `app/globals.css` and used throughout the components:

- **Color:** warm paper-like light mode, charcoal dark mode. The `data-theme`
  attribute on `<html>` switches palettes; `ThemeToggle` persists the choice
  to `localStorage` under `jfkrc-theme`.
- **Typography:** Source Serif 4 for display, Inter for body. Body text
  sits around 17 px with a 70-character reading width.
- **Layout:** a single `.container` rule caps content at 1200 px.
- **Motion:** 150–220 ms transitions on borders, backgrounds, and a subtle
  reveal animation (`.reveal`). Respects `prefers-reduced-motion`.

## API contract

All page data flows through the `/api/*` JSON endpoints. Types are defined
in `lib/api-types.ts`.

| Route | Response |
|---|---|
| `GET /api/home` | `HomeResponse` |
| `GET /api/search?q=…&mode=document\|mention` | `SearchResponse` |
| `GET /api/entity/:slug` | `EntityResponse` |
| `GET /api/topic/:slug` | `TopicResponse` |
| `GET /api/document/:id` | `DocumentResponse` |

Pages consume these via `lib/api-client.ts`, which accepts an optional
`JFK_API_BASE_URL` environment variable for pointing at a non-local API
host (e.g. a Cloud Run deployment).

## Warehouse pipeline

The `sql/` folder is the full warehouse build. Run files in the order their
filename prefix implies (`05_` → `10_` → `11_` → …). `sql/00_raw_notes.md`
documents the assumed inputs and the promotion logic.

### 1. Load NARA manifests into `jfk_raw.nara_manifest`

```bash
# Download the XLSX manifests for each release
for r in 2017-2018 2021 2022 2023; do
  curl -sSL -o "/tmp/jfk-$r.xlsx" \
    "https://www.archives.gov/files/research/jfk/national-archives-jfk-assassination-records-$r-release.xlsx"
done

# Normalize into one unified CSV
# (see scripts/normalize_nara_manifests.py for the full script)
python3 scripts/normalize_nara_manifests.py \
  --inputs /tmp/jfk-*.xlsx --out /tmp/jfk-data/jfk-records.csv

# Load into BigQuery
bq load --source_format=CSV --skip_leading_rows=1 --allow_quoted_newlines \
  --replace jfk_raw.nara_manifest /tmp/jfk-data/jfk-records.csv \
  record_num:STRING,file_name:STRING,release_date:STRING,formerly_withheld:STRING,agency:STRING,doc_date:STRING,doc_type:STRING,file_num:STRING,to_name:STRING,from_name:STRING,title:STRING,num_pages:STRING,originator:STRING,record_series:STRING,review_date:STRING,comments:STRING,pages_released:STRING,release_set:STRING,agency_from_prefix:STRING,pdf_url:STRING
```

### 2. Load ABBYY OCR into `jfk_staging`

The `scripts/ingest_abbyy.py` script handles the full pipeline: it lists
the 2,182 PDFs in the ABBYY repo via GitHub's tree API, downloads each
through the LFS media URL (one PDF on disk at a time — safe on tiny VMs),
runs `pdftotext`, chunks the output, and loads
`jfk_staging.abbyy_documents` + `jfk_staging.abbyy_text_chunks`.

```bash
# Default: streaming mode (disk-safe — never holds more than one PDF locally)
python3 scripts/ingest_abbyy.py \
  --out-dir /tmp/abbyy-out \
  --project jfk-vault \
  --dataset jfk_staging

# Faster for repeat runs if you have ~300 MB free:
python3 scripts/ingest_abbyy.py --clone \
  --repo-dir /tmp/abbyy/JFK-OCR \
  --out-dir /tmp/abbyy-out \
  --project jfk-vault --dataset jfk_staging

# Quick sanity check with 25 documents, no upload:
python3 scripts/ingest_abbyy.py --limit 25 --skip-load --out-dir /tmp/abbyy-out
```

Set `GITHUB_TOKEN` in the environment if you hit GitHub's unauthenticated
tree-API rate limit (60 req/hr).

### 3. Build curated + MVP tables

```bash
# Join ABBYY to NARA (produces jfk_staging.abbyy_to_nara_map)
bq query --use_legacy_sql=false < sql/05_abbyy_to_nara_map.sql

# Canonical record table (one row per RIF, latest-release wins)
bq query --use_legacy_sql=false < sql/10_curated_jfk_records.sql

# Text chunks (ABBYY preferred, description fallback)
bq query --use_legacy_sql=false < sql/11_curated_jfk_text_chunks.sql

# Entities + document-entity map (OCR now adds a real 'low'-confidence tier)
bq query --use_legacy_sql=false < sql/12_curated_jfk_entities.sql
bq query --use_legacy_sql=false < sql/13_curated_jfk_document_entity_map.sql

# MVP per-topic and per-entity tables
bq query --use_legacy_sql=false < sql/20_mvp_oswald_mentions.sql
bq query --use_legacy_sql=false < sql/21_mvp_topic_views.sql

# (Optional) Search indexes for SEARCH() queries
bq query --use_legacy_sql=false < sql/30_search_indexes.sql

# Data-quality views
bq query --use_legacy_sql=false < sql/90_dq_reports.sql
```

Re-run the appropriate subset whenever a source layer updates:

| Change | Re-run |
|---|---|
| New NARA release | `sql/10_` → `sql/13_` → `sql/21_` |
| New ABBYY documents | `scripts/ingest_abbyy.py` → `sql/05_` → `sql/11_` → `sql/13_` → `sql/20_` |
| Entity aliases edited | `sql/12_` → `sql/13_` → `sql/20_` |

### 4. Data-quality checks

After the pipeline runs, `jfk_staging` has five DQ views:

```sql
SELECT * FROM `jfk-vault.jfk_staging.dq_unmatched_abbyy`      LIMIT 50;
SELECT * FROM `jfk-vault.jfk_staging.dq_duplicate_abbyy_matches` LIMIT 20;
SELECT * FROM `jfk-vault.jfk_staging.dq_short_chunks`          LIMIT 20;
SELECT * FROM `jfk-vault.jfk_staging.dq_ocr_coverage_by_release`;
SELECT * FROM `jfk-vault.jfk_staging.dq_join_summary`;
```

### 5. Frontend → BigQuery

Each `app/api/*/route.ts` handler imports from `@/lib/warehouse.ts`, which
connects via `@google-cloud/bigquery` using Application Default Credentials.
The UI never imports warehouse code directly; the canonical contract is
`lib/api-types.ts`.

On Cloud Run, the runtime service account needs:
- `roles/bigquery.dataViewer` on the `jfk_curated` and `jfk_mvp` datasets
- `roles/bigquery.jobUser` at the project level

The default compute service account already has `roles/editor`, which
covers both.

## Data rules

- **Neutral archival language.** No sensational framing, no conspiracy
  tone, no lorem ipsum.
- **Machine-generated OCR is marked as such.** The document page shows a
  note under the OCR Excerpt heading; descriptions reference specific
  record groups (RG 65, 233, 263, 272, 541) rather than generic claims.
- **Confidence is not a judgment call.** It reflects where the match
  landed: `high` = title, `medium` = description, `low` = ABBYY OCR only.
- **Provenance is preserved.** Every row in `jfk_curated.jfk_text_chunks`
  records its `source_type` (`abbyy_ocr` or `description`), and every
  ABBYY chunk traces back to its source filename via
  `jfk_staging.abbyy_to_nara_map`.

## Accessibility

- Semantic HTML throughout (`<header>`, `<nav>`, `<main>`, `<footer>`,
  `<article>`, `<aside>`, `<section>`).
- Visible focus rings via `:focus-visible`.
- `prefers-reduced-motion` is honored.
- Search has a keyboard shortcut (`/`).
- Theme toggle exposes `aria-label` and title text.

## Non-goals (MVP)

- Live National Archives API calls.
- Semantic / vector retrieval — rule-based matching only. The `chunk` table
  is structured so embeddings can be layered on later.
- OCR of the full NARA collection. ABBYY's 2,176 RIFs cover the 2025
  release; older releases rely on description-level search until either
  ABBYY extends their corpus or we run Document AI ourselves.
- User accounts, bookmarks, annotations.

## License

This repository is intended for non-commercial research use. Underlying
primary records are produced by the U.S. federal government and are
in the public domain; derivative editorial content in this codebase is
released for archival study purposes only.
