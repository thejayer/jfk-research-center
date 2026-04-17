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
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 16,
      }}
    >
      {documents.map((d) => (
        <Link
          key={d.id}
          href={d.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "18px 20px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--text)",
            transition: "border-color var(--motion), background var(--motion)",
          }}
        >
          <div
            className="muted"
            style={{ fontSize: "0.78rem", display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            {d.agency && <span>{d.agency}</span>}
            {d.dateLabel && (
              <>
                <span aria-hidden>·</span>
                <span>{d.dateLabel}</span>
              </>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.08rem",
              letterSpacing: "-0.005em",
              lineHeight: 1.3,
            }}
          >
            {d.title}
          </div>
          {d.snippet && (
            <p
              className="muted"
              style={{ fontSize: "0.9rem", lineHeight: 1.55 }}
            >
              {d.snippet.length > 140
                ? `${d.snippet.slice(0, 140).trim()}…`
                : d.snippet}
            </p>
          )}
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}
          >
            {d.hasOcr && <OcrBadge />}
            {d.tags.slice(0, 3).map((t) => (
              <Badge key={t} tone="muted" size="sm">
                {t}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
