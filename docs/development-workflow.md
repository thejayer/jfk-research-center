# Development Workflow

Linear is the planning layer for this repo. GitHub is the code and deploy
layer. BigQuery and GCS are data infrastructure, and changes there should be
tracked with the same care as application code.

## Linear Project

Use the Linear project:

<https://linear.app/commerce-street/project/jfk-research-center-bd78f8e67bcb>

Team: `Commerce Street`

Default labels:

- `repo: jfk-research-center`
- `data-ingestion` for source acquisition, OCR, GCS, BigQuery, and provenance
  work
- `Feature`, `Improvement`, or `Bug` for product intent

## Issue Rules

Every meaningful change should start from a Linear issue, or create one before
implementation continues.

An issue should include:

- goal and user/research value;
- affected surface, such as app, API, deploy, data ingest, warehouse, or docs;
- verification plan;
- rollout or rollback note when production, BigQuery, GCS, or public data
  release behavior is involved.

Data-ingestion issues must also name:

- public source or mirror;
- destination bucket/table;
- provenance fields retained;
- rerun scope for downstream SQL or search indexes;
- whether mock mode or warehouse mode is affected.

## Branches, Commits, And PRs

Branch names should include the Linear identifier when practical:

```text
codex/com-123-jfk-search-filters
```

Commits and PR descriptions should reference the issue identifier and include:

- implementation summary;
- commands run;
- deploy/build status;
- data loaded, if any;
- source-provenance or warehouse caveats.

Move the Linear issue to `In Review` after code is pushed and CI/deploy status is
known. Move it to `Done` only after verification is documented on the issue.

## Standard Status Flow

```text
Backlog -> Todo -> In Progress -> In Review -> Done
```

Use `Canceled` for work we intentionally abandon and `Duplicate` when Linear has
another issue that owns the work.

## Build And Deploy Check

Before marking app work ready:

```bash
npm run typecheck
npm test
npm run build
```

Use mock mode for local review when BigQuery credentials or live warehouse data
are not part of the task:

```bash
npm run dev:mock
```

After a GitHub deploy, post the result back to the Linear issue. If a deploy
fails, keep the issue in `In Progress` or `In Review` and include the failing
workflow/job detail.

## Warehouse Safety

Production warehouse work should stay issue-tracked and explicit.

Before enabling or changing warehouse-backed behavior, confirm:

- source manifests and OCR inputs are loaded into the intended JFK datasets;
- curated tables exist and have smoke-test counts;
- search indexes or MVP tables have been rebuilt when relevant;
- `JFK_DATA_SOURCE`, `JFK_BQ_PROJECT`, and deploy environment variables are set
  intentionally for this repo only.
