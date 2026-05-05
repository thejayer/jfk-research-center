import Link from "next/link";
import type { DocumentCard } from "@/lib/api-types";
import { Badge, OcrBadge } from "@/components/ui/badge";

export function TopicDocumentGrid({
  documents,
}: {
  documents: DocumentCard[];
}) {
  if (documents.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        gap: 16,
      }}
    >
      {documents.map((document) => (
        <Link
          key={document.id}
          className="topic-doc-card"
          href={document.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "18px 20px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--text)",
            textDecoration: "none",
            transition: "border-color var(--motion), background var(--motion)",
          }}
        >
          <div
            className="muted"
            style={{
              fontSize: "0.78rem",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {document.agency && <span>{document.agency}</span>}
            {document.agency && document.dateLabel && <Separator />}
            {document.dateLabel && <span>{document.dateLabel}</span>}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.08rem",
              letterSpacing: 0,
              lineHeight: 1.3,
            }}
          >
            {document.title}
          </div>
          {document.snippet && (
            <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55 }}>
              {document.snippet.length > 140
                ? `${document.snippet.slice(0, 140).trim()}...`
                : document.snippet}
            </p>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {document.hasOcr && <OcrBadge />}
            {document.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="muted" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "var(--border-strong)",
      }}
    />
  );
}
