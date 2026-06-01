import { describe, expect, it } from "vitest";
import {
  buildCostConsoleData,
  costSourceLabel,
  costStatusLabel,
  formatCount,
  formatUsd,
  getCostConsoleData,
  groupWorkflowRuns,
  signedUsd,
  titleCaseKey,
  type CostConsoleRow,
} from "../cost-console";

const generatedAt = new Date("2026-05-27T12:00:00.000Z");

function costEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "event",
    eventDate: "2026-05-27",
    feature: "cost_console",
    service: "bigquery",
    operation: "export",
    workflow: "Refresh Cost Console",
    workflowRunId: "123",
    linearIssue: "COM-212",
    estimatedCostUsd: 1,
    actualCostUsd: 1,
    requestCount: 1,
    inputTokens: 0,
    outputTokens: 0,
    rowCount: 0,
    byteCount: 0,
    billingRows: 0,
    note: "",
    ...overrides,
  };
}

describe("cost console", () => {
  it("loads the bundled cost console payload", () => {
    const data = getCostConsoleData(generatedAt);

    expect(data.generatedAt).toBe("2026-05-27T12:00:00.000Z");
    expect(data.windows).toHaveProperty("last7");
    expect(data.windows).toHaveProperty("last30");
    expect(Array.isArray(data.byFeature)).toBe(true);
  });

  it("builds seeded manual cost windows and attribution rows", () => {
    const data = buildCostConsoleData(
      {
        source: "manual_seed",
        sourceStatus: "known_direct_costs",
        notes: ["seeded"],
        events: [
          {
            id: "media",
            eventDate: "2026-05-26",
            feature: "rights_aware_media",
            service: "jfk_library",
            operation: "metadata_seed",
            workflow: "Manual media seed curation",
            linearIssue: "",
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            requestCount: 0,
            rowCount: 18,
            note: "No binaries cached.",
          },
        ],
      },
      { budgets: [] },
      generatedAt,
    );

    expect(data.generatedAt).toBe("2026-05-27T12:00:00.000Z");
    expect(data.source).toBe("manual_seed");
    expect(data.windows.last30).toMatchObject({
      estimatedCost: 0,
      actualCost: 0,
      delta: 0,
    });
    expect(data.byFeature).toEqual([
      expect.objectContaining({
        feature: "rights_aware_media",
        linearIssue: "Unattributed",
        rowCount: 18,
        estimatedCost: 0,
        actualCost: 0,
      }),
    ]);
    expect(data.unattributed).toHaveLength(1);
  });

  it("normalizes Cloud Billing export rows into actual-cost reconciliation events", () => {
    const data = buildCostConsoleData(
      {
        billingRows: [
          {
            usage_start_time: "2026-05-26T03:04:05.000Z",
            service: { description: "BigQuery" },
            sku: { description: "Analysis" },
            project: {
              id: "jfk-vault",
              labels: [{ key: "feature", value: "document_search" }],
            },
            labels: [
              { key: "linear_issue", value: "COM-212" },
              { key: "github_workflow", value: "Refresh Cost Console" },
              { key: "github_run_id", value: "987654321" },
            ],
            invoice: { month: "202606" },
            cost_type: "regular",
            cost: 10,
            credits: [{ amount: -2.5 }],
          },
        ],
      },
      {
        thresholds: { warningPct: 80, criticalPct: 100 },
        budgets: [
          {
            key: "warehouse",
            label: "Warehouse",
            type: "platform",
            budgetUsd: 20,
            match: { features: ["document_search"], services: ["bigquery"] },
          },
        ],
      },
      generatedAt,
    );

    expect(data.source).toBe("reconciliation");
    expect(data.sourceStatus).toBe("reconciled");
    expect(data.notes).toContain(
      "Cloud Billing export rows are included in actual cost reconciliation.",
    );
    expect(data.byFeature).toEqual([
      expect.objectContaining({
        feature: "document_search",
        linearIssue: "COM-212",
        actualCost: 7.5,
        delta: 7.5,
        billingRows: 1,
      }),
    ]);
    expect(data.byService).toEqual([
      expect.objectContaining({
        service: "bigquery",
        actualCost: 7.5,
      }),
    ]);
    expect(data.workflowRuns).toEqual([
      expect.objectContaining({
        workflow: "Refresh Cost Console",
        workflowRunId: "987654321",
        operation: "analysis",
        actualCost: 7.5,
        notes: ["Project jfk-vault; Invoice 202606; Cost type regular"],
      }),
    ]);
    expect(data.budgets).toEqual([
      expect.objectContaining({
        key: "warehouse",
        actualCost: 7.5,
        spendToDate: 7.5,
        matchedRows: 1,
        status: "ok",
      }),
    ]);
  });

  it("normalizes ledger, billing export, and budget keys consistently", () => {
    const data = buildCostConsoleData(
      {
        source: "reconciliation",
        events: [
          costEvent({
            id: "ledger",
            feature: "Document Search",
            service: "BigQuery",
            operation: "Analysis Bytes",
            estimatedCostUsd: 2,
            actualCostUsd: 3,
          }),
        ],
        billingRows: [
          {
            eventDate: "2026-05-27",
            feature: "document_search",
            serviceDescription: "BigQuery",
            skuDescription: "Analysis Bytes",
            linearIssue: "COM-212",
            actualCostUsd: 4,
          },
        ],
      },
      {
        thresholds: { warningPct: 80, criticalPct: 100 },
        budgets: [
          {
            key: "search",
            label: "Search",
            type: "feature",
            budgetUsd: 10,
            match: { features: ["Document Search"], services: ["BigQuery"] },
          },
        ],
      },
      generatedAt,
    );

    expect(data.byFeature).toEqual([
      expect.objectContaining({
        feature: "document_search",
        actualCost: 7,
        estimatedCost: 2,
        billingRows: 1,
      }),
    ]);
    expect(data.workflowRuns).toEqual([
      expect.objectContaining({
        service: "bigquery",
        operation: "analysis_bytes",
        actualCost: 3,
      }),
    ]);
    expect(data.budgets).toEqual([
      expect.objectContaining({
        key: "search",
        actualCost: 7,
        matchedRows: 2,
      }),
    ]);
  });

  it("creates budget rows and alerts from configured thresholds", () => {
    const data = buildCostConsoleData(
      {
        source: "ledger",
        sourceStatus: "estimated_only",
        events: [
          {
            id: "run-1",
            eventDate: "2026-05-25",
            feature: "semantic_search",
            service: "vertex_ai",
            operation: "embedding_search",
            workflow: "Refresh semantic search",
            workflowRunId: "123",
            linearIssue: "COM-200",
            estimatedCostUsd: 9,
            requestCount: 3,
            inputTokens: 300,
            outputTokens: 90,
          },
        ],
      },
      {
        thresholds: { warningPct: 80, criticalPct: 100 },
        budgets: [
          {
            key: "semantic",
            label: "Semantic Search",
            type: "feature",
            budgetUsd: 10,
            match: { features: ["semantic_search"] },
          },
        ],
      },
      generatedAt,
    );

    expect(data.budgets).toEqual([
      expect.objectContaining({
        key: "semantic",
        estimatedCost: 9,
        spendToDate: 9,
        budgetUsedPct: 90,
        status: "warning",
        matchedRows: 1,
      }),
    ]);
    expect(data.alerts).toEqual([
      expect.objectContaining({
        type: "budget",
        severity: "warning",
      }),
    ]);
  });

  it("requires all non-empty budget match dimensions", () => {
    const data = buildCostConsoleData(
      {
        source: "ledger",
        events: [
          costEvent({
            id: "feature-only",
            feature: "media",
            service: "gcs",
            estimatedCostUsd: 5,
            actualCostUsd: 5,
          }),
          costEvent({
            id: "service-only",
            feature: "search",
            service: "bigquery",
            estimatedCostUsd: 7,
            actualCostUsd: 7,
          }),
          costEvent({
            id: "full-match",
            feature: "media",
            service: "bigquery",
            estimatedCostUsd: 9,
            actualCostUsd: 9,
          }),
        ],
      },
      {
        thresholds: { warningPct: 80, criticalPct: 100 },
        budgets: [
          {
            key: "mixed",
            label: "Mixed ownership",
            type: "feature",
            budgetUsd: 10,
            match: { features: ["media"], services: ["bigquery"] },
          },
        ],
      },
      generatedAt,
    );

    expect(data.budgets).toEqual([
      expect.objectContaining({
        key: "mixed",
        estimatedCost: 9,
        actualCost: 9,
        budgetUsedPct: 90,
        status: "warning",
        matchedRows: 1,
      }),
    ]);
    expect(data.alerts).toEqual([
      expect.objectContaining({
        key: "mixed",
        severity: "warning",
      }),
    ]);
  });

  it("uses true calendar windows with inclusive start and end dates", () => {
    const data = buildCostConsoleData(
      {
        source: "reconciliation",
        events: [
          costEvent({
            id: "before-thirty",
            eventDate: "2026-04-27",
            estimatedCostUsd: 100,
            actualCostUsd: 100,
          }),
          costEvent({
            id: "start-thirty",
            eventDate: "2026-04-28",
            estimatedCostUsd: 30,
            actualCostUsd: 30,
          }),
          costEvent({
            id: "before-seven",
            eventDate: "2026-05-20",
            estimatedCostUsd: 4,
            actualCostUsd: 4,
          }),
          costEvent({
            id: "start-seven",
            eventDate: "2026-05-21",
            estimatedCostUsd: 7,
            actualCostUsd: 7,
          }),
          costEvent({
            id: "end-seven",
            eventDate: "2026-05-27",
            estimatedCostUsd: 3,
            actualCostUsd: 3,
          }),
          costEvent({
            id: "future",
            eventDate: "2026-05-28",
            estimatedCostUsd: 50,
            actualCostUsd: 50,
          }),
        ],
      },
      { budgets: [] },
      generatedAt,
    );

    expect(data.windows.last7.estimatedCost).toBe(10);
    expect(data.windows.last7.actualCost).toBe(10);
    expect(data.windows.last30.estimatedCost).toBe(44);
    expect(data.windows.last30.actualCost).toBe(44);
  });

  it("uses UTC date boundaries for 7-day windows across daylight changes", () => {
    const data = buildCostConsoleData(
      {
        source: "reconciliation",
        events: [
          costEvent({
            id: "before-window",
            eventDate: "2026-03-02",
            estimatedCostUsd: 20,
            actualCostUsd: 20,
          }),
          costEvent({
            id: "window-start",
            eventDate: "2026-03-03",
            estimatedCostUsd: 3,
            actualCostUsd: 3,
          }),
          costEvent({
            id: "window-end",
            eventDate: "2026-03-09",
            estimatedCostUsd: 9,
            actualCostUsd: 9,
          }),
        ],
      },
      { budgets: [] },
      new Date("2026-03-09T23:30:00.000Z"),
    );

    expect(data.windows.last7.estimatedCost).toBe(12);
    expect(data.windows.last7.actualCost).toBe(12);
  });

  it("uses 30-day deltas for reconciliation variance alerts", () => {
    const data = buildCostConsoleData(
      {
        source: "reconciliation",
        events: [
          costEvent({
            id: "old-variance",
            eventDate: "2026-04-20",
            feature: "ask",
            estimatedCostUsd: 1,
            actualCostUsd: 11,
          }),
          costEvent({
            id: "current-flat",
            eventDate: "2026-05-27",
            feature: "ask",
            estimatedCostUsd: 100,
            actualCostUsd: 100,
          }),
        ],
      },
      { budgets: [] },
      generatedAt,
    );

    expect(data.alerts.find((alert) => alert.type === "variance")).toBeUndefined();
  });

  it("groups workflow run fragments for drilldown", () => {
    const rows: CostConsoleRow[] = [
      {
        workflow: "Refresh Cost Console",
        workflowRunId: "456",
        feature: "cost_console",
        linearIssue: "COM-212",
        service: "bigquery",
        operation: "export",
        estimatedCost: 1.25,
        actualCost: 2,
        delta: 0.75,
        unattributedActual: 0,
        requests: 1,
        inputTokens: 0,
        outputTokens: 0,
        rowCount: 100,
        byteCount: 200,
        billingRows: 2,
        notes: [],
      },
      {
        workflow: "Refresh Cost Console",
        workflowRunId: "456",
        feature: "rights_aware_media",
        linearIssue: "COM-212",
        service: "jfk_library",
        operation: "metadata_seed",
        estimatedCost: 0.75,
        actualCost: 1,
        delta: 0.25,
        unattributedActual: 0,
        requests: 2,
        inputTokens: 0,
        outputTokens: 0,
        rowCount: 18,
        byteCount: 0,
        billingRows: 0,
        notes: [],
      },
    ];

    expect(groupWorkflowRuns(rows)).toEqual([
      expect.objectContaining({
        workflowRunId: "456",
        feature: "Multiple",
        linearIssue: "COM-212",
        operation: "Multiple",
        estimatedCost: 2,
        actualCost: 3,
        delta: 1,
        requests: 3,
        rowCount: 118,
        byteCount: 200,
        billingRows: 2,
      }),
    ]);
  });

  it("formats stable keys for dashboard labels", () => {
    expect(titleCaseKey("rights_aware_media")).toBe("Rights Aware Media");
    expect(titleCaseKey("")).toBe("Unattributed");
  });

  it("formats source and status labels with fallbacks", () => {
    expect(costSourceLabel("empty")).toBe("No ledger");
    expect(costSourceLabel("manual_seed")).toBe("Manual seed");
    expect(costSourceLabel("ledger")).toBe("Ledger estimates");
    expect(costSourceLabel("reconciliation")).toBe("Billing reconciliation");
    expect(costSourceLabel("")).toBe("No ledger");
    expect(costSourceLabel(undefined)).toBe("No ledger");

    expect(costStatusLabel("empty")).toBe("Waiting for data");
    expect(costStatusLabel("known_direct_costs")).toBe("Known direct costs");
    expect(costStatusLabel("estimated_only")).toBe("Estimated only");
    expect(costStatusLabel("reconciled")).toBe("Actuals reconciled");
    expect(costStatusLabel("error")).toBe("Export error");
    expect(costStatusLabel("unknown")).toBe("Waiting for data");
  });

  it("formats currency and count edge cases", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(12.345)).toBe("$12.35");
    expect(formatUsd(123.45)).toBe("$123");
    expect(formatUsd(1234.56)).toBe("$1.2K");
    expect(formatUsd(-1234.56)).toBe("-$1.2K");
    expect(formatUsd(Number.NaN)).toBe("$0.00");
    expect(formatUsd("not-a-number" as unknown as number)).toBe("$0.00");

    expect(signedUsd(0.001)).toBe("$0.00");
    expect(signedUsd(2.5)).toBe("+$2.50");
    expect(signedUsd(-2.5)).toBe("-$2.50");
    expect(signedUsd(Number.POSITIVE_INFINITY)).toBe("$0.00");

    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatCount(-3.2)).toBe("-3");
    expect(formatCount(Number.NaN)).toBe("0");
    expect(formatCount("not-a-number" as unknown as number)).toBe("0");
  });
});
