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
      {documents.map((document) => (
        <li
          key={document.id}
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Link
            href={document.href}
            className="entity-document-row"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 18,
              color: "var(--text)",
              padding: "18px 0",
              textDecoration: "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  marginBottom: 8,
                  alignItems: "center",
                }}
              >
                {document.agency && (
                  <Badge tone="outline" size="sm">
                    {document.agency}
                  </Badge>
                )}
                {document.hasOcr && <OcrBadge />}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.1rem",
                  letterSpacing: 0,
                  lineHeight: 1.3,
                  marginBottom: 6,
                }}
              >
                {document.title}
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
                {document.dateLabel && <span>{document.dateLabel}</span>}
                {document.documentType && (
                  <>
                    {document.dateLabel && <Separator />}
                    <span>{document.documentType}</span>
                  </>
                )}
                <Separator />
                <span>
                  NAID <span className="num">{document.naid}</span>
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
              {document.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} tone="muted" size="sm">
                  {tag}
                </Badge>
              ))}
              <span
                className="entity-document-open"
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                <ArrowRightIcon />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "var(--border-strong)",
      }}
    />
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
