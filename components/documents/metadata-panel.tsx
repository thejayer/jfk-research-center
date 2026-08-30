import type { DocumentDetail } from "@/lib/api-types";
import { formatArchivalPageCount } from "@/lib/document-reader";
import { formatDateRange, formatNumber } from "@/lib/format";
import styles from "./document-reader.module.css";

export function MetadataPanel({ doc }: { doc: DocumentDetail }) {
  const pages = formatArchivalPageCount({
    pageCount: doc.pageCount,
    lastPageLabel: doc.ocrLastPageLabel,
  });
  const naraTitle =
    doc.sourceTitle && doc.sourceTitle !== doc.title ? doc.sourceTitle : null;
  const allRows: Array<[string, string | null | undefined]> = [
    ["NAID", doc.naid],
    ["NARA title", naraTitle],
    ["Record Group", doc.recordGroup],
    ["Collection", doc.collectionName],
    ["Agency", doc.agency],
    ["Document Type", doc.documentType],
    ["Date", doc.dateLabel],
    ["Date Range", formatDateRange(doc.startDate, doc.endDate)],
    [pages?.label ?? "Pages", pages?.value ?? null],
    ["OCR pages", doc.chunkCount ? formatNumber(doc.chunkCount) : null],
    ["Has OCR", doc.hasOcr ? "Yes" : "No"],
  ];
  const rows = allRows.filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <aside
      aria-label="Document metadata"
      className={styles.metadataPanel}
    >
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Archival metadata
      </div>
      <dl className={styles.metadataList}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.metadataRow}>
            <dt className={`muted ${styles.metadataKey}`}>
              {k}
            </dt>
            <dd
              className={`${styles.metadataValue} ${
                k === "NAID" || k === "Pages" || k === "Archival pages" || k === "OCR Chunks" || k === "OCR pages" ? "num" : ""
              }`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
