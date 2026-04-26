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
  ingest_primary_sources.py     Warren/ARRB/Church → jfk_staging.primary_source_*
  load_pil_detections.py        PIL black-rect detections → docai_redactions
  jfk_docai_ingest.py           Document AI OCR pipeline (sync + batch, dry-run gated)
  rebuild_warehouse.sh          Runs the promotion SQL files in order
  requirements-docai.txt        Python deps for jfk_docai_ingest.py
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
- **Viewport meta lives in `app/layout.tsx`, not `<head>`.** In App
  Router, a literal `<meta name="viewport">` in `<head>` gets
  stripped/ignored. Use `export const viewport: Viewport = { width:
  "device-width", initialScale: 1, ... }`. Without it, mobile
  browsers render at ~980px and shrink to fit — the whole site
  looks unreadably tiny. (Regression caught 2026-04-18 on the
  Open Questions page.)
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
- **`jfk_records.digital_object_url` has casing + path-segment bugs.**
  Some rows encode `/DOCID-NNNN.pdf` (uppercase) but archives.gov only
  serves `/docid-NNNN.pdf` (lowercase) → 404 on every uppercase fetch.
  Some 2022/2023 rows have a doubled path segment (`/2022/2022/…`) that
  also 404s; collapse with `sed -E 's#/(20[12][0-9])/\1/#/\1/#'`. Any
  PDF fetcher against the `digital_object_url` column should try both
  the as-is URL, a lowercase-DOCID variant, a path-collapsed variant,
  and the combination (see `scripts/jfk_docai_ingest.py::_nara_url_variants`
  for the reference retry ladder).
- **Next.js middleware is edge-runtime only — no `node:crypto`.**
  `lib/admin-auth.ts` originally imported `createHmac` from
  `node:crypto`, which Webpack rejects when bundling `middleware.ts`
  (the edge runtime doesn't resolve `node:` URIs). Fix: write anything
  that middleware touches against the Web Crypto API (`crypto.subtle`)
  plus a small `toBase64Url`/`fromBase64Url` and constant-time compare.
  Regression caught on the first Cloud Run build of PR #16.

---

## Current state (keep this section fresh)

**Last updated:** 2026-04-26 (3-F zoomable timeline)

- **3-F zoomable D3 timeline (2026-04-26).** `/timeline` now defaults to
  a horizontal zoomable view; the previous chronological list is preserved
  at `/timeline?view=list` (also serves as the no-JS / screen-reader path).
  - **Stack.** `d3-scale` (time scale), `d3-zoom` (semantic zoom), `d3-time`
    (tick generators), `d3-selection` + `d3-transition` (animated programmatic
    zoom). All deps tree-shake; `/timeline` route bundle is 27.8 kB (137 kB
    first load). No `d3-axis` / no react timeline lib — SVG is hand-rolled
    matching the `/graph` and `/dealey-plaza` house pattern.
  - **Four zoom levels** keyed off `transform.k`: decade (k<4) renders dots
    on a single baseline; year (4≤k<30) splits events into 5 category lanes
    and labels are hidden; day (30≤k<250) shows headline labels; hour
    (k≥250) shows full labels truncated to 42 chars. The Nov 22–25, 1963
    marquee window is rendered as a translucent highlight band so it stays
    visible even at decade zoom; "72h Dallas" toolbar button auto-zooms to
    k≈800 centered on Nov 23 (hour level). Reset button returns to
    `zoomIdentity`.
  - **Components.** New `components/timeline/zoomable-timeline.tsx` (client),
    `components/timeline/event-card.tsx` (shared between zoom and list — the
    selected-event side panel renders the same card). New
    `components/timeline/list-view.tsx` extracts the prior page body into a
    server component; `app/timeline/page.tsx` is now a thin shell that
    decides between views via `searchParams.view`.
  - **Permalink interop.** Existing `#event-{id}` hashes (shipped in PR #29)
    auto-zoom to the target event and open the side panel on initial load
    *and* on subsequent `hashchange` events. Clicking an event dot calls
    `history.replaceState` with the hash so the link is copyable from the
    address bar.
  - **A11y.** SVG has `tabIndex=0` + `role="img"` + descriptive `aria-label`.
    Keyboard shortcuts when the SVG is focused: `+`/`-` zoom, `←`/`→` pan,
    `0` reset, `Esc` close panel. Hidden `<ol aria-label="Currently visible
    timeline events">` mirrors the events currently in the visible domain
    so screen readers can navigate without parsing the SVG. Axe-core CI
    gate passed clean. List view fallback covers users with JS disabled.
  - **Mobile.** SVG uses `viewBox` + `width:100%` so it scales; `touchAction:
    none` lets d3-zoom handle pinch + drag without browser scroll
    interference. Side panel is `position: fixed; width: min(440px, 96vw)`
    so it becomes ~full-screen on phones.
- **Redaction review queue `/admin/redactions` (2026-04-20, PR #16).**
  Human-in-the-loop gate for PIL-detected black-bar redactions, deployed
  as the first `/admin/*` surface on the site. Unblocks the internal side
  of the long-deferred 5-B public redaction diff viewer.
  - **Detector.** `~/redaction_detector_prototype.py` (lives in $HOME,
    not the repo — it's a calibration tool, not a pipeline step).
    PyMuPDF rasterize @ 150 DPI → binary threshold at intensity ≤90 →
    morphological opening with a 9×14 horizontal kernel to erode text
    glyphs while preserving redaction-bar-sized solid regions →
    `skimage.measure.label` for connected components → filter by area
    (0.05%–60% of page), min 25×10 px, extent ≥0.65, aspect 0.15–20.
    False-positive rate ~0.26% on a 60-doc `withholding_status='Redact'`
    sweep; **major finding — that manifest tag is decorrelated with
    visible black-bar redactions** (page-level withholding is the more
    common form), so the queue is indexed by detector output, not tag.
  - **DocAI ingest pilot (companion work).** `scripts/jfk_docai_ingest.py`
    + `scripts/requirements-docai.txt` stage NARA PDFs through
    `gs://jfk-vault-pdfs/` and the Document AI OCR processor `jfk-ocr`
    (ID `f4e0536f5f244cb1`, pinned to `pretrained-ocr-v2.1-2024-08-07`)
    into `jfk_staging.docai_*` tables. Smoke test loaded 12 docs / 39
    pages. `~/README.md` still documents one-time GCP/IAM setup.
    The script takes `--mode {sync|batch}`, `--limit N`, `--run-id`,
    and `--dry-run` (prints planned docs + GCS prefixes without any API
    calls). Batch mode (for >30-page docs) submits a `batchProcess`
    LRO, polls to completion, and merges the GCS JSON shards back into
    a single `documentai.Document` before the same parser runs on it.
    Queue view = `docai_backfill_queue` (already existed; just
    verified behavior). Pipeline status views = `sql/45` →
    `docai_pipeline_summary` + `docai_pipeline_by_release` +
    `docai_pipeline_errors` (read-only, no side effects).
  - **Data layer** (`sql/44_docai_redactions_review.sql`). Adds
    `review_status` / `reviewed_by` / `reviewed_at` / `reviewer_notes`
    to `jfk_staging.docai_redactions`. Creates `docai_review_queue`
    view (one row per doc, priority = `unreviewed_count * 10 +
    total_detections`, `LEFT JOIN`s to `docai_documents` and
    `jfk_records` so orphan detections still surface).
  - **Loader** (`scripts/load_pil_detections.py`). Reads detector output
    dirs, uploads overlay PNGs to `gs://jfk-vault-ocr/review/<doc>/`,
    wipes-and-reinserts detection rows per doc for idempotency.
    **Caveat:** the wipe destroys in-flight review state if you re-run
    the detector with new thresholds on a doc that already has
    confirmed/rejected rows — switch to MERGE before scaling beyond the
    seed.
  - **Admin auth** (`lib/admin-auth.ts`, `middleware.ts`). HMAC-SHA256
    signed HttpOnly session cookie, 7-day lifetime. Uses Web Crypto
    (`crypto.subtle`) rather than `node:crypto` so middleware.ts works
    in the edge runtime. Two Cloud Run env vars: `ADMIN_TOKEN` (shared
    secret) and `ADMIN_SESSION_SECRET` (HMAC key). Rotate by changing
    both. `REDACTION_REVIEW_BUCKET=jfk-vault-ocr` is the overlay host.
  - **Routes.** `/admin/login`, `/admin/redactions`, `/admin/redactions/
    [document_id]`. API: `GET /api/admin/redactions` (list), `GET/POST
    /api/admin/redactions/[id]` (detail + actions `confirm` / `reject` /
    `needs_split` / `confirm_all`), `GET /api/admin/redactions/[id]/
    image/[page]` (streams overlay PNG from GCS — proxy pattern, since
    the Cloud Run SA can't self-sign URLs without
    `iam.serviceAccounts.signBlob`).
  - **UI.** List is a priority-sorted table; detail view shows each page
    as a full-width overlay with a sidebar of numbered detections, each
    with per-detection Confirm/Reject/Split buttons and a bulk "Accept
    all N unreviewed" at the top. Inline styles per house convention;
    one client component (`components/admin/redaction-reviewer.tsx`)
    handles action POSTs and optimistic refresh from the returned doc
    payload.
  - **Seed.** 7 docs / 77 detections in the 124-10278 FBI series
    (10403 has the most at 29 candidates). Doc 389 was the calibration
    exemplar — detector catches 10 of ~12 visible bars on its page 2.
  - **Known follow-ups not in this PR:** (a) no undo/re-queue flow —
    once a detection is confirmed/rejected the UI has no path back,
    manual BQ `UPDATE` only; (b) no list filters or pagination (fine
    at 7 docs, painful past 700). The DocAI v2.1 `mean_page_confidence`
    parser bug and the missing batch path for >30-page docs were both
    addressed in the 2026-04-20 docai-structure wave.
- **Wave 3 entities — Warren Commission counsel, mob, Garrison,
  CIA Mexico City / CI (2026-04-20, PR #13).** Nine new entities
  completing the gameplan Appendix D 32-entity roster: `specter`,
  `marcello`, `trafficante`, `giancana`, `roselli`, `garrison`,
  `clay-shaw`, `goodpasture`, `jane-roman`. Each ships the T8
  launch package — row in `sql/12` (sort_orders 24-32), 5-7 facts in
  `sql/19`, 2 sources in `sql/16`, 3-8 timeline events in `sql/22`.
  Roster now **32 entities** (26 people + 6 orgs).
  - **Unified per-entity timeline.** The Oswald-only static
    `oswaldTimeline()` function in `lib/warehouse.ts` was deleted;
    `fetchEntity` now queries `timeline_events WHERE @slug IN
    UNNEST(related_entity_ids)` for every entity. All 22 previously-
    empty entity-page timelines now populate from BigQuery. Oswald's
    9 static events were already present in `sql/22`, so no
    migration needed.
  - **Cross-linked existing case-timeline rows.** Warren Report
    delivery → `specter`; HSCA Final Report → `marcello`,
    `trafficante`; Giancana killing → `giancana`,
    `church-committee`; Oswald Mexico City visit → `goodpasture`,
    `duran`. Also corrected a pre-existing data bug on the Roselli
    body-found row (date was 1976-05-04; actual date 1976-08-07).
  - **Mention backfill.** `sql/13` rerun picked up new aliases:
    clay-shaw 32, roselli 27, garrison 21, giancana 17, goodpasture
    16, jane-roman 15, trafficante 11, marcello 7, specter 6.
  - **Wave 3 ticket file:** `~/jfk_wave3_tickets.md`. Deferred items
    from the ticket spec that were NOT shipped: the `investigator`/
    `adjacent` category filter on `/entities` (would need a new
    `entity_category` column on `sql/12` + UI rework), the Playwright
    regression spec (no Playwright suite in the repo yet).
- **UX + mobile quick-wins (2026-04-20, PR #14).** 13 items from a
  codebase audit, all scoped behind `max-width: 480px` media queries
  so desktop rendering is unchanged.
  - **Mobile tap targets.** `components/layout/theme-toggle.tsx`
    34x34 → 44x44 (WCAG 2.5.5). `.dp-panel-close` in `app/globals.css`
    given a 44x44 tap target with flex centering.
  - **Popover / modal widths.** `.chunk-cite-popover` + the
    `<CiteButton>` popover widths: `60ch` / `72ch` →
    `min(Nch, calc(100vw − 32px))` so neither overflows the viewport
    on `<375px` screens. Keyboard-help modal in
    `components/layout/keyboard-shortcuts.tsx` gained
    `max-height: calc(100vh − 48px); overflow-y: auto` — the shortcut
    list was completely unscrollable on phones.
  - **Viz layout.** Graph range slider drops its `minWidth: 260` on
    `<480px` (was a horizontal-scroll trap); `.dp-legend` stacks
    vertically on `<480px`; home "At a Glance" grid `minmax(180px,
    1fr)` → `minmax(150px, 1fr)` so the 4 pills no longer force a
    2-up-with-overflow layout at 375px.
  - **Entity page polish.** Timeline vertical rule switched from
    `var(--border)` to `var(--border-strong)` (was invisible on dark
    theme). New "View all N documents mentioning X →" link below the
    top-10 document list, deep-linking to `/search?entity=SLUG`.
  - **Empty states + accessibility.** `/entities` fallback when
    neither people nor orgs render. Corrections honeypot:
    `position: absolute; left: -9999px` → `display: none` +
    `aria-hidden="true"` (keyboard users could previously tab into the
    hidden "Website" field).
  - **Search result card.** `scrollMarginTop` hardcoded 120px →
    `calc(var(--header-height, 64px) + 80px)` so `j`/`k` keyboard
    jumps don't hide results behind the sticky search band on mobile.
    Description snippet line-clamped to 3 lines via new
    `.search-result-snippet` CSS rule.
  - **Deliberately deferred** (logged for a follow-up wave): loading
    skeletons on 7 dynamic pages, touch dismissal on
    cryptonym/chunk-action popovers, graph label collision, Dealey
    pinch-zoom, `/search` pagination UI.
- **April hotfix cycle (2026-04-19).** P0 + 11 follow-on tickets shipped
  in one session, each as its own PR. Cycle re-audit + ticket file:
  `~/jfk_hotfix_tickets.md`. Headlines:
  - **P0 — entity SSR throw fix (PR #1).** All 20 `/entity/[slug]`
    pages were 500'ing because `fetchEntity` looped `TOPIC_DISPLAY_ORDER`
    and queried `jfk_mvp.physical_evidence` — a table that doesn't
    exist (physical-evidence is a redirect-only topic). Consolidated
    the existing ad-hoc filters into a single `MVP_QUERYABLE_TOPIC_SLUGS`
    constant in `lib/warehouse.ts` and routed all three call sites
    through it (`fetchEntity`, `topicCountsMap`, `loadSearchFacets`,
    plus the search-mode topic union).
  - **T1 — corpus number unification (PR #2).** Added `ocr_passages`
    to `corpus_manifest` view (sql/14, count of `abbyy_ocr` chunks =
    112,445). Threaded through `CorpusManifest` type → home At a
    Glance, `/search` empty-query headline, `/about/methodology`,
    `/about/editorial-policy`. Removed three hardcoded number sites.
    Single source of truth: every surface reads from the manifest.
  - **T2 — chunk anchors + per-chunk citations (PR #3).** OCR mention
    cards expose hover-revealed copy-link + cite popovers. Anchors
    switched from `#chunk-{mention-id}` to `#chunk-{N}` (N = the
    existing BQ `chunk_order`, no migration needed). New
    `ChunkActions` and `ChunkHashHandler` client components. New
    smooth-scroll + flash-highlight on hash navigation. `lib/citations.ts`
    gains `chunkOrder` + `siteUrl` inputs; deep links bake `#chunk-N`
    into Bluebook/Chicago/APA. 5 new vitests.
  - **T3 — topic-scoped search (PR #8).** Backend was already wired
    (filters.topics → UNION over MVP topic tables); shipped the
    visible affordance: `ActiveTopicChip` removable pill above the
    result list, plus removed the misleading "topic-scoped search is
    on the roadmap" copy from `/topic/[slug]`. Hardened
    `fetchSearch.filters.topics` against a hand-crafted
    `?topic=physical-evidence` URL via the same MVP_QUERYABLE_TOPIC_SLUGS
    defense.
  - **T4 — keyboard shortcut g h (PR #7).** Most of the spec was
    already shipped in Phase 4 wave 1b (KeyboardShortcuts component);
    only the `g h` chord (go home) was missing. Added the chord +
    matching help-modal row.
  - **T5 — public corrections workflow (PR #9).** New
    `jfk_curated.corrections_submissions` table (sql/40),
    `/corrections` form (server shell + client form),
    `POST /api/corrections` with surface allowlist + length-checks +
    email validation + honeypot, `ReportErrorLink` deep-entry on
    /entity/[slug] and /topic/[slug]. About pages no longer say
    "forthcoming". Admin triage view at `/admin/corrections` deferred
    on auth scheme (still tracked in roadmap).
  - **T6 — `/dealey-plaza` interactive map (PR #12).** New
    `jfk_curated.dealey_plaza_witnesses` table (sql/43) with 20
    witnesses sourced from WC Vols. 2-7. Schematic-SVG over a
    bounding-box-normalized lat/lng projection. Toggleable shot-origin
    filter chips (TSBD / Grassy knoll / Triple Underpass /
    Undetermined), click-to-read side panel with WC ref, neutrality
    disclaimer. No external map deps.
  - **T7 — Open Questions status pills + cryptonym tooltips (PR #10).**
    `jfk_curated.cryptonym_glossary` (sql/41) seeded with 24 entries
    (AM/LI/ZR/LC/KU/OD/PB/MH/HT/GP-prefixed). Added status /
    resolution_text / resolution_naids / resolution_citation_ids to
    `jfk_topic_batch_questions` (sql/42); a MERGE auto-tags **498
    of 1531** threads (32.5%) as `resolved` via word-boundary regex
    against the glossary. New `CryptonymMention` client component
    wraps detected tokens with a hover/focus popover. Threads now
    sort open → partially_resolved → resolved within each tension
    bucket; resolved ones render with reduced opacity + status pill
    + inline resolution text.
  - **T8 — Wave 2 entities Kostikov / de Mohrenschildt / Cubela
    (PR #11).** Three rows added to sql/12 (sort_orders 21/22/23),
    5-7 facts each in sql/19, 2 sources each in sql/16. Re-ran
    sql/13 to backfill alias mentions: cubela 216, de-mohrenschildt
    82, kostikov 12. Roster now 23 entities. The cryptonym glossary's
    `cubela` related_entity_ids resolve to a real page.
  - **T9 — evidence alt text + canonical links (PR #6).** Added
    image_alt_text / canonical_copy_url / canonical_copy_host to
    physical_evidence via a new sql/17a migration (separate from
    sql/17 to avoid mechanically rewriting all 33 rows; sql/17 has
    a header note flagging the dep). Backfilled the 3 image-bearing
    items (zapruder-film, CE-139, CE-133-A). UI: `<img alt>` reads
    from imageAlt; figcaption gains "View canonical copy at {host} →"
    link. axe-core CI sweep skipped (still tracked in roadmap).
  - **T10 — Phillips/Duran/Zapruder copy fixes (PR #4).** Phillips
    bio now correctly framed as "Chief of Covert Action, Mexico City
    station (1961-1965)" with primary responsibility for Cuban
    operations (was "Chief of Cuban Operations"). Duran tightened to
    "Mexican citizen" + WC-by-written-statement vs. HSCA-in-person.
    Zapruder chain-of-custody replaced with the 6-entry corrected
    sequence (Nov 23 $50k print rights → Nov 25 $100k all rights →
    1975 family return → 1997-04-24 ARRB designation → 1998-08-03
    eminent-domain take → 2000 $16M arbitration award).
  - **T11 — `/about` hub + roadmap (PR #5).** `/about` was 404'ing.
    Now a three-card hub (Methodology / Editorial policy / Roadmap).
    `/about/roadmap` lists 21 surfaces grouped by status (shipped /
    in_progress / planned), backed by hand-maintained `lib/roadmap.ts`.
    /ask, /compare, public dataset mirror, API key layer all marked
    "planned" so users probing those URLs see a deliberate signal.
    Footer "About" column gains Overview + Roadmap links.
  - **New SQL files added this cycle:** sql/40 (corrections), sql/41
    (cryptonym glossary), sql/42 (OQ status), sql/43 (dealey witnesses),
    sql/17a (evidence alt + canonical migration). None added to
    `rebuild_warehouse.sh` — they\'re hand-curated catalogs / one-shot
    migrations, not pipeline steps.
- **Polish follow-ups (2026-04-19).** Three loose ends closed after
  Phase 5-E:
  - **Mobile primary nav.** Site header's 7-item nav used to vanish
    below 720px. `.inner` now wraps to two rows on mobile; the nav
    gets `overflow-x: auto` with the scrollbar hidden so every item
    stays reachable by horizontal swipe. Brand subtitle hidden on
    mobile. New `--header-height` CSS var (64px desktop / 100px
    mobile) keeps the `/search` sticky band flush under the now-
    taller mobile header. 4-J's "Mobile primary nav" follow-up is
    closed.
  - **Copy-NAID button** next to the NAID display in document
    headers. navigator.clipboard.writeText + brief "✓ copied" state.
  - **Search empty-state copy** now mentions Semantic mode alongside
    Documents and Mentions.
  - Entity "also appears with" (originally planned) skipped —
    already implemented as the "Connected people & organizations"
    section on `/entity/[slug]`, computed per-request from
    `jfk_document_entity_map`. A future alignment pass could swap it
    to the aggregated `entity_cooccurrence` table + medium+ filter
    for consistency with `/graph`, but that would regress peer
    coverage for entities with only low-confidence mappings.
- **Phase 5-E public API v1 (2026-04-19).** Read-only, CORS-open,
  unauthenticated endpoints at `/api/v1/*` re-exposing the warehouse
  data under a stable contract:
  - `GET /api/v1/documents` (q, topic×, entity×, agency×, yearFrom,
    yearTo, confidence×, limit 1-200)
  - `GET /api/v1/documents/{naid}`
  - `GET /api/v1/entities`, `GET /api/v1/entities/{id}`
  - `GET /api/v1/topics`, `GET /api/v1/topics/{slug}`
  - `GET /api/v1/timeline` (from, to, category×)
  - `GET /api/v1/search/semantic` (q required, limit 1-50)
  - `GET /api/v1/openapi.json` — OpenAPI 3.1 spec with the base URL
    derived from request origin.
  - `GET /api/docs` — HTML docs page with endpoint list + examples.
  Shared helper `lib/api-v1.ts` wraps CORS + cache headers +
  preflight. PW-5E-2 (Firestore API keys + rate limits) is deferred.
- **Phase 5-C co-occurrence graph (2026-04-19).** `/graph` renders a
  force-directed entity network using `d3-force` + hand-rolled SVG
  (no react-force-graph-2d dep). `sql/32_entity_cooccurrence.sql`
  aggregates (entity_a, entity_b, year) pair counts from
  `jfk_document_entity_map` at medium+ confidence into
  `jfk_curated.entity_cooccurrence`. `fetchEntityCooccurrence` sums
  counts over a selected year window and drops edges with count<2
  plus nodes with no remaining peers. Year range slider refetches
  `/api/graph` on commit; node click → entity page, edge click →
  `/search?entity=a&entity=b`. Nav: new "Network" item between
  Timeline and Evidence.
- **Phase 5-A vector search (2026-04-19).** Semantic mode live on
  `/search`. `sql/31_chunk_embeddings.sql` registers the
  `jfk_curated.text_embedding` remote model (Vertex `text-embedding-005`,
  768 dims) and materializes `jfk_curated.chunk_embeddings` from the
  112,445 eligible ABBYY OCR chunks (≥40 chars), with a cosine IVF
  vector index. Runtime path: `lib/warehouse.ts fetchSemanticSearch`
  embeds the query with `RETRIEVAL_QUERY` task type, runs
  `VECTOR_SEARCH` top-20, and maps hits into MentionExcerpt shape with
  a `score` field (1 − cosine distance) that the sidebar renders as a
  percentage pill. Search UI gets a third "Semantic" tab alongside
  Documents/Mentions. Regeneration cost is ~$1.40, ~10 minutes — don't
  wire into `rebuild_warehouse.sh`.
- **Phase 4 Wave 1/2 (2026-04-19).** Search polish + mobile drawer.
  Topic/entity filters fixed (values now stable slugs/ids with
  `topicLabels`/`entityLabels` maps). Per-facet counts in the sidebar.
  Event-date range slider replacing the Year checkbox list.
  Cite button on document pages generating Bluebook/Chicago/APA from
  NAID metadata. Chunk anchors (`#chunk-*`) on OCR mention cards.
  Keyboard shortcuts (`/`, `j`/`k`, `g e/t/s` chord, `?` help modal).
  Local-storage saved searches (no email alerts). Focus trap + restore
  on keyboard help modal. Mobile bottom-sheet drawer for filters at
  <920px. Live axe-core run and mobile primary nav logged as follow-ups.
- **Phase 3 light wave (2026-04-19).** UI-over-seeded-data surfaces
  from the gameplan Phase 3. Full zoomable D3 timeline (3-F heavy),
  Dealey Plaza map (3-E), and corrections workflow (3-C) deferred to
  their own sessions.
  - **3-F `/timeline`** — vertical chronological view over all 57
    `timeline_events`, grouped by decade → year with sticky jump-nav.
    Each event card shows date + optional time, category tag, headline
    marker for importance=5, description, related-entity and
    related-topic chips linking to those pages.
  - **3-H `/releases`** — chronological (reverse-chron) declassification
    history filtered from `timeline_events` where
    `category='release'` (13 events). Correlates to corpus_manifest
    per-release counts where a year match exists.
  - **3-I `/bibliography`** — lists all 53 allowlisted citations from
    `citation_registry`, grouped by type (WC 27 / HSCA 13 / ARRB 1 /
    CHURCH 1 / REPORT 7 / NARA 4). Each row renders Bluebook, Chicago,
    APA formats.
  - **3-J Home "What's new" strip** — 3 most recent release events
    pulled from `timeline_events`, rendered above the Featured
    Entities section with a link to `/releases`.
  - **3-B `/about/editorial-policy`** — static written page covering
    neutrality posture, OQ/EF symmetry, source allowlist, banned-word
    list for AI content, AI disclosure requirement, corrections
    pointer, and what the site is not. Linked from the bibliography
    page and the footer.
  - **Navigation restructure.** Primary header now 7 items: Search,
    Entities, Topics, Timeline, Evidence, Open Questions, Established
    Facts. Footer reorganized: Navigate column, Analysis column (OQ /
    EF / Releases / Bibliography), About column (Methodology /
    Editorial policy).
- **Phase 2-A Wave 1 + Phase 2-C Established Facts (2026-04-19).**

- **Phase 2-A Wave 1 + Phase 2-C Established Facts (2026-04-19).**
  - **2-C: Established Facts** (`sql/22a`, 37 seeded facts across Settled
    / Well-supported / Contested tiers). Symmetric counterweight to
    /open-questions: the findings the WC/HSCA/ARRB/Church Committee
    agree on (single-bullet geometry, Tippit eyewitness IDs, Carcano
    provenance, Church Committee-documented CIA-Mafia plots) plus
    explicitly-tagged Contested facts (autopsy entry-wound location,
    Oswald motive, CIA/FBI withholding substantive effect). Each fact
    links to citation_registry IDs. Rendered at `/established-facts`,
    grouped by confidence tier. Added to primary nav.
  - **2-A Wave 1: 11 new entities** — Tippit, Zapruder, Connally, Earl
    Warren, Dulles, Blakey, Church Committee (org), ARRB (org), Duran,
    Phillips, Win Scott. Total roster now 20 entities. Each has:
    - Row in `sql/12_curated_jfk_entities.sql` (aliases, summary,
      description, born/died/active_years).
    - 3–5 structured facts in `sql/19_entity_facts.sql` (108 total
      facts across the roster).
    - 1–2 primary/reference sources in `sql/16_entity_sources.sql`
      (40 total sources).
    - Automatic alias-based document mentions from `sql/13` rerun:
      arrb 681, church-committee 306, duran 72, blakey 70, phillips 56,
      dulles 51, win-scott 44, zapruder 11, earl-warren 9, connally 5,
      tippit 1.
  - **/entities index page** — new listing of all 20 entities,
    separated by People / Organizations, with mention counts. Nav now
    routes "Entities" to /entities rather than /entity/oswald.
  - Phase 2 status: 2-A Wave 1 ✅, 2-B ✅, 2-C ✅. Wave 2-3 (de
    Mohrenschildt, Cubela, Kostikov, mob figures, Garrison, Clay Shaw,
    Goodpasture, Jane Roman) remain for a follow-up session.
- **Phase 2-B — 6 new topics (2026-04-19).**

- **Phase 2-B — 6 new topics (2026-04-19).** Expanded topic roster from
  6 to 12. Five new AI-driven topics go through the existing sql/25/26/
  27-29 pipeline; the sixth (physical-evidence) is a special-case topic
  that redirects to /evidence rather than generating AI content over the
  curated catalog.
  - New AI topics with full pipeline (summary + article + Open Questions):
    `tippit-murder` (4 docs), `dealey-plaza` (20 docs), `church-committee`
    (290 docs), `arrb-releases` (551 docs), `mob-castro-plots` (2,023
    docs). Each has MVP view in `sql/21b_mvp_new_topic_views.sql` with
    REGEXP_CONTAINS matching over title + description + OCR chunks (the
    last crucial for tippit-murder and dealey-plaza since the NARA
    metadata corpus is overwhelmingly pre-assassination intelligence
    files, not post-shooting DPD/FBI investigation records).
  - AI generation cost for this wave: ~$4 total (sql/27b MAP = $2.20 for
    22 new batches; sql/28 REDUCE = $1 for 10 topics' articles; sql/25/
    26/29 = ~$1). Existing 6 topics\' MAP stage was NOT re-run — sql/27b
    appends to jfk_topic_batch_questions rather than CREATE OR REPLACE,
    avoiding the ~$25 regeneration of CIA/FBI batches. tippit-murder
    generated 0 open questions (Gemini found nothing noteworthy in 4
    docs); the other 4 topics produced 4 to 70 questions each.
  - Special case: physical-evidence is in TOPIC_CATALOG and
    TOPIC_DISPLAY_ORDER (so /topics index lists it) but `/topic/
    physical-evidence` `redirect()`s to `/evidence`. Count in topics
    grid comes from jfk_curated.physical_evidence (33 items), not from
    a jfk_mvp view — handled via a branch in `topicCountsMap()`.
  - `rebuild_warehouse.sh` now runs `21b_mvp_new_topic_views.sql` after
    sql/21, and `27b_new_topics_batch_analyses.sql` after sql/27 (plus
    `26b_wc_rebalance.sql` after sql/26 — was missing before).
  - sql/26b WC rebalance was preserved across this session\'s full
    sql/26 regeneration by re-running it after sql/26.
- **Entity facts, timeline events, citation registry (2026-04-18).**
  Phases 1-F, 1-G, 1-H from the gameplan — first wave. Schemas + seed
  data for all three; minimal UI exposure (entity Quick Facts).
  - `sql/19_entity_facts.sql` — `jfk_curated.entity_facts` table, 56
    structured facts across the 9 existing entities. Each row has
    fact_key, fact_value, effective_date, source_type (WC/HSCA/ARRB/
    CHURCH/NAID/REFERENCE), source_ref, confidence. Unblocks Phase 2
    entity expansion and P0-8 full per-sentence citations.
  - `sql/22_timeline_events.sql` — `jfk_curated.timeline_events` table,
    57 high-signal events across biographical / operational /
    investigation / release / death categories. Covers Oswald pre-1963
    life, Cold War context (CIA founded, Bay of Pigs, Cuban Missile
    Crisis), Nov 22-25 1963 hour-by-hour (8 events from motorcade
    through LBJ swearing-in), WC/HSCA/ARRB/Church milestones, every
    document release (JFK Records Act 1992 through Jan 2026 release),
    and 5 neutrally-catalogued witness deaths. 300-event full target
    deferred; schema is live and ready for expansion.
  - `sql/23_citation_registry.sql` — `jfk_curated.citation_registry`
    table, 53 citations (27 Warren sources = report + 26 hearings
    volumes, 13 HSCA sources = report + 12 appendix volumes, ARRB
    Final Report, Church Book V, NAS/Ramsey 1982, Clark Panel 1968,
    Rockefeller 1975, DOJ 1988 letter, JFK Records Act 1992, Ruby v.
    Texas, 5 NARA/FBI finding aids). All `allowlisted=true`. Bluebook,
    Chicago, and APA formats per row. Unblocks Phase 3-I bibliography
    page and P0-8 full-version per-sentence footnotes.
  - `components/entities/entity-quick-facts.tsx` renders the per-entity
    facts as a dl-grid block above the entity description. Each fact
    shows a source-type chip (WC / HSCA / ARRB / REFERENCE) that
    tooltips the full source_ref and confidence. Displayed on all 9
    entity pages.
  - Warehouse / types updated: `EntityFact` in api-types, `facts` array
    on EntityResponse, fetchEntity joins `entity_facts`.
- **Physical evidence + primary-source ingest (2026-04-18).** Phases 1-D
  (medium slice) and 1-E from the gameplan.
  - `sql/17_physical_evidence.sql` — hand-curated `jfk_curated.physical_evidence`
    table, 33 items across 7 categories (ballistic, firearm, photographic,
    medical, documentary, clothing, environmental). CE-399, the Carcano,
    Zapruder film, backyard photos, Tippit shell casings, motorcade map,
    JFK/Connally clothing, sniper\'s-nest geometry. Each row carries
    short_name, long_description, chain_of_custody (where uncontroversial),
    referenced NAIDs + WC testimony refs, related entity slugs, and
    optional public-domain image URLs. Autopsy photographs are cataloged
    by description only — not hosted.
  - UI: `/evidence` list grid with anchor-linked category filters, `/evidence/[id]`
    detail pages with chain-of-custody timeline, WC testimony refs,
    related entities. Nav updated to include "Evidence". Fetchers:
    `/api/evidence` (index), `/api/evidence/[id]` (detail).
  - `scripts/ingest_primary_sources.py` — new Python script that fetches
    3 supplementary primary-source reports and chunks them at 1,200 chars:
    Warren Commission Report (26 chapters+appendices via archives.gov
    HTML = ~2.27M chars / 1,991 chunks), ARRB Final Report (single ASCII
    at archives.gov = 767K chars / 693 chunks), Church Committee Book V
    (Senate PDF -> pdftotext = 310K chars / 274 chunks). Loads to
    `jfk_staging.primary_source_docs` + `jfk_staging.primary_source_chunks`.
  - `sql/18_primary_sources.sql` appends the 3 documents to jfk_records
    (with document_ids `ps-warren-report`, `ps-arrb-report`,
    `ps-church-book-v`, `release_set = \'primary-source\'`) and their
    chunks to jfk_text_chunks (`source_type = \'primary_source\'`). Idempotent
    via NOT EXISTS guards.
  - `scripts/rebuild_warehouse.sh` updated to include `10a_document_versions.sql`
    and `18_primary_sources.sql` in the rebuild order. Primary sources
    re-append after every sql/10+sql/11 TRUNCATE+INSERT cycle.
  - Outcome: users can now search "single-bullet" / "Silvia Duran" /
    "acoustic" and get hits from the actual Warren Commission Report,
    ARRB analysis, and Church Committee conclusions — not just NARA
    metadata about them. Physical-evidence surface closes the
    "intelligence-flavored" neutrality gap the audit flagged.
- **Per-release version history (2026-04-18).** Part 1 of Phase 1-B from
  the gameplan. Replaces the "latest release wins" dedup model with a
  proper (NAID × release) version table.
  - `sql/10a_document_versions.sql` — new table `jfk_curated.document_versions`
    with one row per (NAID × release_set). Pulled from `nara_manifest`
    (collapsed across same-release same-NAID duplicates — RIF
    124-10190-10078 had 21 rows in 2017-2018 alone) plus a synthesized
    row per ABBYY-matched RIF with `release_set='2025'` and
    `is_ocr_source=true`. Resolves the prior tagging bug where docs
    whose OCR came from the 2025 re-release were labeled as "released
    2018" because that was the XLSX manifest they matched.
  - `sql/10` rewritten to read from `document_versions` instead of
    `nara_manifest`. Adds `release_history ARRAY<STRUCT<release_set,
    release_date, is_ocr_source>>` column to `jfk_records`. Metadata
    columns (title, agency, etc.) come from the most-recent MANIFEST
    row; `release_set` comes from the overall-latest row (so '2025' when
    OCR is sourced from there). One-time `drop table jfk_records` gate
    added for the schema change; subsequent rebuilds TRUNCATE+INSERT as
    before. Row count unchanged at 37,138.
  - `sql/14_corpus_manifest` extended with `records_in_<release>` and
    `records_with_2025_ocr` fields. Now reports 2,162 records tagged
    `2025` with OCR sourced from that release. `has_2025_release` flips
    to true.
  - New `components/documents/release-history.tsx` renders a left-to-
    right strip (earliest → latest) on every document page, with the
    OCR-source release visually highlighted. Includes a short copy line
    explaining that older releases were typically heavier redactions of
    the same record.
  - `ScopeBanner` copy updated to separately report "releases indexed"
    and "N records with OCR sourced from the 2025 re-release (NARA XLSX
    still pending)". Methodology page picks up the same language.
  - Follow-up: Part 2 of 1-B (character-level redaction diffs) still
    pending — requires acquiring pre-2025 PDFs to diff against.
- **Phase 0 accuracy + provenance pass (2026-04-18).** Ships the 9 audit
  findings from `jfk_research_center_gameplan.md` Phase 0.
  - Entity bios corrected in `sql/12`: Oswald (Tippit sentence inserted),
    Ruby (Oct 5 1966 reversal + Jan 3 1967 PE at Parkland), Angleton
    (explicit CI tenure 1954-1974). Oswald timeline in `lib/warehouse.ts`
    +`lib/mock-data.ts`: enlistment corrected (Dallas → MCRD San Diego,
    Oct 26 1956), Tippit murder event inserted between assassination and
    Ruby shooting.
  - `jfk_curated.corpus_manifest` view (`sql/14`) + `/api/corpus-manifest`
    + `ScopeBanner` on `/` and `/search` disclose the ~37K subset vs.
    ~300K total and flag 2025/2026 releases as not yet indexed.
  - `jfk_curated.editorial_footnotes` table (`sql/15`) attaches standing
    editorial notes to Open Questions surfaces by topic slug + trigger
    patterns. Seeded with the NAS/Ramsey 1982 rebuttal + DOJ 1988 decline
    for any HSCA acoustic / dictabelt / second-gunman / grassy-knoll-shot
    reference. Rendered via `components/open-questions/editorial-footnotes.tsx`.
  - `jfk_curated.jfk_entity_sources` sidecar (`sql/16`) seeded with 2-3
    primary + reference citations per existing entity (Warren Report,
    HSCA, ARRB, Church, NARA finding aids, NAS Panel). Rendered as a
    numbered "Sources" section on each entity page. Phase-0 precursor to
    the full per-sentence citation registry (Phase 1, BQ-1H).
  - `sql/26b_wc_rebalance.sql` regenerates only the `warren-commission`
    row in `jfk_topic_articles` with a rebalanced prompt (35-40%
    conclusions → 30-35% methodology → 25-30% criticisms / subsequent
    review). One Gemini Pro call; merges into the shared table so the
    other 5 topics are untouched.
  - AI footers in both `components/topics/topic-body.tsx` and
    `components/open-questions/article-body.tsx` now link to
    `/about/methodology`. Stub methodology page at `app/about/methodology/`
    pulls live numbers from `corpus_manifest`. Full methodology page is
    Phase 3 (UI-3A-1).
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

- **3-C Corrections admin triage view (deferred).** The public form +
  BQ table (`jfk_curated.corrections_submissions`, sql/40) +
  `/api/corrections` insert path shipped in the April 2026 hotfix
  cycle, alongside "Report an error on this page" links on entity and
  topic pages. The admin triage view at `/admin/corrections` remains
  blocked on the project's admin auth scheme decision (Cloud IAM vs.
  Identity-Aware Proxy vs. a small in-app allowlist).
- **3-E Dealey Plaza interactive page (shipped April 2026, follow-ups).**
  `/dealey-plaza` ships an SVG schematic of 1963 Dealey Plaza with 20
  witnesses plotted from sworn WC testimony, a toggleable shot-origin
  filter, and a click-to-read side panel. Backed by `sql/43_dealey_plaza_witnesses`.
  Future follow-ups (deferred): a satellite-tile MapLibre layer behind
  the schematic for users who want geographic context, a motorcade
  Z-frame scrubber, and per-witness links into the relevant Warren
  Commission Hearings volumes once those are individually NAID-addressable.
- **3-F zoomable timeline follow-ups (shipped 2026-04-26).** Default
  `/timeline` is the four-level zoom view (decade/year/day/hour); list
  view at `?view=list`. Possible polish if it surfaces in usage:
  (a) stacked-density bars per decade so very dense periods read at a
  glance; (b) animated zoom-on-permalink (currently snaps); (c) a
  "next event" jump arrow at year+ levels for keyboard users; (d) URL
  state for the current zoom transform so a copied URL re-opens at the
  same view.
- **5-B Redaction diff viewer (deferred from Phase 5 — internal side
  shipped 2026-04-20 in PR #16).** Public cross-release diff UI still
  pending per-release OCR text, which the DocAI pilot starts to unlock
  but hasn't scaled to. The internal human-in-the-loop review workflow
  (`/admin/redactions`, `docai_review_queue`, PIL black-rect detector)
  is live — it produces the `confirmed` detection signal that the
  eventual public diff view will read from. To finish 5-B we still
  need: (a) DocAI batch-processing path for >30-page docs; (b) a
  `release_text_versions` table keyed by (naid, release_set); (c) the
  public diff UI itself on `/document/[id]`.
- **DocAI v2.1 confidence parser (fixed 2026-04-20).**
  `docai_documents.mean_page_confidence` used to read 0 because
  `pretrained-ocr-v2.1-2024-08-07` stopped populating
  `page.layout.confidence` and moved the signal onto individual
  tokens. `scripts/jfk_docai_ingest.py::parse_document` now averages
  `page.tokens[*].layout.confidence` and falls back to
  `page.layout.confidence` for any future processor that re-populates
  the page-level field. The 12 pilot docs would need to be re-ingested
  (or their stored GCS responses re-parsed) to backfill the column.
- **5-D Grounded chatbot (deferred from Phase 5).** Depends on 5-A
  vector retrieval being live. Spec-flagged as highest-risk addition
  (hard citation guardrails, Gemini audit logging, 50-pair gold eval
  set, regression runs). Scope is a wave of its own; do not bolt on.
- **5-F BigQuery public dataset mirror (deferred from Phase 5).**
  Mirror curated tables to `bigquery-public-data:jfk_research_center.*`
  — mostly external coordination with Google's public-dataset program
  rather than coding work. Revisit once 5-E public API is live and
  stable so the mirror has a natural home for researchers.
- **5-E API keys + rate limits (PW-5E-2 follow-up).** Public v1 API
  shipped without keys or rate limits — fine for now while traffic is
  negligible, but Vertex-hit endpoints (`/search/semantic`) could get
  abused. When ready: Firestore-backed keys (free tier 1000 req/day,
  no-auth below some lower public threshold), per-key counters, kill
  switch on per-endpoint spend. See gameplan PW-5E-2.
- **Run axe-core live audit (4-I follow-up).** Static fixes are in
  (focus trap on help modal, `:focus-visible` rings, no missing alt/
  aria-label gaps), but the full WCAG 2.2 AA audit still needs a live
  run. Easiest: install the axe DevTools browser extension and run it
  on /, /search (with filters open + drawer open on mobile), /topic/*,
  /document/*, /timeline. Fix any serious/critical issues it surfaces.
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
- **Public API v1 conventions.** Every route under `/api/v1/*` uses
  `lib/api-v1.ts` for `jsonResponse` / `errorResponse` / `preflight`
  so CORS and cache headers stay uniform. Each route also exports
  `OPTIONS = preflight`. The OpenAPI spec at `/api/v1/openapi.json`
  must be updated when endpoints are added or their params change.
- **Embeddings are a fixed asset, not a rebuild step.**
  `jfk_curated.chunk_embeddings` (Phase 5-A) and the cosine IVF
  vector index cost ~$1.40 and ~10 minutes of Vertex calls to
  regenerate. Do not add `sql/31` to `rebuild_warehouse.sh`. When
  re-embedding is truly needed, run it manually via
  `bq query < sql/31_chunk_embeddings.sql`. The co-occurrence
  aggregation in `sql/32` is cheap and can be rebuilt freely.
- **Semantic asymmetry.** Vertex retrieval embeddings are
  task-type asymmetric: corpus side uses `RETRIEVAL_DOCUMENT` (in
  sql/31), query side uses `RETRIEVAL_QUERY` (in
  `fetchSemanticSearch`). Using the wrong task type on either side
  silently tanks recall without surfacing as an error.
- **No Tailwind, no CSS framework.** Design tokens in
  `app/globals.css`; most component styling is inline React `style` on
  server components so it renders server-side without runtime CSS-in-JS.
  Heavy viz libs (`react-force-graph-2d` etc.) are intentionally
  avoided — `/graph` uses `d3-force` for physics only and hand-rolls
  the SVG render.
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
