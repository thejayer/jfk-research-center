# JFK Research Center Cost Observability

The Cost Console starts as a small in-repo ledger so project spend can be tied
back to features, services, workflows, and Linear issues before Cloud Billing
reconciliation is enabled.

## Current Console

- Admin route: `/admin/cost-console`
- Event seed: `data/cost-console/cost-events.json`
- Budget config: `config/cost-budgets.json`
- Rollup helpers: `lib/cost-console.ts`

The first seed records the known direct-cost facts from the JFK Library media
work: 18 metadata/source-link records, four cache-eligible candidates, zero
downloaded images, and zero bytes stored under `public/media/jfkl`.

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

## Reconciliation Path

This first pass does not enable paid billing export. The intended next layer
matches the RegVault pattern:

1. Add a BigQuery cost ledger table for estimated events.
2. Add a scheduled exporter that writes a compact Cost Console JSON payload.
3. Enable Google Cloud Billing export to BigQuery.
4. Create reconciliation views that allocate actual service spend back to
   ledger rows by date, service, workflow, feature, and Linear issue.
5. Switch the Cost Console source from `manual_seed` or `ledger` to
   `reconciliation`.

Until that is enabled, the console shows manual seed data and marks broader
cloud infrastructure spend as pending.

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
