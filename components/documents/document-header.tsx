import type { DocumentDetail } from "@/lib/api-types";
import type { ReactNode } from "react";
import { formatCitation } from "@/lib/citations";
import {
  archivalPageCount,
  displayDocumentTitle,
  primaryDocumentAction,
} from "@/lib/document-reader";
import { formatDateRange, formatNumber } from "@/lib/format";
import { Badge, OcrBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { CiteButton } from "./cite-button";
import { CopyNaidButton } from "./copy-naid-button";
import styles from "./document-reader.module.css";

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
  const sourceAction = primaryDocumentAction(doc);
  const heading = displayDocumentTitle(doc);
  const pages = archivalPageCount({
    pageCount: doc.pageCount,
    lastPageLabel: doc.ocrLastPageLabel,
  });

  return (
    <header className={styles.headerHero}>
      <div className={styles.headerGrid}>
        <div className={styles.headerContent}>
          <div className={styles.headerKicker}>
            <span className={styles.headerRule} />
            <span className="eyebrow">Archive record</span>
          </div>
          <div className={styles.badgeRow}>
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
                <span aria-hidden="true" className={styles.metaDot} />
                <span className="muted num" style={{ fontSize: "0.86rem" }}>
                  {doc.dateLabel}
                </span>
              </>
            )}
          </div>

          <h1 className={styles.title}>
            {heading}
          </h1>

          {doc.subtitle && (
            <div className={styles.subtitle}>
              {doc.subtitle}
            </div>
          )}

          {doc.description && (
            <p className={styles.description}>
              {doc.description}
            </p>
          )}

          <div className={styles.primaryActions}>
            {sourceAction && (
              <LinkButton href={sourceAction.href} variant="primary">
                {sourceAction.label}
                <ExternalLinkIcon />
              </LinkButton>
            )}
            <CiteButton citations={citations} />
            <span className={styles.headerSaveAction}>
              <SaveResearchButton
                item={{
                  type: "document",
                  sourceId: doc.id,
                  title: doc.title,
                  href: doc.href,
                  context: doc.naid ? `NAID ${doc.naid}` : doc.agency ?? undefined,
                }}
              />
            </span>
          </div>
        </div>

        <aside
          aria-label="Record profile"
          className={styles.recordProfile}
        >
          <div className={styles.profileHeader}>
            <div className="eyebrow">
              National Archives identifier
            </div>
            <div className={styles.profileTitle}>
              NAID {doc.naid}
            </div>
          </div>
          <dl className={styles.profileList}>
            <Stat
              label="NAID"
              value={
                <span className={styles.inlineStat}>
                  {doc.naid}
                  <CopyNaidButton naid={doc.naid} />
                </span>
              }
            />
            {pages && (
              <Stat
                label="Archival pages"
                value={`${pages.estimated ? "~" : ""}${formatNumber(pages.count)}`}
              />
            )}
            {doc.chunkCount ? (
              <Stat label="OCR pages" value={formatNumber(doc.chunkCount)} />
            ) : null}
            {dateRange && <Stat label="Date range" value={dateRange} compact />}
          </dl>

          {doc.tags.length > 0 && (
            <div className={styles.tagBlock}>
              <div className="eyebrow">
                Tags
              </div>
              <div className={styles.tagList}>
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
    <div
      className={`${styles.profileStat} ${
        compact ? styles.profileStatCompact : ""
      }`}
    >
      <dt className="eyebrow">{label}</dt>
      <dd className="num">
        {value}
      </dd>
    </div>
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
