import type { DocumentDetail } from "@/lib/api-types";
import { formatDateRange, formatNumber } from "@/lib/format";

export function MetadataPanel({ doc }: { doc: DocumentDetail }) {
  const allRows: Array<[string, string | null | undefined]> = [
    ["NAID", doc.naid],
    ["Record Group", doc.recordGroup],
    ["Collection", doc.collectionName],
    ["Agency", doc.agency],
    ["Document Type", doc.documentType],
    ["Date", doc.dateLabel],
    ["Date Range", formatDateRange(doc.startDate, doc.endDate)],
    ["Pages", doc.pageCount ? formatNumber(doc.pageCount) : null],
    ["OCR Chunks", doc.chunkCount !== undefined && doc.chunkCount !== null ? formatNumber(doc.chunkCount) : null],
    ["Has OCR", doc.hasOcr ? "Yes" : "No"],
  ];
  const rows = allRows.filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <aside
      aria-label="Document metadata"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "20px 22px",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Archival metadata
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(90px, auto) 1fr",
          rowGap: 10,
          columnGap: 16,
          fontSize: "0.88rem",
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt className="muted" style={{ fontSize: "0.82rem" }}>
              {k}
            </dt>
            <dd
              style={{
                margin: 0,
                color: "var(--text)",
                wordBreak: "break-word",
              }}
              className={k === "NAID" || k === "Pages" || k === "OCR Chunks" ? "num" : ""}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
