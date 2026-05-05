import type { DocumentDetail } from "@/lib/api-types";
import type { ReactNode } from "react";
import { formatCitation } from "@/lib/citations";
import { formatDateRange, formatNumber } from "@/lib/format";
import { Badge, OcrBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { CiteButton } from "./cite-button";
import { CopyNaidButton } from "./copy-naid-button";

export function DocumentHeader({ doc }: { doc: DocumentDetail }) {
  const citations = formatCitation({
    title: doc.title,
    naid: doc.naid,
    agency: doc.agency,
    recordGroup: doc.recordGroup,
    collectionName: doc.collectionName,
    startDate: doc.startDate,
    endDate: doc.endDate,
    sourceUrl: doc.sourceUrl,
  });
  const dateRange = formatDateRange(doc.startDate, doc.endDate);
  const sourceHref = doc.digitalObjectUrl ?? doc.sourceUrl;

  return (
    <header
      style={{
        paddingTop: 40,
        paddingBottom: 30,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="document-masthead">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {doc.documentType && (
              <Badge tone="accent" size="sm">
                {doc.documentType}
              </Badge>
            )}
            {doc.hasOcr && <OcrBadge />}
            {doc.agency && (
              <span className="muted" style={{ fontSize: "0.86rem" }}>
                {doc.agency}
              </span>
            )}
            {doc.dateLabel && (
              <>
                <Dot />
                <span className="muted num" style={{ fontSize: "0.86rem" }}>
                  {doc.dateLabel}
                </span>
              </>
            )}
          </div>

          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.7rem, 1.3rem + 1.4vw, 2.5rem)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 10,
              lineHeight: 1.12,
            }}
          >
            {doc.title}
          </h1>

          {doc.subtitle && (
            <div
              className="muted"
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "1.05rem",
                marginBottom: 18,
              }}
            >
              {doc.subtitle}
            </div>
          )}

          {doc.description && (
            <p
              style={{
                maxWidth: "70ch",
                fontSize: "1rem",
                lineHeight: 1.65,
                color: "var(--text)",
              }}
            >
              {doc.description}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 22,
              alignItems: "center",
            }}
          >
            {sourceHref && (
              <LinkButton href={sourceHref} variant="primary">
                Open source
                <ExternalLinkIcon />
              </LinkButton>
            )}
            <CiteButton citations={citations} />
          </div>
        </div>

        <aside
          aria-label="Record profile"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "18px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Record profile
          </div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 14,
              margin: 0,
            }}
          >
            <Stat
              label="NAID"
              value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {doc.naid}
                  <CopyNaidButton naid={doc.naid} />
                </span>
              }
            />
            {doc.pageCount !== undefined && doc.pageCount !== null && (
              <Stat label="Pages" value={formatNumber(doc.pageCount)} />
            )}
            {doc.chunkCount !== undefined && doc.chunkCount !== null && (
              <Stat label="OCR chunks" value={formatNumber(doc.chunkCount)} />
            )}
            {dateRange && <Stat label="Date range" value={dateRange} compact />}
          </dl>

          {doc.tags.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Tags
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {doc.tags.map((tag) => (
                  <Badge key={tag} tone="neutral" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  compact?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="num"
        style={{
          margin: 0,
          marginTop: 5,
          fontFamily: "var(--font-serif)",
          fontSize: compact ? "1.1rem" : "1.65rem",
          lineHeight: 1.12,
          color: "var(--text)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function Dot() {
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

function ExternalLinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 4H4.75A1.75 1.75 0 0 0 3 5.75v5.5C3 12.22 3.78 13 4.75 13h5.5A1.75 1.75 0 0 0 12 11.25V9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 3h4v4M8 8l5-5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
