import Link from "next/link";
import type { DocumentCard, ConfidenceLevel } from "@/lib/api-types";
import { Badge, ConfidenceBadge, OcrBadge } from "@/components/ui/badge";
import { highlightHTML } from "@/lib/format";
import { TrustStatusStrip } from "@/components/research/trust-status-strip";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import { sourceReliabilityForDocument } from "@/lib/source-reliability";
import styles from "./search-workspace.module.css";

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
  const matchReasons = buildMatchReasons({
    document,
    mentionCount,
    confidence,
    hasQuery: terms.length > 0,
  });

  return (
    <article
      data-search-result="true"
      tabIndex={-1}
      className={`search-result-focusable surface-card ${styles.resultCard}`}
    >
      <div className={styles.resultMeta}>
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

      <div style={{ marginBottom: 10 }}>
        <TrustStatusStrip doc={document} compact />
      </div>

      <h3
        className={styles.resultCardTitle}
      >
        <Link
          href={href}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(document.title, terms),
          }}
        />
      </h3>

      {document.snippet && (
        <p
          className={`muted search-result-snippet ${styles.resultSnippet}`}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(document.snippet, terms),
          }}
        />
      )}

      {matchReasons.length > 0 && (
        <div
          aria-label="Why this result matched"
          className={styles.reasonGrid}
        >
          {matchReasons.map((reason) => (
            <div
              key={reason.label}
              className={styles.reasonCard}
            >
              <div
                className="eyebrow"
                style={{ fontSize: "0.62rem", marginBottom: 3 }}
              >
                {reason.label}
              </div>
              <div
                className="muted"
                style={{ fontSize: "0.78rem", lineHeight: 1.35 }}
              >
                {reason.detail}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.resultBadgeRow}>
        <ConfidenceBadge level={confidence} />
        <SourceReliabilityBadge kind={sourceReliabilityForDocument(document)} />
        {document.hasOcr && <OcrBadge />}
        {document.tags.slice(0, 4).map((t) => (
          <Badge key={t} tone="muted" size="sm">
            {t}
          </Badge>
        ))}
        {mentionCount > 0 && (
          <span
            className={`muted ${styles.mentionCount}`}
          >
            {mentionCount} {mentionCount === 1 ? "mention" : "mentions"}
          </span>
        )}
      </div>
    </article>
  );
}

function buildMatchReasons({
  document,
  mentionCount,
  confidence,
  hasQuery,
}: {
  document: DocumentCard;
  mentionCount: number;
  confidence: ConfidenceLevel;
  hasQuery: boolean;
}) {
  const reasons = [];
  if (hasQuery) {
    reasons.push({
      label: "Matched by",
      detail: document.snippet ? "Title, metadata, or description text" : "Record metadata",
    });
  }
  if (mentionCount > 0) {
    reasons.push({
      label: "OCR signal",
      detail: `${mentionCount} ${mentionCount === 1 ? "passage" : "passages"} mention the query or filters`,
    });
  } else if (document.hasOcr) {
    reasons.push({
      label: "OCR status",
      detail: "Full text is available for close reading",
    });
  }
  if (document.agency || document.documentType) {
    reasons.push({
      label: "Record type",
      detail: [document.agency, document.documentType].filter(Boolean).join(" / "),
    });
  }
  if (confidence !== "none") {
    const confidenceDetail =
      confidence === "high"
        ? "Entity name appears in the title"
        : confidence === "medium"
          ? "Entity name appears in the description"
          : "Entity name appears in OCR text only";
    reasons.push({
      label: "Confidence",
      detail: confidenceDetail,
    });
  }
  return reasons.slice(0, 3);
}

function withReturnHref(href: string, returnHref?: string): string {
  if (!returnHref || !returnHref.startsWith("/search")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(returnHref)}`;
}

function Dot() {
  return (
    <span aria-hidden style={{ color: "var(--border-strong)" }}>
      |
    </span>
  );
}
