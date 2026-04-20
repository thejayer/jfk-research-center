import Link from "next/link";
import { fetchRedactionQueue } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export default async function AdminRedactionsQueuePage() {
  const queue = await fetchRedactionQueue(200);
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
      }}
    >
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
          Redaction review queue
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          {queue.totalDocs.toLocaleString()} document
          {queue.totalDocs === 1 ? "" : "s"} awaiting review ·{" "}
          {queue.totalUnreviewed.toLocaleString()} unreviewed detection
          {queue.totalUnreviewed === 1 ? "" : "s"}
        </p>
      </header>

      {queue.items.length === 0 ? (
        <p style={{ padding: 24, color: "var(--muted)" }}>
          Queue is empty. Run the redaction detector to seed it.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={thStyle}>Document</th>
              <th style={thStyle}>Agency</th>
              <th style={thStyle}>Release</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Pages</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Unreviewed</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Max redact %</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((item) => (
              <tr
                key={item.documentId}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td style={tdStyle}>
                  <Link
                    href={`/admin/redactions/${item.documentId}`}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      color: "var(--fg)",
                      textDecoration: "none",
                      borderBottom: "1px dotted var(--border-strong)",
                    }}
                  >
                    {item.documentId}
                  </Link>
                  {item.title && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginTop: 2,
                        maxWidth: 460,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>
                  {item.agency || "—"}
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>
                  {item.releaseSet || "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {item.numPages ?? "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                  {item.unreviewedCount}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--muted)" }}>
                  {item.totalDetections}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--muted)" }}>
                  {item.maxAreaPct != null
                    ? `${item.maxAreaPct.toFixed(2)}%`
                    : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <Link
                    href={`/admin/redactions/${item.documentId}`}
                    style={{
                      color: "var(--fg)",
                      fontSize: 13,
                    }}
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  verticalAlign: "top",
};
