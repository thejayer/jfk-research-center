import { describe, expect, it } from "vitest";
import {
  buildCostConsoleData,
  groupWorkflowRuns,
  titleCaseKey,
  type CostConsoleRow,
} from "../cost-console";

const generatedAt = new Date("2026-05-27T12:00:00.000Z");

describe("cost console", () => {
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
});
