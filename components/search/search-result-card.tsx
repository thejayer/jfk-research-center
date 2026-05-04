import Link from "next/link";
import type { DocumentCard, ConfidenceLevel } from "@/lib/api-types";
import { Badge, ConfidenceBadge, OcrBadge } from "@/components/ui/badge";
import { highlightHTML } from "@/lib/format";

export function SearchResultCard({
  document,
  mentionCount,
  confidence,
  query,
  returnHref,
}: {
  document: DocumentCard;
  mentionCount: number;
  confidence: ConfidenceLevel;
  query: string;
  returnHref?: string;
}) {
  const terms = query.trim() ? [query.trim()] : [];
  const href = withReturnHref(document.href, returnHref);

  return (
    <article
      data-search-result="true"
      tabIndex={-1}
      className="search-result-focusable"
      style={{
        padding: "20px",
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        scrollMarginTop: "calc(var(--header-height, 64px) + 80px)",
        transition:
          "border-color var(--motion), box-shadow var(--motion), transform var(--motion)",
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
          lineHeight: 1.4,
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
          href={href}
          style={{ color: "var(--text)" }}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(document.title, terms),
          }}
        />
      </h3>

      {document.snippet && (
        <p
          className="muted search-result-snippet"
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
            style={{
              fontSize: "0.82rem",
              marginLeft: "auto",
              padding: "4px 0",
              whiteSpace: "nowrap",
            }}
          >
            {mentionCount} {mentionCount === 1 ? "mention" : "mentions"}
          </span>
        )}
      </div>
    </article>
  );
}

function withReturnHref(href: string, returnHref?: string): string {
  if (!returnHref || !returnHref.startsWith("/search")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(returnHref)}`;
}

function Dot() {
  return (
    <span aria-hidden style={{ color: "var(--border-strong)" }}>
      ·
    </span>
  );
}
