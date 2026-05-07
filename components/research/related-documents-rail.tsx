import Link from "next/link";
import type { CSSProperties } from "react";
import type { DocumentCard } from "@/lib/api-types";
import { Badge, OcrBadge } from "@/components/ui/badge";

type ReferenceLink = {
  id: string;
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
};

type RelatedDocumentsRailProps = {
  title?: string;
  description?: string;
  documents?: DocumentCard[];
  references?: ReferenceLink[];
  searchHref?: string;
  searchLabel?: string;
  emptyText?: string;
  maxDocuments?: number;
};

export function RelatedDocumentsRail({
  title = "Documents to read next",
  description = "Primary-source records that keep this research path moving.",
  documents = [],
  references = [],
  searchHref,
  searchLabel = "Open document search",
  emptyText = "No related records are indexed for this page yet.",
  maxDocuments = 4,
}: RelatedDocumentsRailProps) {
  const visibleDocuments = documents.slice(0, maxDocuments);
  const visibleReferences = references.slice(0, Math.max(0, maxDocuments - visibleDocuments.length));
  const hasItems = visibleDocuments.length > 0 || visibleReferences.length > 0;

  return (
    <section aria-label={title} style={{ marginTop: 56 }}>
      <div
        className="research-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 22,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Read next
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.35rem, 1.12rem + 0.65vw, 1.85rem)",
              lineHeight: 1.15,
              letterSpacing: 0,
              marginBottom: 10,
            }}
          >
            {title}
          </h2>
          <p
            className="muted"
            style={{ maxWidth: "46ch", fontSize: "0.93rem", lineHeight: 1.6 }}
          >
            {description}
          </p>
          {searchHref && (
            <Link
              href={searchHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {searchLabel}
              <ArrowRightIcon />
            </Link>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {hasItems ? (
            <ol
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: 10,
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {visibleDocuments.map((document, index) => (
                <li key={document.id}>
                  <DocumentRailCard document={document} index={index + 1} />
                </li>
              ))}
              {visibleReferences.map((reference, index) => (
                <li key={reference.id}>
                  <ReferenceRailCard
                    reference={reference}
                    index={visibleDocuments.length + index + 1}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <div
              style={{
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                padding: "18px 20px",
              }}
            >
              <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
                {emptyText}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DocumentRailCard({
  document,
  index,
}: {
  document: DocumentCard;
  index: number;
}) {
  return (
    <Link href={document.href} style={cardStyle}>
      <span className="muted num" style={{ fontSize: "0.76rem" }}>
        {String(index).padStart(2, "0")} / NAID {document.naid}
      </span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.02rem",
          lineHeight: 1.25,
          letterSpacing: 0,
        }}
      >
        {document.title}
      </span>
      <span
        className="muted"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          fontSize: "0.76rem",
          lineHeight: 1.35,
        }}
      >
        {document.agency && <span>{document.agency}</span>}
        {document.dateLabel && <span>{document.dateLabel}</span>}
        {document.hasOcr && <OcrBadge />}
      </span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
        {document.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} tone="muted" size="sm">
            {tag}
          </Badge>
        ))}
      </span>
    </Link>
  );
}

function ReferenceRailCard({
  reference,
  index,
}: {
  reference: ReferenceLink;
  index: number;
}) {
  const content = (
    <>
      <span className="muted num" style={{ fontSize: "0.76rem" }}>
        {String(index).padStart(2, "0")}
      </span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.02rem",
          lineHeight: 1.25,
          letterSpacing: 0,
        }}
      >
        {reference.label}
      </span>
      {reference.meta && (
        <span className="muted" style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
          {reference.meta}
        </span>
      )}
    </>
  );

  if (reference.external) {
    return (
      <a
        href={reference.href}
        target="_blank"
        rel="noopener noreferrer"
        style={cardStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={reference.href} style={cardStyle}>
      {content}
    </Link>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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

const cardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
  minHeight: 172,
  padding: "15px 16px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
  boxShadow: "var(--shadow-sm)",
  transition:
    "border-color var(--motion), background var(--motion), box-shadow var(--motion), transform var(--motion)",
} satisfies CSSProperties;
