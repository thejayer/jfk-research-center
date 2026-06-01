# JFK Research Center Cost Observability

The Cost Console starts as a small in-repo ledger so project spend can be tied
back to features, services, workflows, and Linear issues before Cloud Billing
reconciliation is enabled.

## Current Console

- Admin route: `/admin/cost-console`
- Event seed: `data/cost-console/cost-events.json`
- Budget config: `config/cost-budgets.json`
- Rollup helpers: `lib/cost-console.ts`
- Runtime guardrails: `middleware.ts` and `lib/cost-controls.ts`
- Monitoring queries: `sql/91_cost_guardrail_monitoring.sql`

The first seed records the known direct-cost facts from the JFK Library media
work: 18 metadata/source-link records, four cache-eligible candidates, zero
downloaded images, and zero bytes stored under `public/media/jfkl`.

## Runtime Guardrails

The public routes that can trigger warehouse-backed work are protected in three
layers:

- Known crawler user agents are blocked before route rendering.
- Cost-sensitive routes are rate-limited per client and route bucket. Defaults:
  `/api/search` 20/minute, `/search` 30/minute, compare routes 30/minute, and
  document routes 60/minute.
- BigQuery jobs default to `JFK_BQ_MAX_BYTES_BILLED=268435456` bytes per job,
  and semantic search stays disabled while `JFK_API_DISABLE_SEMANTIC_SEARCH=1`.

Rate limit env overrides:

- `JFK_COST_RATE_LIMIT_MAX_REQUESTS`: positive integer override for every
  cost-sensitive route bucket.
- `JFK_COST_RATE_LIMIT_WINDOW_SECONDS`: positive integer window size.
- `JFK_COST_RATE_LIMIT_DISABLED=1`: emergency bypass only.
- `JFK_TRUSTED_PROXY_HOPS`: positive integer count of trusted proxy hops before
  `x-forwarded-for` / `x-real-ip` are used for rate-limit client keys.

The in-app limiter is intentionally cheap and per Cloud Run instance. Keep it
enabled, but use Cloud Armor or an upstream edge limit as the durable perimeter
if traffic spikes continue.

## Event Shape

Each event should include:

- `eventDate`: ISO date for the cost event.
- `feature`: stable product lane such as `rights_aware_media`.
- `service`: source or cloud service such as `jfk_library`, `bigquery`, or
  `vertex_ai`.
- `operation`: stable operation name.
- `workflow` and optional `workflowRunId`: GitHub Actions or manual workflow
  attribution.
- `linearIssue`: Linear issue id when the run belongs to feature work.
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

- `feature`
- `linear_issue`
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
   ledger rows by date, service, workflow, feature, and Linear issue.
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
   Cloud Run logs for `429` and crawler `403` responses.

## Workflow Convention

Cost-producing jobs should set these values before they run:

- `COST_FEATURE`
- `LINEAR_ISSUE`
- `GITHUB_WORKFLOW`
- `GITHUB_RUN_ID`

Good Linear comment format after a paid or potentially paid run:

```text
Cost run summary
- Workflow: Refresh JFK media manifest
- Run: 123456789
- Feature: rights_aware_media
- Usage: 18 source records, 0 cached files, 0 bytes stored
- Estimated cost: $0.00 direct media cost
- Output: metadata-only JFK Library media pointers
```
