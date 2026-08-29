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
  only — not `r.*` / `release_history`. Card snippets, mention excerpts, and
  `/api/document` page reads use `search_ocr_chunks`, clustered by
  `document_id` (the snippet job is limited to the current result page's IDs).
  Until sql/33 is applied, document search degrades to title/description only
  (Oswald-class totals drop the OCR-only band) rather than scanning chunks
  again.
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
  --update-secrets=ADMIN_TOKEN=admin-token:1,ADMIN_SESSION_SECRET=admin-session-secret:1
```

5. Monitor the next 24 hours using `sql/91_cost_guardrail_monitoring.sql` and
   Cloud Run structured events named `cost_control_block` and
   `cost_control_rate_limit`.

## Verifying cheaper public search

Apply `sql/33_search_ocr_access.sql` once (or via `rebuild_warehouse.sh`) before
judging production bytes. Then:

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
# Expect 200 and total near the pre-change 887 (token prefix vs LIKE
# '%oswald%' can move a few percent; high+medium title/description hits
# stay). Warehouse /api/v1 stays keyed:
curl -sS -o /dev/null -w "%{http_code}\n" "https://researchjfk.ai/api/v1/documents?q=oswald"

# INFORMATION_SCHEMA.JOBS_BY_PROJECT for route=api_search should show
# billed GiB dropping by roughly an order of magnitude per cache-miss
# search (one token-cluster job + slim jfk_records columns, no second
# chunk_text snippet scan). sql/91 query 3 is the labeled rollup.
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
