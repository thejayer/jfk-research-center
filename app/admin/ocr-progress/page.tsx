import { fetchOcrProgress } from "@/lib/warehouse";
import type { OcrReleaseProgress, OcrFailureItem } from "@/lib/api-types";

export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 10;

export default async function OcrProgressPage() {
  const data = await fetchOcrProgress();
  const { perRelease, overall, recentFailures, generatedAt } = data;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
      }}
    >
      <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />

      <header style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Admin
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "6px 0 4px" }}>
          OCR pipeline progress
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {overall.ocrComplete.toLocaleString()} of{" "}
          {overall.totalDocs.toLocaleString()} doc-versions OCR'd ·{" "}
          {pct(overall.ocrComplete, overall.totalDocs)} complete · auto-refresh{" "}
          {REFRESH_SECONDS}s
        </p>
      </header>

      <SummaryRow
        items={[
          { label: "Total doc-versions", value: overall.totalDocs },
          { label: "PDF fetched", value: overall.fetched },
          { label: "OCR complete", value: overall.ocrComplete },
          { label: "Pages OCR'd", value: overall.totalPagesComplete },
          { label: "Failed", value: overall.failed, danger: overall.failed > 0 },
          { label: "Bytes fetched", value: humanBytes(overall.totalBytesFetched), raw: true },
        ]}
      />

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "32px 0 12px", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
        Per release
      </h2>
      <ReleaseTable rows={perRelease} />

      {recentFailures.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "32px 0 12px", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
            Recent failures ({recentFailures.length})
          </h2>
          <FailuresTable rows={recentFailures} />
        </>
      )}

      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 32, textAlign: "right" }}>
        Generated {new Date(generatedAt).toUTCString()}
      </p>
    </main>
  );
}

function SummaryRow({
  items,
}: {
  items: { label: string; value: number | string; danger?: boolean; raw?: boolean }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "12px 14px",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
            {it.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              marginTop: 4,
              color: it.danger ? "var(--danger, #c62828)" : "var(--text)",
            }}
          >
            {it.raw ? it.value : (typeof it.value === "number" ? it.value.toLocaleString() : it.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReleaseTable({ rows }: { rows: OcrReleaseProgress[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--muted)" }}>
          <Th>Release</Th>
          <Th align="right">Total</Th>
          <Th align="right">Fetched</Th>
          <Th align="right">OCR running</Th>
          <Th align="right">OCR complete</Th>
          <Th align="right">Failed</Th>
          <Th align="right">Pages</Th>
          <Th align="right">Avg conf</Th>
          <Th>Progress</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const failed = r.fetchFailed + r.ocrFailed;
          return (
            <tr key={r.releaseSet} style={{ borderTop: "1px solid var(--border)" }}>
              <Td><strong>{r.releaseSet}</strong></Td>
              <Td align="right">{r.totalDocs.toLocaleString()}</Td>
              <Td align="right">{r.fetched.toLocaleString()}</Td>
              <Td align="right">{r.ocrRunning.toLocaleString()}</Td>
              <Td align="right">{r.ocrComplete.toLocaleString()}</Td>
              <Td align="right" danger={failed > 0}>{failed.toLocaleString()}</Td>
              <Td align="right">{r.totalPagesComplete.toLocaleString()}</Td>
              <Td align="right">{r.meanConfidence != null ? (r.meanConfidence * 100).toFixed(1) + "%" : "—"}</Td>
              <Td>
                <ProgressBar pct={r.totalDocs > 0 ? (r.ocrComplete / r.totalDocs) * 100 : 0} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FailuresTable({ rows }: { rows: OcrFailureItem[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--muted)" }}>
          <Th>Doc / Release</Th>
          <Th>Stage</Th>
          <Th>Error</Th>
          <Th>When</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const stage = r.fetchStatus === "failed" ? "fetch" : "docai";
          const msg = r.fetchError ?? r.docaiError ?? "";
          return (
            <tr key={`${r.documentId}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
              <Td>
                <code>{r.documentId}</code>{" "}
                <span style={{ color: "var(--muted)" }}>· {r.releaseSet}</span>
              </Td>
              <Td>{stage}</Td>
              <Td>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
                  {msg.length > 120 ? msg.slice(0, 117) + "..." : msg}
                </span>
              </Td>
              <Td><time>{new Date(r.updatedAt).toUTCString().replace(" GMT", "")}</time></Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: 120, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${clamped}%`, height: "100%", background: "var(--text)" }} />
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      style={{
        padding: "8px 10px",
        fontWeight: 500,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  danger,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  danger?: boolean;
}) {
  return (
    <td
      style={{
        padding: "8px 10px",
        textAlign: align ?? "left",
        fontVariantNumeric: "tabular-nums",
        color: danger ? "var(--danger, #c62828)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function pct(num: number, denom: number): string {
  if (denom <= 0) return "0.0%";
  return ((num / denom) * 100).toFixed(1) + "%";
}

function humanBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
