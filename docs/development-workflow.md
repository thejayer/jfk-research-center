# Development Workflow

GitHub is the planning, review, and deploy layer for this repo. Track work in
[GitHub Issues](https://github.com/thejayer/jfk-research-center/issues).
BigQuery and GCS are data infrastructure, and changes there should be tracked
with the same care as application code.

## Issues And Pull Requests

Every meaningful change should start from a GitHub issue (or an equivalent
written goal in the pull request) that names:

- goal and user or research value;
- affected surface, such as app, API, deploy, data ingest, warehouse, or docs;
- acceptance criteria and verification commands;
- rollout or rollback notes when production, BigQuery, GCS, or public data
  release behavior is involved.

Data-ingestion work must also name:

- public source or mirror;
- destination bucket or table;
- provenance fields retained;
- rerun scope for downstream SQL or search indexes;
- whether mock mode or warehouse mode is affected.

Branch names should be descriptive:

```text
fix/jfk-search-filters
```

Commits and pull request descriptions should include:

- implementation summary;
- commands run;
- deploy or build status;
- data loaded, if any;
- source-provenance or warehouse caveats.

Open the pull request when the code is pushed and validation evidence is
known. Merge only after review and CI are green.

## Build And Regression Gates

Before marking application work ready:

```bash
npm run typecheck
npm test
npm run build
npm run audit:a11y
```

`npm run audit:a11y` starts the app with deterministic mock data and checks the
home, empty search, queried search, and representative document routes at
desktop and mobile viewports. It runs axe, tray keyboard-focus checks,
horizontal-overflow and chrome-collision checks, and the queried-search
first-result visibility check.

The command writes `axe-report.json`. Failing scenarios also write screenshots
to `axe-artifacts/`, and CI uploads both as the
`accessibility-regression-report` artifact. To audit an existing deployment
instead of the local mock app:

```bash
npm run audit:a11y -- https://researchjfk.ai
```

Use mock mode for other local review when BigQuery credentials or live
warehouse data are not part of the task:

```bash
npm run dev:mock
```

After a GitHub deploy, record the result on the tracking issue. If a deploy
fails, keep the issue open and include the failing workflow and job detail.

## Warehouse Safety

Production warehouse work should stay issue-tracked and explicit.

Before enabling or changing warehouse-backed behavior, confirm:

- source manifests and OCR inputs are loaded into the intended JFK datasets;
- curated tables exist and have smoke-test counts;
- search indexes or MVP tables have been rebuilt when relevant;
- `JFK_DATA_SOURCE`, `JFK_BQ_PROJECT`, and deploy environment variables are set
  intentionally for this repo only.
