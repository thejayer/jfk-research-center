import Link from "next/link";
import type { DocumentCard, ConfidenceLevel } from "@/lib/api-types";
import { Badge, ConfidenceBadge, OcrBadge } from "@/components/ui/badge";
import { highlightHTML } from "@/lib/format";

export function SearchResultCard({
  document,
  mentionCount,
  confidence,
  query,
}: {
  document: DocumentCard;
  mentionCount: number;
  confidence: ConfidenceLevel;
  query: string;
}) {
  const terms = query.trim() ? [query.trim()] : [];

  return (
    <article
      data-search-result="true"
      tabIndex={-1}
      style={{
        padding: "22px 0",
        borderTop: "1px solid var(--border)",
        scrollMarginTop: 120,
        outline: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 10,
          color: "var(--text-muted)",
          fontSize: "0.82rem",
        }}
      >
        {document.agency && <span>{document.agency}</span>}
        {document.dateLabel && (
          <>
            <Dot />
            <span>{document.dateLabel}</span>
          </>
        )}
        {document.documentType && (
          <>
            <Dot />
            <span>{document.documentType}</span>
          </>
        )}
        <Dot />
        <span>
          NAID <span className="num">{document.naid}</span>
        </span>
      </div>

      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.35rem",
          letterSpacing: "-0.005em",
          lineHeight: 1.2,
          marginBottom: 8,
        }}
      >
        <Link
          href={document.href}
          style={{ color: "var(--text)" }}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(document.title, terms),
          }}
        />
      </h3>

      {document.snippet && (
        <p
          className="muted"
          style={{
            fontSize: "0.97rem",
            lineHeight: 1.6,
            maxWidth: "72ch",
            marginBottom: 12,
          }}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(document.snippet, terms),
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <ConfidenceBadge level={confidence} />
        {document.hasOcr && <OcrBadge />}
        {document.tags.slice(0, 4).map((t) => (
          <Badge key={t} tone="muted" size="sm">
            {t}
          </Badge>
        ))}
        {mentionCount > 0 && (
          <span
            className="muted"
            style={{ fontSize: "0.82rem", marginLeft: "auto" }}
          >
            {mentionCount} {mentionCount === 1 ? "mention" : "mentions"}
          </span>
        )}
      </div>
    </article>
  );
}

function Dot() {
  return (
    <span aria-hidden style={{ color: "var(--border-strong)" }}>
      ·
    </span>
  );
}
