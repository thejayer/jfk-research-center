import Link from "next/link";
import type { DocumentCard } from "@/lib/api-types";
import { Badge, OcrBadge } from "@/components/ui/badge";

export function EntityDocumentList({
  documents,
}: {
  documents: DocumentCard[];
}) {
  if (documents.length === 0) return null;
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        borderTop: "1px solid var(--border)",
      }}
    >
      {documents.map((d) => (
        <li
          key={d.id}
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "18px 0",
          }}
        >
          <Link
            href={d.href}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              color: "var(--text)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.1rem",
                  letterSpacing: "-0.005em",
                  marginBottom: 4,
                }}
              >
                {d.title}
              </div>
              <div
                className="muted"
                style={{
                  fontSize: "0.84rem",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {d.agency && <span>{d.agency}</span>}
                {d.dateLabel && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{d.dateLabel}</span>
                  </>
                )}
                {d.documentType && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{d.documentType}</span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span>
                  NAID <span className="num">{d.naid}</span>
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {d.hasOcr && <OcrBadge />}
              {d.tags.slice(0, 2).map((t) => (
                <Badge key={t} tone="muted" size="sm">
                  {t}
                </Badge>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
