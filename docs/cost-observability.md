# JFK Research Center Cost Observability

The Cost Console starts as a small in-repo ledger so project spend can be tied
back to features, services, workflows, and Manage work packets before Cloud
Billing reconciliation is enabled.

## Current Console

- Admin route: `/admin/cost-console`
- Event seed: `data/cost-console/cost-events.json`
- Budget config: `config/cost-budgets.json`
- Rollup helpers: `lib/cost-console.ts`
- Runtime guardrails: `middleware.ts` and `lib/cost-controls.ts`
- Monitoring queries: `sql/91_cost_guardrail_monitoring.sql`
- Daily monitor: `.github/workflows/cost-monitor.yml`

The first seed records the known direct-cost facts from the JFK Library media
work: 18 metadata/source-link records, four cache-eligible candidates, zero
downloaded images, and zero bytes stored under `public/media/jfkl`.

## Runtime Guardrails

The public routes that can trigger warehouse-backed work are protected in six
layers:

- Known crawler user agents and the narrow Android 6 / Nexus 5 / Chrome 65
  fingerprint observed in the July 2026 rotating campaign are blocked before
  route rendering.
- Cost-sensitive routes are rate-limited per client and route bucket. Defaults:
  `/api/search` and `/api/v1/documents` 20/minute, `/search` 30/minute,
  `/api/v1/search/semantic` 10/minute, compare routes 30/minute, and document
  routes 60/minute.
- BigQuery jobs default to `JFK_BQ_MAX_BYTES_BILLED=268435456` bytes per job,
  and semantic search stays disabled while `JFK_API_DISABLE_SEMANTIC_SEARCH=1`.
- Search responses use a bounded, per-instance promise/TTL cache. It coalesces
  concurrent identical searches and reuses successful responses for five
  minutes.
- Document and mention result queries include their total via a window count,
  eliminating the normal second count scan. Exact archive identifiers use
  indexed equality predicates instead of OCR and broad facet scans.
- Public `/api/search` document mode no longer `LIKE`s `jfk_text_chunks.chunk_text`.
  That column is the fat OCR body (~100+ MiB per full scan) and used to be read
  twice per query (hit IDs + snippets). Low-confidence / OCR-only hits now come
  from `jfk_curated.search_ocr_document_tokens` (sql/33), clustered by token, so
  `q=oswald` is a prefix range on one cluster. Document jobs select card columns
  only — not `r.*` / `release_history`. `search_ocr_chunks` is 143 MB in a
  single cluster block, so literal `IN` lists and even `document_id = @id`
  still bill ~128–137 MiB. Card snippets and mention excerpts therefore
  read `jfk_curated.search_ocr_card_excerpts` (sql/34): one 500-character
  first-chunk window per OCR document (~1–2 MB). A full scan of that table
  is the on-demand 10 MiB floor, not 128 MiB. The excerpt is not a
  LIKE-over-full-body hit; cards fall back to title/description if the
  thin table is missing.   `/api/document` OCR no longer reads
  `search_ocr_chunks` / `jfk_text_chunks`. First page and later pages
  come from `search_ocr_page_meta` + partitioned `search_ocr_pages`
  (sql/35). Metadata for a document open (record, entity map, related
  cards, topic slugs, page-meta) is one bundled job; repeats of the
  same id are served from the in-process document cache. Until sql/33 is applied, document search degrades to
  title/description only (Oswald-class totals drop the OCR-only band)
  rather than scanning chunks again.
- Privacy-safe request ids and hashed request fingerprints are propagated
  through a signed server-side loopback request and attached to BigQuery jobs
  as labels. `/api/search` is `api_search`; `/api/document`, `/api/entity`,
  `/api/evidence/:id`, and `/api/home` now set `route` as well so they do not
  land in the unattributed bucket. Block and rate-limit decisions emit
  structured logs without raw queries or client addresses.

Cache hits and coalesced searches do not create new BigQuery jobs. Consequently,
`request_id` and `request_fingerprint` labels appear only on cache misses; the
monitoring queries must not be read as one warehouse job per caller.

Rate limit env overrides:

- `JFK_COST_RATE_LIMIT_MAX_REQUESTS`: positive integer override for every
  cost-sensitive route bucket.
- `JFK_COST_RATE_LIMIT_WINDOW_SECONDS`: positive integer window size.
- `JFK_COST_RATE_LIMIT_DISABLED=1`: emergency bypass only.
- `JFK_LEGACY_MOBILE_BLOCK_DISABLED=1`: bypass only the July legacy-mobile
  fingerprint block; known-crawler blocking remains enabled.
- `JFK_TRUSTED_PROXY_HOPS`: positive integer count of trusted proxy hops before
  `x-forwarded-for` / `x-real-ip` are used for rate-limit client keys.
- `JFK_SEARCH_CACHE_TTL_SECONDS`: positive cache lifetime; default `300`.
- `JFK_SEARCH_CACHE_MAX_ENTRIES`: positive per-instance LRU bound; default
  `500`.
- `JFK_SEARCH_CACHE_DISABLED=1`: emergency cache bypass.
- `JFK_DOCUMENT_CACHE_TTL_SECONDS`: public `/api/document/:id` (and the SSR
  page that fans out to it) in-process TTL; default `300`.
- `JFK_DOCUMENT_CACHE_MAX_ENTRIES`: positive per-instance LRU bound; default
  `2000` (covers the OCR corpus on one Cloud Run instance).
- `JFK_DOCUMENT_CACHE_DISABLED=1`: emergency document-cache bypass.

Cache hits and coalesced document opens do not create new BigQuery jobs.
The first view still runs a bundled metadata job plus one partitioned
OCR page job. Repeats of the same `document_id` + `?chunk=` reuse the
in-process payload. 404s and warehouse failures are not cached.

The in-app limiter is intentionally cheap and per Cloud Run instance. Keep it
enabled, but use Cloud Armor or an upstream edge limit as the durable perimeter
if traffic spikes continue. The current project has no shared limiter backend
provisioned, so this remains an infrastructure follow-up rather than an
application configuration switch.

## Automated 24-Hour Monitor

The `JFK 24-hour cost monitor` workflow runs daily at 06:15 UTC and can also be
started manually. It verifies that the latest Cloud Run revision is ready and
serving 100% of traffic, checks the public home route, counts structured block
and rate-limit events, and compares BigQuery jobs and billed GiB across the
current and previous rolling 24-hour windows.

Each run writes a report to the GitHub Actions job summary. A rise in billed GiB
adds a workflow warning without failing the monitor; deployment health failures
still fail the job. Log counts are capped at 10,000 entries per signal.

## Event Shape

Each event should include:

- `eventDate`: ISO date for the cost event.
- `feature`: stable product lane such as `rights_aware_media`.
- `service`: source or cloud service such as `jfk_library`, `bigquery`, or
  `vertex_ai`.
- `operation`: stable operation name.
- `workflow` and optional `workflowRunId`: GitHub Actions or manual workflow
  attribution.
- `linearIssue`: legacy packet-attribution field retained for compatibility;
  use the corresponding Manage packet id when the run belongs to packet work.
- `estimatedCostUsd` and optional `actualCostUsd`.
- Usage counters: `requestCount`, `inputTokens`, `outputTokens`, `rowCount`,
  `byteCount`, and `billingRows`.

## Billing Export Rows

`buildCostConsoleData` also accepts `billingRows` so Cloud Billing export data
can be merged with ledger estimates. Rows may use native export-style nested
fields (`service.description`, `sku.description`, `usage_start_time`, `project`,
`labels`, `credits`) or compact aliases (`serviceDescription`, `skuDescription`,
`actualCostUsd`, `linearIssue`, `workflowRunId`).

Recommended labels for cost-producing jobs:

- `app`
- `request_id`
- `request_fingerprint`
- `traffic_class`
- `route`
- `search_mode`
- `github_workflow`
- `github_run_id`

The importer computes actual cost as `cost + credits.amount` unless an explicit
net/actual field is provided. Missing feature labels are grouped under
`unattributed_billing`.

## Reconciliation Path

The intended reconciliation path matches the RegVault pattern:

1. Add a BigQuery cost ledger table for estimated events.
2. Add a scheduled exporter that writes a compact Cost Console JSON payload.
3. Enable Google Cloud Billing export to BigQuery.
4. Create reconciliation views that allocate actual service spend back to
   ledger rows by date, service, workflow, feature, and Manage packet.
5. Switch the Cost Console source from `manual_seed` or `ledger` to
   `reconciliation`.

Until that is enabled, the console shows manual seed data and marks broader
cloud infrastructure spend as pending.

## GCP Guardrail Checklist

Use the Google Cloud docs as the source of truth while applying these controls:

- Budgets and alerts:
  <https://docs.cloud.google.com/billing/docs/how-to/budgets>
- Cloud Billing export setup:
  <https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-setup>
- BigQuery custom query quotas:
  <https://docs.cloud.google.com/bigquery/docs/custom-quotas>
- Cloud Run Secret Manager secrets:
  <https://docs.cloud.google.com/run/docs/configuring/services/secrets>

Recommended setup for this project:

1. Create a monthly Cloud Billing budget for the JFK project/billing account
   with alerts at 50%, 80%, 100%, and forecasted 100%.
2. Enable standard usage-cost Cloud Billing export to a dedicated BigQuery
   dataset, for example `billing_export`, in the same billing-admin project.
3. Set BigQuery custom quotas for the project. Start with a project-level
   `QueryUsagePerDay` of 1 TiB/day and a per-user
   `QueryUsagePerUserPerDay` of 0.25 TiB/day, then tune after 24 hours of
   normal production traffic.
4. Move Cloud Run secrets out of plain env vars after creating Secret Manager
   entries. Update deploy only after the secrets exist, for example:

```bash
gcloud run services update jfk-research-center \
  --region=us-central1 \
  --project=jfk-vault \
  --update-secrets=JFK_API_KEYS=jfk-api-keys:latest,ADMIN_TOKEN=jfk-admin-token:latest,ADMIN_SESSION_SECRET=jfk-admin-session-secret:latest
```

5. Monitor the next 24 hours using `sql/91_cost_guardrail_monitoring.sql` and
   Cloud Run structured events named `cost_control_block` and
   `cost_control_rate_limit`.

## Verifying cheaper public search

Apply `sql/33_search_ocr_access.sql` and **`sql/34_search_ocr_card_excerpts.sql`**
before judging production snippet bytes (sql/34 must exist before the app
revision that reads it). Then:

```bash
# Token lookup should dry-run near the 10 MiB on-demand minimum, not the
# full jfk_text_chunks body (~100+ MiB historically).
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  'SELECT document_id
     FROM `jfk-vault.jfk_curated.search_ocr_document_tokens`
    WHERE token >= "oswald" AND token < "oswale"
    GROUP BY document_id'

# Contrast: the retired path scanned every OCR chunk body.
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  'SELECT document_id
     FROM `jfk-vault.jfk_curated.jfk_text_chunks`
    WHERE source_type IN ("abbyy_ocr", "docai_ocr")
      AND LOWER(chunk_text) LIKE "%oswald%"
    GROUP BY document_id'

# After Cloud Run picks up the revision, site search stays anonymous:
curl -sS "https://researchjfk.ai/api/search?q=oswald&limit=1"
# Expect 200 and total near 886 (487 high / 17 medium / 382 low).
# Warehouse /api/v1 stays keyed:
curl -sS -o /dev/null -w "%{http_code}\n" "https://researchjfk.ai/api/v1/documents?q=oswald"

# Thin excerpt table must dry-run at the 10 MiB floor, not 128 MiB.
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  "SELECT document_id, excerpt
     FROM \`jfk-vault.jfk_curated.search_ocr_card_excerpts\`
    WHERE document_id IN ('104-10086-10152')"

# After deploy, uncached Oswald snippet jobs should reference
# search_ocr_card_excerpts (not search_ocr_chunks) and bill ~10 MiB.
# INFORMATION_SCHEMA.JOBS_BY_PROJECT route=api_search. sql/91 query 3.
```

## APPLY BEFORE MERGE — document page OCR (sql/35)

`search_ocr_chunks` is one 143 MB cluster block. Any `SELECT chunk_text`
from that table (or `jfk_text_chunks`) bills ~137 MiB even with
`document_id = @id`. Do **not** use `search_ocr_card_excerpts` (500
chars) as the document reader body.

Apply **before** deploying the app revision:

```bash
bq query --project_id=jfk-vault --use_legacy_sql=false --format=none \
  < sql/35_search_ocr_pages.sql
```

Dry-run the cheap path (must be ~10 MiB, not 137):

```bash
# Sample NAID 124-10190-10075 has OCR in search_ocr_page_meta.
# 104-10086-10152 does not — do not use it to judge the reader.
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  "SELECT document_id, chunk_count, doc_shard
     FROM \`jfk-vault.jfk_curated.search_ocr_page_meta\`
    WHERE document_id = '124-10190-10075'"

# One page. Replace SHARD and FIRST_ORDER with values from the meta row.
# require_partition_filter=true — omit doc_shard and the job fails.
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  "SELECT chunk_order, page_label, LENGTH(chunk_text) AS n
     FROM \`jfk-vault.jfk_curated.search_ocr_pages\`
    WHERE doc_shard = SHARD
      AND document_id = '124-10190-10075'
      AND chunk_order = FIRST_ORDER"
```

After Cloud Run picks up the revision (`set -e`; these curls must fail closed):

```bash
# First-party document + first OCR page. Public (no API key).
# 124-10190-10075 has OCR. 104-10086-10152 does not.
doc_json=$(mktemp)
doc_http=$(curl -sS -o "$doc_json" -w "%{http_code}" \
  "https://researchjfk.ai/api/document/124-10190-10075")
test "$doc_http" = "200"
python3 - "$doc_json" <<'PY'
import json, sys
doc = json.load(open(sys.argv[1]))["document"]
text = doc.get("ocrExcerpt") or ""
if doc.get("ocrBodyUnavailable"):
    raise SystemExit("ocrBodyUnavailable")
if not doc.get("hasOcr"):
    raise SystemExit("hasOcr is false")
if len(text) <= 500:
    raise SystemExit(f"first-page text too short: {len(text)} (card excerpt is 500)")
print("ok document", len(text), doc.get("chunkCount"))
PY

page_json=$(mktemp)
page_http=$(curl -sS -o "$page_json" -w "%{http_code}" \
  "https://researchjfk.ai/api/document/124-10190-10075/ocr")
test "$page_http" = "200"
python3 - "$page_json" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1]))
text = (payload.get("page") or {}).get("text") or ""
if payload.get("ocrBodyUnavailable"):
    raise SystemExit("ocrBodyUnavailable")
if len(text) <= 500:
    raise SystemExit(f"page text too short: {len(text)} (card excerpt is 500)")
print("ok page", len(text), payload.get("chunkCount"))
PY

# Search and v1 unchanged:
search_http=$(curl -sS -o /tmp/jfk-search.json -w "%{http_code}" \
  "https://researchjfk.ai/api/search?q=oswald&limit=1")
test "$search_http" = "200"
v1_http=$(curl -sS -o /dev/null -w "%{http_code}" \
  "https://researchjfk.ai/api/v1/documents?q=oswald")
test "$v1_http" = "401"

# INFORMATION_SCHEMA.JOBS_BY_PROJECT:
# route=api_document / api_document_ocr must not reference
# search_ocr_chunks or jfk_text_chunks for the body. Billed bytes
# per page-or-doc OCR job should be the 10 MiB floor, not 137 MiB.
```

## APPLY BEFORE MERGE — document topic slugs (sql/36)

Live 00168 still runs a `UNION ALL` of `EXISTS` over 11 full-width
`jfk_mvp.*_docs` tables on every `/api/document` open (~110 MiB). That
job was 60% of compute-SA bytes after PR 129.

Apply **before** deploying the app revision:

```bash
bq query --project_id=jfk-vault --use_legacy_sql=false --format=none \
  < sql/36_document_topic_map.sql
```

Until the table exists, document topic chips are empty (no 500, no
EXISTS fallback). Search and page OCR are unchanged.

Dry-run after apply (expect the **10 MiB** floor, not 110):

```bash
bq query --project_id=jfk-vault --use_legacy_sql=false --dry_run --format=prettyjson \
  "SELECT topic_slug
     FROM \`jfk-vault.jfk_curated.document_topic_map\`
    WHERE document_id = '124-10190-10075'"
```

After Cloud Run picks up the revision:

```bash
# Topic chips should still be present when the map has rows.
curl -sS -o /tmp/jfk-doc.json -w "%{http_code}\n" \
  "https://researchjfk.ai/api/document/124-10190-10075"
# Expect 200. relatedTopics slugs from the thin map, not an empty
# payload solely because OCR is present.

# INFORMATION_SCHEMA.JOBS_BY_PROJECT route=api_document:
# must not reference jfk_mvp.*_docs with EXISTS.
# Topic-slug job (if any) should read document_topic_map at ~10 MiB.
# Page OCR must still be search_ocr_page_meta / search_ocr_pages.
```

## Workflow Convention

Cost-producing jobs should set these values before they run:

- `COST_FEATURE`
- the Manage packet id in the legacy `LINEAR_ISSUE` compatibility field
- `GITHUB_WORKFLOW`
- `GITHUB_RUN_ID`

Good Manage packet update format after a paid or potentially paid run:

```text
Cost run summary
- Workflow: Refresh JFK media manifest
- Run: 123456789
- Feature: rights_aware_media
- Usage: 18 source records, 0 cached files, 0 bytes stored
- Estimated cost: $0.00 direct media cost
- Output: metadata-only JFK Library media pointers
```
