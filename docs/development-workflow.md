# Development Workflow

Commerce Street Manage is the planning and work-tracking layer for this repo.
GitHub is the code, review, and deploy layer. BigQuery and GCS are data
infrastructure, and changes there should be tracked with the same care as
application code.

## Manage Work Packets

Every meaningful change should start from a ready CSC packet in Manage:

<https://manage.commercestreet.studio>

Claim a packet before implementation and keep its branch, pull request,
validation, changed files, blockers, and next steps current. The lifecycle is:

```text
ready -> claimed -> in_progress -> needs_review -> done
```

Use `blocked` only when work cannot continue. Close a packet as `done` only
after its pull request is merged and the completion evidence is recorded.

From the `csc-workspace` repository, the agent helper supports the standard
workflow:

```bash
node scripts/manage-agent.mjs claim CSC-123
node scripts/manage-agent.mjs progress CSC-123 --branch codex/csc-123-description
node scripts/manage-agent.mjs review CSC-123 --pr https://github.com/owner/repo/pull/123
node scripts/manage-agent.mjs closeout CSC-123 --repo owner/repo --pr 123
```

A packet should include:

- goal and user or research value;
- affected surface, such as app, API, deploy, data ingest, warehouse, or docs;
- acceptance criteria and verification commands;
- rollout or rollback notes when production, BigQuery, GCS, or public data
  release behavior is involved.

Data-ingestion packets must also name:

- public source or mirror;
- destination bucket or table;
- provenance fields retained;
- rerun scope for downstream SQL or search indexes;
- whether mock mode or warehouse mode is affected.

## Branches, Commits, And Pull Requests

Branch names should include the CSC packet key:

```text
codex/csc-123-jfk-search-filters
```

Commits and pull request descriptions should reference the packet key and
include:

- implementation summary;
- commands run;
- deploy or build status;
- data loaded, if any;
- source-provenance or warehouse caveats.

Move the packet to `needs_review` after code is pushed, the pull request is
ready, and validation evidence is known. Close it only after merge
verification.

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

After a GitHub deploy, record the result on the Manage packet. If a deploy
fails, keep the packet in `in_progress` or `needs_review` and include the
failing workflow and job detail.

## Warehouse Safety

Production warehouse work should stay packet-tracked and explicit.

Before enabling or changing warehouse-backed behavior, confirm:

- source manifests and OCR inputs are loaded into the intended JFK datasets;
- curated tables exist and have smoke-test counts;
- search indexes or MVP tables have been rebuilt when relevant;
- `JFK_DATA_SOURCE`, `JFK_BQ_PROJECT`, and deploy environment variables are set
  intentionally for this repo only.
