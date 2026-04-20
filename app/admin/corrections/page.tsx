import Link from "next/link";
import {
  fetchCorrections,
  type CorrectionStatus,
  type CorrectionRow,
} from "@/lib/warehouse";
import { CorrectionRowControls } from "@/components/admin/correction-row";

export const dynamic = "force-dynamic";

const STATUS_TABS: Array<{ value: CorrectionStatus | "all"; label: string }> = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default async function AdminCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const activeStatus = STATUS_TABS.find(
    (t) => t.value === statusRaw,
  )?.value ?? "new";
  const data = await fetchCorrections({
    status: activeStatus === "all" ? undefined : activeStatus,
    limit: 200,
  });
  const totalAll =
    data.counts.new +
    data.counts.reviewing +
    data.counts.resolved +
    data.counts.rejected;

  return (
    <main
      style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}
    >
      <header style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Admin
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "6px 0 4px" }}>
          Corrections queue
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          User-submitted fixes from `/corrections` and in-page "Report an
          error" links. Triage by setting each submission's status; notes
          are saved alongside the status change.
        </p>
      </header>

      <nav
        aria-label="Filter by status"
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {STATUS_TABS.map((t) => {
          const active = t.value === activeStatus;
          const count =
            t.value === "all" ? totalAll : data.counts[t.value];
          return (
            <Link
              key={t.value}
              href={
                t.value === "new"
                  ? "/admin/corrections"
                  : `/admin/corrections?status=${t.value}`
              }
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 13,
                border: "1px solid var(--border-strong)",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {t.label} · {count.toLocaleString()}
            </Link>
          );
        })}
      </nav>

      {data.items.length === 0 ? (
        <p style={{ padding: 24, color: "var(--text-muted)" }}>
          No submissions with this status.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {data.items.map((row) => (
            <CorrectionCard key={row.submissionId} row={row} />
          ))}
        </ul>
      )}
    </main>
  );
}

function CorrectionCard({ row }: { row: CorrectionRow }) {
  return (
    <li
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "baseline",
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        <span className="num">
          {new Date(row.submittedAt).toLocaleString()}
        </span>
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "1px 8px",
            border: "1px solid var(--border-strong)",
            borderRadius: 4,
          }}
        >
          {row.surface.replace(/_/g, " ")}
        </span>
        {row.targetId && (
          <code
            style={{
              fontSize: 12,
              background: "var(--bg)",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {row.targetId}
          </code>
        )}
        {row.submitterEmail && (
          <a
            href={`mailto:${row.submitterEmail}`}
            style={{ color: "var(--text-muted)" }}
          >
            {row.submitterEmail}
          </a>
        )}
        <code
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {row.submissionId.slice(0, 8)}
        </code>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: 2,
          }}
        >
          Issue
        </div>
        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>
          {row.issue}
        </p>
      </div>
      {row.suggestedFix && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 2,
            }}
          >
            Suggested fix
          </div>
          <p
            style={{
              fontSize: 14,
              margin: 0,
              whiteSpace: "pre-wrap",
              color: "var(--text-muted)",
            }}
          >
            {row.suggestedFix}
          </p>
        </div>
      )}
      <CorrectionRowControls row={row} />
    </li>
  );
}
