import budgetConfigSource from "@/config/cost-budgets.json";
import costEventSource from "@/data/cost-console/cost-events.json";

export type CostConsoleSource =
  | "empty"
  | "manual_seed"
  | "ledger"
  | "reconciliation";

export type CostConsoleSourceStatus =
  | "empty"
  | "known_direct_costs"
  | "estimated_only"
  | "reconciled"
  | "error";

export type CostConsoleEvent = {
  id: string;
  eventDate: string;
  feature: string;
  service: string;
  operation: string;
  workflow: string;
  workflowRunId: string;
  linearIssue: string;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  rowCount: number;
  byteCount: number;
  billingRows: number;
  note: string;
};

export type CostWindow = {
  estimatedCost: number;
  actualCost: number;
  delta: number;
  unattributedActual: number;
};

export type CostConsoleRow = {
  date?: string;
  feature?: string;
  service?: string;
  workflow?: string;
  workflowRunId?: string;
  linearIssue?: string;
  operation?: string;
  estimatedCost: number;
  actualCost: number;
  delta: number;
  unattributedActual: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  rowCount: number;
  byteCount: number;
  billingRows: number;
  notes: string[];
};

export type CostBudgetDefinition = {
  key: string;
  label: string;
  type: string;
  budgetUsd: number;
  match: {
    features?: string[];
    services?: string[];
    linearIssues?: string[];
  };
};

export type CostBudgetRow = {
  key: string;
  label: string;
  type: string;
  budgetUsd: number;
  estimatedCost: number;
  actualCost: number;
  spendToDate: number;
  budgetUsedPct: number;
  remainingBudget: number;
  status: "ok" | "warning" | "critical";
  matchedRows: number;
};

export type CostAlert = {
  severity: "ok" | "warning" | "critical";
  type: "budget" | "variance" | "unattributed";
  title: string;
  detail: string;
  key?: string;
};

export type CostConsolePayload = {
  generatedAt: string;
  source: CostConsoleSource;
  sourceStatus: CostConsoleSourceStatus;
  notes: string[];
  windows: {
    last7: CostWindow;
    last30: CostWindow;
  };
  daily: CostConsoleRow[];
  byFeature: CostConsoleRow[];
  byService: CostConsoleRow[];
  byWorkflow: CostConsoleRow[];
  byLinearIssue: CostConsoleRow[];
  unattributed: CostConsoleRow[];
  workflowRuns: CostConsoleRow[];
  budgets: CostBudgetRow[];
  alerts: CostAlert[];
};

type CostEventSource = {
  source?: unknown;
  sourceStatus?: unknown;
  notes?: unknown;
  events?: unknown;
};

type BudgetConfigSource = {
  thresholds?: unknown;
  budgets?: unknown;
};

type BudgetThresholds = {
  warningPct: number;
  criticalPct: number;
};

const emptyWindow: CostWindow = {
  estimatedCost: 0,
  actualCost: 0,
  delta: 0,
  unattributedActual: 0,
};

const sourceLabels: Record<CostConsoleSource, string> = {
  empty: "No ledger",
  manual_seed: "Manual seed",
  ledger: "Ledger estimates",
  reconciliation: "Billing reconciliation",
};

const statusLabels: Record<CostConsoleSourceStatus, string> = {
  empty: "Waiting for data",
  known_direct_costs: "Known direct costs",
  estimated_only: "Estimated only",
  reconciled: "Actuals reconciled",
  error: "Export error",
};

export function getCostConsoleData(generatedAt = new Date()): CostConsolePayload {
  return buildCostConsoleData(
    costEventSource as CostEventSource,
    budgetConfigSource as BudgetConfigSource,
    generatedAt,
  );
}

/**
 * Builds the Cost Console payload from raw event and budget sources.
 *
 * @param source Raw cost event source, usually data/cost-console/cost-events.json.
 * @param budgetConfig Raw budget config, usually config/cost-budgets.json.
 * @param generatedAt Timestamp used for the payload generation marker.
 * @returns Aggregated console payload with window, attribution, budget, and alert views.
 */
export function buildCostConsoleData(
  source: CostEventSource,
  budgetConfig: BudgetConfigSource,
  generatedAt = new Date(),
): CostConsolePayload {
  const events = normalizeEvents(source.events);
  const sourceKind = normalizeSource(source.source, events);
  const sourceStatus = normalizeSourceStatus(source.sourceStatus, sourceKind, events);
  const notes = normalizeStringArray(source.notes);

  if (events.length === 0) {
    return {
      generatedAt: generatedAt.toISOString(),
      source: "empty",
      sourceStatus: "empty",
      notes: notes.length ? notes : ["Cost Console data has not been exported yet."],
      windows: { last7: emptyWindow, last30: emptyWindow },
      daily: [],
      byFeature: [],
      byService: [],
      byWorkflow: [],
      byLinearIssue: [],
      unattributed: [],
      workflowRuns: [],
      budgets: [],
      alerts: [],
    };
  }

  const daily = groupCostRows(events, ["date"]).sort(compareRowsByDate);
  const byFeature = groupCostRows(events, ["feature", "linearIssue"])
    .sort(compareRowsBySpend)
    .slice(0, 80);
  const byService = groupCostRows(events, ["service"])
    .sort(compareRowsBySpend)
    .slice(0, 60);
  const byWorkflow = groupCostRows(events, ["workflow", "workflowRunId"])
    .sort(compareRowsBySpend)
    .slice(0, 60);
  const byLinearIssue = groupCostRows(events, ["linearIssue"])
    .sort(compareRowsBySpend)
    .slice(0, 60);
  const unattributed = byLinearIssue.filter(
    (row) => !row.linearIssue || row.linearIssue === "Unattributed",
  );
  const workflowRuns = groupCostRows(events, [
    "workflow",
    "workflowRunId",
    "feature",
    "linearIssue",
    "service",
    "operation",
  ]).filter((row) => Boolean(row.workflowRunId));
  const windows = summarizeWindows(daily, generatedAt);
  const byFeatureLast30 = groupCostRows(
    events.filter((event) => isDateInWindow(event.eventDate, 30, generatedAt)),
    ["feature", "linearIssue"],
  ).sort(compareRowsBySpend);
  const thresholds = normalizeThresholds(budgetConfig.thresholds);
  const budgets = buildBudgetRows(
    normalizeBudgets(budgetConfig.budgets),
    events,
    thresholds,
    sourceKind === "reconciliation",
  );
  const alerts = buildAlerts(budgets, byFeatureLast30, windows.last30, sourceKind);

  return {
    generatedAt: generatedAt.toISOString(),
    source: sourceKind,
    sourceStatus,
    notes,
    windows,
    daily,
    byFeature,
    byService,
    byWorkflow,
    byLinearIssue,
    unattributed,
    workflowRuns,
    budgets,
    alerts,
  };
}

export function groupWorkflowRuns(rows: readonly CostConsoleRow[]): CostConsoleRow[] {
  const groups = new Map<string, CostConsoleRow & { rows: CostConsoleRow[] }>();

  for (const row of rows) {
    const id = normalizeString(row.workflowRunId);
    if (!id) continue;
    if (!groups.has(id)) {
      groups.set(id, {
        workflow: row.workflow || "Unattributed",
        workflowRunId: id,
        feature: "",
        linearIssue: "",
        operation: "",
        estimatedCost: 0,
        actualCost: 0,
        delta: 0,
        unattributedActual: 0,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        rowCount: 0,
        byteCount: 0,
        billingRows: 0,
        notes: [],
        rows: [],
      });
    }

    const group = groups.get(id)!;
    addCostRow(group, row);
    group.rows.push(row);
    group.feature = ownerLabel([
      ...new Set(group.rows.map((item) => item.feature).filter(isNonEmptyString)),
    ]);
    group.linearIssue = ownerLabel([
      ...new Set(group.rows.map((item) => item.linearIssue).filter(isNonEmptyString)),
    ]);
    group.operation = ownerLabel([
      ...new Set(group.rows.map((item) => item.operation).filter(isNonEmptyString)),
    ]);
  }

  return [...groups.values()]
    .map(({ rows: _rows, ...row }) => ({
      ...row,
      estimatedCost: roundMoney(row.estimatedCost),
      actualCost: roundMoney(row.actualCost),
      delta: roundMoney(row.delta),
      unattributedActual: roundMoney(row.unattributedActual),
    }))
    .sort(compareRowsBySpend);
}

export function costSourceLabel(
  source: CostConsoleSource | string | null | undefined,
): string {
  return sourceLabels[source as CostConsoleSource] ?? sourceLabels.empty;
}

export function costStatusLabel(
  status: CostConsoleSourceStatus | string | null | undefined,
): string {
  return statusLabels[status as CostConsoleSourceStatus] ?? statusLabels.empty;
}

export function formatUsd(value: number): string {
  const numeric = Number.isFinite(value) ? value : 0;
  const sign = numeric < 0 ? "-" : "";
  const abs = Math.abs(numeric);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function signedUsd(value: number): string {
  const numeric = Number.isFinite(value) ? value : 0;
  if (Math.abs(numeric) < 0.005) return "$0.00";
  return `${numeric > 0 ? "+" : ""}${formatUsd(numeric)}`;
}

export function formatCount(value: number): string {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.round(numeric).toLocaleString("en-US");
}

export function titleCaseKey(value: string): string {
  const normalized = normalizeString(value) || "Unattributed";
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEvents(value: unknown): CostConsoleEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeEvent)
    .filter((event): event is CostConsoleEvent => event != null)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
}

function normalizeEvent(value: unknown): CostConsoleEvent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const id = normalizeString(input.id);
  const eventDate = normalizeDateString(input.eventDate);
  const feature = normalizeString(input.feature);
  const service = normalizeString(input.service);
  if (!id || !eventDate || !feature || !service) return null;

  return {
    id,
    eventDate,
    feature,
    service,
    operation: normalizeString(input.operation) || "unspecified",
    workflow: normalizeString(input.workflow) || "Manual",
    workflowRunId: normalizeString(input.workflowRunId),
    linearIssue: normalizeString(input.linearIssue),
    estimatedCostUsd: roundMoney(toNumber(input.estimatedCostUsd)),
    actualCostUsd:
      input.actualCostUsd === null || input.actualCostUsd === undefined
        ? null
        : roundMoney(toNumber(input.actualCostUsd)),
    requestCount: toInt(input.requestCount),
    inputTokens: toInt(input.inputTokens),
    outputTokens: toInt(input.outputTokens),
    rowCount: toInt(input.rowCount),
    byteCount: toInt(input.byteCount),
    billingRows: toInt(input.billingRows),
    note: normalizeString(input.note),
  };
}

function groupCostRows(
  events: readonly CostConsoleEvent[],
  keys: Array<
    "date" | "feature" | "service" | "workflow" | "workflowRunId" | "linearIssue" | "operation"
  >,
): CostConsoleRow[] {
  const rows = new Map<string, CostConsoleRow>();
  for (const event of events) {
    const keyParts = keys.map((key) => rowKeyValue(event, key));
    const groupKey = keyParts.join("\u0000");
    if (!rows.has(groupKey)) {
      rows.set(groupKey, {
        date: keys.includes("date") ? event.eventDate : undefined,
        feature: keys.includes("feature") ? event.feature : undefined,
        service: keys.includes("service") ? event.service : undefined,
        workflow: keys.includes("workflow") ? event.workflow : undefined,
        workflowRunId: keys.includes("workflowRunId") ? event.workflowRunId : undefined,
        linearIssue: keys.includes("linearIssue")
          ? event.linearIssue || "Unattributed"
          : undefined,
        operation: keys.includes("operation") ? event.operation : undefined,
        estimatedCost: 0,
        actualCost: 0,
        delta: 0,
        unattributedActual: 0,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        rowCount: 0,
        byteCount: 0,
        billingRows: 0,
        notes: [],
      });
    }
    const row = rows.get(groupKey)!;
    addEventToRow(row, event);
  }
  return [...rows.values()].map((row) => ({
    ...row,
    estimatedCost: roundMoney(row.estimatedCost),
    actualCost: roundMoney(row.actualCost),
    delta: roundMoney(row.delta),
    unattributedActual: roundMoney(row.unattributedActual),
  }));
}

function addEventToRow(row: CostConsoleRow, event: CostConsoleEvent): void {
  const actualCost = event.actualCostUsd ?? 0;
  row.estimatedCost += event.estimatedCostUsd;
  row.actualCost += actualCost;
  row.delta += actualCost - event.estimatedCostUsd;
  if (!event.linearIssue) row.unattributedActual += actualCost;
  row.requests += event.requestCount;
  row.inputTokens += event.inputTokens;
  row.outputTokens += event.outputTokens;
  row.rowCount += event.rowCount;
  row.byteCount += event.byteCount;
  row.billingRows += event.billingRows;
  if (event.note) row.notes.push(event.note);
}

function addCostRow(target: CostConsoleRow, row: CostConsoleRow): void {
  target.estimatedCost += row.estimatedCost;
  target.actualCost += row.actualCost;
  target.delta += row.delta;
  target.unattributedActual += row.unattributedActual;
  target.requests += row.requests;
  target.inputTokens += row.inputTokens;
  target.outputTokens += row.outputTokens;
  target.rowCount += row.rowCount;
  target.byteCount += row.byteCount;
  target.billingRows += row.billingRows;
  target.notes.push(...row.notes);
}

function rowKeyValue(event: CostConsoleEvent, key: string): string {
  if (key === "date") return event.eventDate;
  if (key === "linearIssue") return event.linearIssue || "Unattributed";
  const value = event[key as keyof CostConsoleEvent];
  return typeof value === "string" ? value : "";
}

function summarizeWindows(daily: readonly CostConsoleRow[], generatedAt: Date) {
  const sorted = [...daily].sort(compareRowsByDate);
  const window = (days: number): CostWindow => {
    const rows = sorted.filter((row) => isDateInWindow(row.date, days, generatedAt));
    return {
      estimatedCost: roundMoney(sum(rows, "estimatedCost")),
      actualCost: roundMoney(sum(rows, "actualCost")),
      delta: roundMoney(sum(rows, "delta")),
      unattributedActual: roundMoney(sum(rows, "unattributedActual")),
    };
  };
  return {
    last7: window(7),
    last30: window(30),
  };
}

function buildBudgetRows(
  budgets: readonly CostBudgetDefinition[],
  events: readonly CostConsoleEvent[],
  thresholds: BudgetThresholds,
  actualMode: boolean,
): CostBudgetRow[] {
  return budgets
    .filter((budget) => budget.budgetUsd > 0)
    .map((budget) => {
      const matchedEvents = events.filter((event) =>
        budgetMatchesEvent(budget, event),
      );
      const estimatedCost = roundMoney(
        matchedEvents.reduce((total, event) => total + event.estimatedCostUsd, 0),
      );
      const actualCost = roundMoney(
        matchedEvents.reduce(
          (total, event) => total + (event.actualCostUsd ?? 0),
          0,
        ),
      );
      const spendToDate = actualMode ? actualCost : estimatedCost;
      const budgetUsedPct = budget.budgetUsd
        ? roundOne((spendToDate / budget.budgetUsd) * 100)
        : 0;
      return {
        key: budget.key,
        label: budget.label,
        type: budget.type,
        budgetUsd: budget.budgetUsd,
        estimatedCost,
        actualCost,
        spendToDate,
        budgetUsedPct,
        remainingBudget: roundMoney(budget.budgetUsd - spendToDate),
        status: budgetStatus(budgetUsedPct, thresholds),
        matchedRows: matchedEvents.length,
      };
    })
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || b.budgetUsedPct - a.budgetUsedPct);
}

function buildAlerts(
  budgets: readonly CostBudgetRow[],
  featureRows: readonly CostConsoleRow[],
  last30: CostWindow,
  source: CostConsoleSource,
): CostAlert[] {
  const alerts: CostAlert[] = [];
  for (const budget of budgets) {
    if (budget.status === "ok") continue;
    alerts.push({
      severity: budget.status,
      type: "budget",
      title: `${budget.label} is ${budget.budgetUsedPct.toFixed(1)}% of budget`,
      detail: `${formatUsd(budget.spendToDate)} spent against ${formatUsd(budget.budgetUsd)}.`,
      key: budget.key,
    });
  }

  if (source === "reconciliation") {
    for (const row of featureRows) {
      const delta30Day = row.delta;
      if (
        row.estimatedCost > 0 &&
        delta30Day > Math.max(1, row.estimatedCost * 0.25)
      ) {
        alerts.push({
          severity: "warning",
          type: "variance",
          title: `${titleCaseKey(row.feature ?? row.linearIssue ?? "cost item")} actuals are above estimate`,
          detail: `Actual spend is ${formatUsd(delta30Day)} above the 30-day ledger estimate.`,
          key: row.feature ?? row.linearIssue,
        });
      }
    }

    if (last30.unattributedActual > 0) {
      alerts.push({
        severity: "warning",
        type: "unattributed",
        title: "Unattributed actual spend needs instrumentation",
        detail: `${formatUsd(last30.unattributedActual)} of 30-day actual spend has no ledger owner.`,
      });
    }
  }

  return alerts.slice(0, 12);
}

function normalizeBudgets(value: unknown): CostBudgetDefinition[] {
  if (!Array.isArray(value)) return [];
  const budgets: CostBudgetDefinition[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const input = raw as Record<string, unknown>;
    const key = normalizeString(input.key);
    const budgetUsd = toNumber(input.budgetUsd);
    if (!key || budgetUsd <= 0) continue;
    const match = input.match && typeof input.match === "object"
      ? (input.match as Record<string, unknown>)
      : {};
    budgets.push({
      key,
      label: normalizeString(input.label) || key,
      type: normalizeString(input.type) || "project",
      budgetUsd,
      match: {
        features: normalizeStringArray(match.features),
        services: normalizeStringArray(match.services),
        linearIssues: normalizeStringArray(match.linearIssues),
      },
    });
  }
  return budgets;
}

function normalizeThresholds(value: unknown): BudgetThresholds {
  const input = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
  const warningPct = toNumber(input.warningPct) || 80;
  const criticalPct = toNumber(input.criticalPct) || 100;
  return { warningPct, criticalPct };
}

function budgetMatchesEvent(
  budget: CostBudgetDefinition,
  event: CostConsoleEvent,
): boolean {
  const features = budget.match.features ?? [];
  const services = budget.match.services ?? [];
  const linearIssues = budget.match.linearIssues ?? [];
  const hasMatcher =
    features.length > 0 || services.length > 0 || linearIssues.length > 0;

  if (!hasMatcher) return false;
  if (features.length > 0 && !features.includes(event.feature)) return false;
  if (services.length > 0 && !services.includes(event.service)) return false;
  if (linearIssues.length > 0 && !linearIssues.includes(event.linearIssue)) {
    return false;
  }
  return true;
}

function budgetStatus(
  pct: number,
  thresholds: BudgetThresholds,
): CostBudgetRow["status"] {
  if (pct >= thresholds.criticalPct) return "critical";
  if (pct >= thresholds.warningPct) return "warning";
  return "ok";
}

function statusRank(status: CostBudgetRow["status"]): number {
  return { ok: 1, warning: 2, critical: 3 }[status];
}

function normalizeSource(value: unknown, events: readonly CostConsoleEvent[]): CostConsoleSource {
  const raw = normalizeString(value);
  if (raw === "manual_seed" || raw === "ledger" || raw === "reconciliation") return raw;
  return events.length ? "manual_seed" : "empty";
}

function normalizeSourceStatus(
  value: unknown,
  source: CostConsoleSource,
  events: readonly CostConsoleEvent[],
): CostConsoleSourceStatus {
  const raw = normalizeString(value);
  if (
    raw === "known_direct_costs" ||
    raw === "estimated_only" ||
    raw === "reconciled" ||
    raw === "error"
  ) {
    return raw;
  }
  if (!events.length) return "empty";
  if (source === "reconciliation") return "reconciled";
  if (source === "ledger") return "estimated_only";
  return "known_direct_costs";
}

function normalizeDateString(value: unknown): string {
  const raw = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  return Number.isNaN(new Date(`${raw}T00:00:00Z`).valueOf()) ? "" : raw;
}

function isDateInWindow(
  date: string | undefined,
  days: number,
  generatedAt: Date,
): boolean {
  const time = isoDateToUtcDay(date);
  if (time == null) return false;
  const end = utcDay(generatedAt);
  const start = end - (Math.max(1, days) - 1) * 24 * 60 * 60 * 1000;
  return time >= start && time <= end;
}

function isoDateToUtcDay(date: string | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDay(date: Date): number {
  if (!Number.isFinite(date.valueOf())) {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function compareRowsByDate(a: CostConsoleRow, b: CostConsoleRow): number {
  return (a.date ?? "").localeCompare(b.date ?? "");
}

function compareRowsBySpend(a: CostConsoleRow, b: CostConsoleRow): number {
  return (
    Math.max(b.actualCost, b.estimatedCost) -
      Math.max(a.actualCost, a.estimatedCost) ||
    (a.feature ?? a.service ?? a.workflow ?? a.linearIssue ?? "").localeCompare(
      b.feature ?? b.service ?? b.workflow ?? b.linearIssue ?? "",
    )
  );
}

function ownerLabel(values: string[]): string {
  if (values.length === 0) return "Unattributed";
  if (values.length > 1) return "Multiple";
  return values[0] ?? "Unattributed";
}

function sum(rows: readonly CostConsoleRow[], key: keyof CostConsoleRow): number {
  return rows.reduce((total, row) => {
    const value = row[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(normalizeString).filter(Boolean)));
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
