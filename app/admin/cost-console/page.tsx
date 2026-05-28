import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  costSourceLabel,
  costStatusLabel,
  formatCount,
  formatUsd,
  getCostConsoleData,
  signedUsd,
  titleCaseKey,
  type CostConsolePayload,
  type CostConsoleRow,
} from "@/lib/cost-console";

export const dynamic = "force-dynamic";

const VIEW_TABS = [
  { value: "feature", label: "Feature" },
  { value: "service", label: "Service" },
  { value: "workflow", label: "Workflow" },
  { value: "linear", label: "Linear" },
  { value: "unattributed", label: "Unattributed" },
] as const;

const WINDOW_TABS = [
  { value: "last7", label: "7D" },
  { value: "last30", label: "30D" },
] as const;

type ViewKey = (typeof VIEW_TABS)[number]["value"];
type WindowKey = (typeof WINDOW_TABS)[number]["value"];

export default async function CostConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const windowKey = parseWindow(sp.window);
  const data = getCostConsoleData();
  const activeWindow = data.windows[windowKey];
  const rows = rowsForView(data, view);
  const actualLabel = data.source === "reconciliation"
    ? "Actual"
    : data.source === "manual_seed"
      ? "Known direct"
      : "Actual";
  const generated = new Date(data.generatedAt);

  return (
    <main style={pageStyle}>
      <header style={heroStyle}>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Admin
          </p>
          <div style={titleRowStyle}>
            <h1 style={titleStyle}>Cost Console</h1>
            <span style={statusPillStyle}>
              {costStatusLabel(data.sourceStatus)}
            </span>
          </div>
          <p className="muted" style={ledeStyle}>
            {windowKey === "last7" ? "Seven-day" : "Thirty-day"} project spend
            view using {costSourceLabel(data.source).toLowerCase()} data.
          </p>
          <div style={metaRowStyle}>
            <span>
              Updated <strong>{generated.toLocaleString()}</strong>
            </span>
            <span>
              Source <strong>{costSourceLabel(data.source)}</strong>
            </span>
            <span>
              Rows <strong>{formatCount(rowCoverage(data))}</strong>
            </span>
          </div>
        </div>
        <div style={heroRailStyle}>
          <SegmentedLinks
            label="Cost window"
            items={WINDOW_TABS.map((item) => ({
              ...item,
              href: costConsoleHref(view, item.value),
              active: item.value === windowKey,
            }))}
          />
          <div style={signalStyle(data.alerts.length > 0 ? "warn" : "ok")}>
            <span>{data.alerts.length > 0 ? "Attention" : "Health"}</span>
            <strong>
              {data.alerts.length > 0
                ? `${formatCount(data.alerts.length)} alerts`
                : "In range"}
            </strong>
          </div>
        </div>
      </header>

      <AdminLinks />

      {data.notes.length > 0 && (
        <section aria-label="Cost notes" style={noteStyle}>
          {data.notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </section>
      )}

      <section aria-label="Cost summary" style={metricGridStyle}>
        <Metric label="Estimated" value={formatUsd(activeWindow.estimatedCost)} sub={windowCopy(windowKey)} />
        <Metric label={actualLabel} value={formatUsd(activeWindow.actualCost)} sub={actualSubcopy(data.source)} />
        <Metric label="Variance" value={signedUsd(activeWindow.delta)} sub={varianceCopy(data.source, activeWindow.delta)} tone={activeWindow.delta > 0.005 ? "warn" : ""} />
        <Metric label="Unattributed" value={formatUsd(activeWindow.unattributedActual)} sub={unattributedCopy(data.source)} tone={activeWindow.unattributedActual > 0 ? "warn" : ""} />
        <Metric label="Budget alerts" value={formatCount(data.alerts.length)} sub={budgetSummary(data)} tone={data.alerts.length > 0 ? "warn" : ""} />
      </section>

      {data.alerts.length > 0 ? (
        <section aria-label="Cost alerts" style={alertsStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
                Alerts
              </p>
              <h2 style={sectionTitleStyle}>Spend signals</h2>
            </div>
            <span className="muted" style={smallMetaStyle}>
              {formatCount(data.alerts.length)} active
            </span>
          </div>
          <div style={alertListStyle}>
            {data.alerts.map((alert) => (
              <article key={`${alert.type}-${alert.key ?? alert.title}`} style={alertStyle(alert.severity)}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Budgets
            </p>
            <h2 style={sectionTitleStyle}>Configured spend lanes</h2>
          </div>
          <span className="muted" style={smallMetaStyle}>
            {data.source === "reconciliation" ? "actual basis" : "estimate basis"}
          </span>
        </div>
        <div style={budgetGridStyle}>
          {data.budgets.map((budget) => (
            <article key={budget.key} style={budgetCardStyle}>
              <div style={budgetTopStyle}>
                <div>
                  <strong>{budget.label}</strong>
                  <span className="muted" style={smallMetaStyle}>
                    {budget.type} - {formatCount(budget.matchedRows)} matched rows
                  </span>
                </div>
                <b className="num">{budget.budgetUsedPct.toFixed(1)}%</b>
              </div>
              <div style={budgetMeterStyle} aria-hidden>
                <i
                  style={{
                    ...budgetMeterFillStyle,
                    width: `${Math.max(2, Math.min(100, budget.budgetUsedPct))}%`,
                    background: budget.status === "ok" ? "var(--accent)" : "#b45309",
                  }}
                />
              </div>
              <div style={budgetStatsStyle}>
                <MiniStat label="Spent" value={formatUsd(budget.spendToDate)} />
                <MiniStat label="Budget" value={formatUsd(budget.budgetUsd)} />
                <MiniStat label="Remaining" value={signedUsd(budget.remainingBudget)} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={gridStyle}>
        <div style={{ ...sectionStyle, gridColumn: "1 / -1" }}>
          <div style={sectionHeaderStyle}>
            <div>
              <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
                Daily
              </p>
              <h2 style={sectionTitleStyle}>Estimated vs actual spend</h2>
            </div>
            <span className="muted" style={smallMetaStyle}>
              {formatCount(data.daily.length)} days
            </span>
          </div>
          <DailyBars rows={data.daily.slice(-30)} showActual={data.source === "reconciliation"} />
        </div>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
                Attribution
              </p>
              <h2 style={sectionTitleStyle}>Current view</h2>
            </div>
          </div>
          <SegmentedLinks
            label="Attribution view"
            items={VIEW_TABS.map((item) => ({
              ...item,
              href: costConsoleHref(item.value, windowKey),
              active: item.value === view,
            }))}
          />
          <div style={summaryBoxStyle}>
            <MiniStat label="30D estimated" value={formatUsd(data.windows.last30.estimatedCost)} />
            <MiniStat label="30D actual" value={formatUsd(data.windows.last30.actualCost)} />
            <MiniStat label="30D variance" value={signedUsd(data.windows.last30.delta)} />
            <MiniStat label="Unattributed rows" value={formatCount(data.unattributed.length)} />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
              {VIEW_TABS.find((item) => item.value === view)?.label}
            </p>
            <h2 style={sectionTitleStyle}>{tableTitle(view)}</h2>
          </div>
          <span className="muted" style={smallMetaStyle}>
            {formatCount(rows.length)} rows
          </span>
        </div>
        <CostTable rows={rows} view={view} actualLabel={actualLabel} />
      </section>
    </main>
  );
}

function SegmentedLinks({
  label,
  items,
}: {
  label: string;
  items: Array<{ value: string; label: string; href: string; active: boolean }>;
}) {
  return (
    <nav aria-label={label} style={segmentStyle}>
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          style={segmentLinkStyle(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AdminLinks() {
  const links = [
    { href: "/admin", label: "Admin hub" },
    { href: "/admin/media", label: "Media review" },
    { href: "/admin/ocr-progress", label: "OCR progress" },
    { href: "/admin/corrections", label: "Corrections" },
  ];
  return (
    <nav aria-label="Admin tools" style={adminNavStyle}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} style={adminLinkStyle}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "warn" | "";
}) {
  return (
    <div style={metricStyle(tone)}>
      <div className="muted" style={metricLabelStyle}>
        {label}
      </div>
      <div className="num" style={metricValueStyle}>
        {value}
      </div>
      <div className="muted" style={metricSubStyle}>
        {sub}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="muted" style={miniLabelStyle}>
        {label}
      </span>
      <strong className="num" style={miniValueStyle}>
        {value}
      </strong>
    </div>
  );
}

function DailyBars({
  rows,
  showActual,
}: {
  rows: CostConsoleRow[];
  showActual: boolean;
}) {
  if (rows.length === 0) {
    return <p className="muted">No daily cost rows are available.</p>;
  }
  const max = Math.max(
    1,
    ...rows.map((row) => Math.max(row.estimatedCost, row.actualCost)),
  );
  return (
    <div style={barsStyle}>
      {rows.map((row) => {
        const estimatedPct = Math.max(2, (row.estimatedCost / max) * 100);
        const actualPct = Math.max(2, (row.actualCost / max) * 100);
        return (
          <div key={row.date} style={barRowStyle}>
            <span className="muted" style={{ fontSize: 12 }}>
              {shortDate(row.date)}
            </span>
            <div style={barTrackStyle}>
              <i style={{ ...barFillStyle, width: `${estimatedPct}%` }} />
              {showActual && (
                <i
                  style={{
                    ...barFillStyle,
                    width: `${actualPct}%`,
                    background: "var(--link)",
                    top: 9,
                  }}
                />
              )}
            </div>
            <strong className="num" style={{ fontSize: 12 }}>
              {showActual ? signedUsd(row.delta) : formatUsd(row.estimatedCost)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function CostTable({
  rows,
  view,
  actualLabel,
}: {
  rows: CostConsoleRow[];
  view: ViewKey;
  actualLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="muted">No rows available for this attribution view.</p>;
  }
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
            <Th>{labelForView(view)}</Th>
            <Th align="right">Estimated</Th>
            <Th align="right">{actualLabel}</Th>
            <Th align="right">Variance</Th>
            <Th align="right">Requests</Th>
            <Th align="right">Rows</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row, view)} style={{ borderTop: "1px solid var(--border)" }}>
              <Td>{primaryCell(row, view)}</Td>
              <Td align="right">
                <span className="num">{formatUsd(row.estimatedCost)}</span>
              </Td>
              <Td align="right">
                <span className="num">{formatUsd(row.actualCost)}</span>
              </Td>
              <Td align="right">
                <span className="num">{signedUsd(row.delta)}</span>
              </Td>
              <Td align="right">
                <span className="num">{formatCount(row.requests)}</span>
              </Td>
              <Td align="right">
                <span className="num">{formatCount(row.rowCount)}</span>
              </Td>
              <Td>
                <span className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {row.notes[0] ?? "No note"}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th style={{ ...thStyle, textAlign: align ?? "left" }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td style={{ ...tdStyle, textAlign: align ?? "left" }}>
      {children}
    </td>
  );
}

function primaryCell(row: CostConsoleRow, view: ViewKey) {
  if (view === "feature") {
    return (
      <div style={primaryCellStyle}>
        <strong>{titleCaseKey(row.feature ?? "Unattributed")}</strong>
        <span className="muted">{row.linearIssue ?? "Unattributed"}</span>
      </div>
    );
  }
  if (view === "service") {
    return (
      <div style={primaryCellStyle}>
        <strong>{titleCaseKey(row.service ?? "Unknown")}</strong>
        <span className="muted">{row.service ?? "unknown"}</span>
      </div>
    );
  }
  if (view === "workflow") {
    return (
      <div style={primaryCellStyle}>
        <strong>{row.workflow ?? "Unattributed"}</strong>
        <span className="muted">{row.workflowRunId || "No run id"}</span>
      </div>
    );
  }
  if (view === "linear" || view === "unattributed") {
    return (
      <div style={primaryCellStyle}>
        <strong>{row.linearIssue ?? "Unattributed"}</strong>
        <span className="muted">{row.feature ? titleCaseKey(row.feature) : "Cost owner"}</span>
      </div>
    );
  }
  return <strong>Cost row</strong>;
}

function parseView(value: string | string[] | undefined): ViewKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return VIEW_TABS.some((item) => item.value === raw) ? (raw as ViewKey) : "feature";
}

function parseWindow(value: string | string[] | undefined): WindowKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "last7" ? "last7" : "last30";
}

function rowsForView(data: CostConsolePayload, view: ViewKey): CostConsoleRow[] {
  if (view === "feature") return data.byFeature;
  if (view === "service") return data.byService;
  if (view === "workflow") return data.byWorkflow;
  if (view === "linear") return data.byLinearIssue;
  return data.unattributed;
}

function labelForView(view: ViewKey): string {
  if (view === "service") return "Service";
  if (view === "workflow") return "Workflow";
  if (view === "linear") return "Linear issue";
  if (view === "unattributed") return "Unattributed owner";
  return "Feature";
}

function tableTitle(view: ViewKey): string {
  if (view === "service") return "Cloud, model, and source services";
  if (view === "workflow") return "Workflow and run attribution";
  if (view === "linear") return "Spend mapped to Linear issues";
  if (view === "unattributed") return "Spend still missing an owner";
  return "Product surfaces costing money";
}

function costConsoleHref(view: ViewKey, windowKey: WindowKey): string {
  return `/admin/cost-console?view=${view}&window=${windowKey}`;
}

function rowCoverage(data: CostConsolePayload): number {
  return [
    data.daily,
    data.byFeature,
    data.byService,
    data.byWorkflow,
    data.byLinearIssue,
    data.workflowRuns,
  ].reduce((total, rows) => total + rows.length, 0);
}

function rowKey(row: CostConsoleRow, view: ViewKey): string {
  return [
    view,
    row.date,
    row.feature,
    row.service,
    row.workflow,
    row.workflowRunId,
    row.linearIssue,
  ].filter(Boolean).join(":");
}

function windowCopy(windowKey: WindowKey): string {
  return windowKey === "last7" ? "last 7 days" : "last 30 days";
}

function actualSubcopy(source: CostConsolePayload["source"]): string {
  if (source === "reconciliation") return "billing export";
  if (source === "manual_seed") return "known direct costs";
  return "pending reconciliation";
}

function varianceCopy(source: CostConsolePayload["source"], delta: number): string {
  if (source !== "reconciliation") return "not billing-reconciled";
  if (delta > 0.005) return "actual above estimate";
  if (delta < -0.005) return "actual below estimate";
  return "on estimate";
}

function unattributedCopy(source: CostConsolePayload["source"]): string {
  return source === "reconciliation" ? "actual spend without owner" : "needs billing export";
}

function budgetSummary(data: CostConsolePayload): string {
  const warning = data.budgets.filter((budget) => budget.status === "warning").length;
  const critical = data.budgets.filter((budget) => budget.status === "critical").length;
  if (critical) return `${formatCount(critical)} over budget`;
  if (warning) return `${formatCount(warning)} near budget`;
  return "budgets in range";
}

function shortDate(date: string | undefined): string {
  if (!date) return "Unknown";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const pageStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "40px auto 96px",
  padding: "0 20px",
};

const heroStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 24,
  alignItems: "start",
  marginBottom: 18,
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 4,
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 650,
  letterSpacing: 0,
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "3px 9px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: 12,
  fontWeight: 650,
};

const ledeStyle: CSSProperties = {
  maxWidth: "74ch",
  lineHeight: 1.55,
  marginTop: 8,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 14px",
  marginTop: 14,
  color: "var(--text-muted)",
  fontSize: 13,
};

const heroRailStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "start",
};

const signalStyle = (tone: "ok" | "warn"): CSSProperties => ({
  minWidth: 172,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background:
    tone === "warn"
      ? "color-mix(in srgb, #d97706 12%, var(--surface))"
      : "var(--surface)",
  padding: "10px 12px",
  display: "grid",
  gap: 2,
  fontSize: 12,
  color: "var(--text-muted)",
});

const adminNavStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  margin: "0 0 20px",
};

const adminLinkStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-muted)",
  background: "var(--surface)",
  fontSize: 13,
  fontWeight: 650,
  textDecoration: "none",
};

const noteStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 18,
  padding: "12px 14px",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-muted)",
  background: "color-mix(in srgb, var(--surface) 72%, transparent)",
  fontSize: 13,
  lineHeight: 1.45,
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
  marginBottom: 24,
};

const metricStyle = (tone: "warn" | ""): CSSProperties => ({
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background:
    tone === "warn"
      ? "color-mix(in srgb, #d97706 10%, var(--surface))"
      : "var(--surface)",
  padding: 16,
});

const metricLabelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const metricValueStyle: CSSProperties = {
  marginTop: 5,
  fontSize: 26,
  fontWeight: 650,
  color: "var(--text)",
};

const metricSubStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 12,
};

const alertsStyle: CSSProperties = {
  marginBottom: 24,
};

const alertListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const alertStyle = (severity: string): CSSProperties => ({
  display: "grid",
  gap: 3,
  border: "1px solid var(--border)",
  borderLeft: `4px solid ${severity === "critical" ? "#b91c1c" : "#b45309"}`,
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  padding: "10px 12px",
  fontSize: 13,
});

const sectionStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 18,
  marginBottom: 24,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 14,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  letterSpacing: 0,
};

const smallMetaStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  lineHeight: 1.35,
};

const budgetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const budgetCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
  padding: 14,
};

const budgetTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
};

const budgetMeterStyle: CSSProperties = {
  position: "relative",
  height: 8,
  marginTop: 12,
  overflow: "hidden",
  borderRadius: 999,
  background: "var(--border)",
};

const budgetMeterFillStyle: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: 999,
};

const budgetStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 18,
  alignItems: "start",
};

const segmentStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  gap: 4,
  padding: 4,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
};

const segmentLinkStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "4px 10px",
  borderRadius: 4,
  color: active ? "var(--bg)" : "var(--text-muted)",
  background: active ? "var(--text)" : "transparent",
  fontSize: 13,
  fontWeight: 650,
  textDecoration: "none",
});

const summaryBoxStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};

const miniLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const miniValueStyle: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 15,
};

const barsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const barRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr) 72px",
  gap: 10,
  alignItems: "center",
};

const barTrackStyle: CSSProperties = {
  position: "relative",
  height: 18,
  borderRadius: 999,
  background: "var(--bg)",
  overflow: "hidden",
  border: "1px solid var(--border)",
};

const barFillStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 3,
  height: 5,
  borderRadius: 999,
  background: "var(--accent)",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  minWidth: 820,
};

const thStyle: CSSProperties = {
  padding: "9px 10px",
  fontWeight: 650,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
};

const primaryCellStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 180,
};
