import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type {
  DocumentCard,
  DocumentDetail,
  EntityCard,
  MentionExcerpt,
  TopicCard,
} from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

type DocumentResearchContextProps = {
  doc: DocumentDetail;
  topics: TopicCard[];
  entities: EntityCard[];
  mentions: MentionExcerpt[];
  relatedDocuments: DocumentCard[];
};

export function DocumentResearchContext({
  doc,
  topics,
  entities,
  mentions,
  relatedDocuments,
}: DocumentResearchContextProps) {
  const primaryEntity = entities[0];
  const primaryTopic = topics[0];
  const primaryMention = mentions.find((mention) => mention.chunkOrder != null);
  const primaryRelatedDocument = relatedDocuments[0];
  const hasContext =
    topics.length > 0 ||
    entities.length > 0 ||
    mentions.length > 0 ||
    relatedDocuments.length > 0;

  if (!hasContext) return null;

  return (
    <section
      id="research-context"
      aria-labelledby="research-context-title"
      style={sectionStyle}
    >
      <div style={introStyle}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Research context
        </div>
        <h2 id="research-context-title" style={headingStyle}>
          How this record connects
        </h2>
        <p className="muted" style={introCopyStyle}>
          Jump from the archival item into its topic lanes, named entities,
          matched passages, and neighboring records.
        </p>
      </div>

      <div style={columnsStyle}>
        <ContextColumn title="Topic lanes">
          {topics.length > 0 ? (
            topics.slice(0, 4).map((topic) => (
              <ContextLink
                key={topic.slug}
                href={topic.href}
                label={topic.title}
                meta={`${formatNumber(topic.documentCount)} records`}
              />
            ))
          ) : (
            <EmptyLine text="No topic lane is indexed yet." />
          )}
        </ContextColumn>

        <ContextColumn title="Mentioned entities">
          {entities.length > 0 ? (
            entities.slice(0, 5).map((entity) => (
              <ContextLink
                key={entity.slug}
                href={entity.href}
                label={entity.name}
                meta={entity.type}
              />
            ))
          ) : (
            <EmptyLine text="No named entity matches are indexed yet." />
          )}
        </ContextColumn>

        <ContextColumn title="Passage anchors">
          {mentions.length > 0 ? (
            mentions.slice(0, 3).map((mention) => (
              <ContextLink
                key={mention.id}
                href={
                  mention.chunkOrder != null
                    ? `#chunk-${mention.chunkOrder}`
                    : "#ocr-text"
                }
                label={
                  mention.matchedTerms[0] ??
                  mention.pageLabel ??
                  "Matched passage"
                }
                meta={formatMentionMeta(mention)}
              />
            ))
          ) : (
            <EmptyLine text="No passage anchors are indexed yet." />
          )}
        </ContextColumn>
      </div>

      <aside aria-label="Suggested next moves" style={movesStyle}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Suggested moves
        </div>
        <div style={listStyle}>
          {primaryTopic && (
            <MoveLink
              href={`/search?topic=${encodeURIComponent(primaryTopic.slug)}`}
              label="Search this topic"
              detail={primaryTopic.title}
            />
          )}
          {primaryEntity && (
            <MoveLink
              href={`/search?entity=${encodeURIComponent(primaryEntity.slug)}&mode=mention`}
              label="Find matching passages"
              detail={primaryEntity.name}
            />
          )}
          {primaryMention && (
            <MoveLink
              href={`#chunk-${primaryMention.chunkOrder}`}
              label="Open first matched chunk"
              detail={formatMentionMeta(primaryMention)}
            />
          )}
          {primaryRelatedDocument && (
            <MoveLink
              href={primaryRelatedDocument.href}
              label="Compare nearby record"
              detail={primaryRelatedDocument.title}
            />
          )}
          <MoveLink
            href={`/search?q=${encodeURIComponent(doc.title)}&mode=document`}
            label="Search this title"
            detail={`NAID ${doc.naid}`}
          />
        </div>
      </aside>
    </section>
  );
}

function ContextColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={columnStyle}>
      <h3 style={columnHeadingStyle}>{title}</h3>
      <div style={listStyle}>{children}</div>
    </div>
  );
}

function ContextLink({
  href,
  label,
  meta,
}: {
  href: string;
  label: string;
  meta: string;
}) {
  return (
    <Link href={href} style={contextLinkStyle}>
      <span style={textClampStyle}>{label}</span>
      <span className="muted" style={metaStyle}>
        {meta}
      </span>
    </Link>
  );
}

function MoveLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link href={href} style={moveLinkStyle}>
      <span style={textClampStyle}>
        <strong style={moveLabelStyle}>{label}</strong>
        <span className="muted" style={moveDetailStyle}>
          {detail}
        </span>
      </span>
      <ArrowRightIcon />
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.45 }}>
      {text}
    </p>
  );
}

function formatMentionMeta(mention: MentionExcerpt): string {
  const parts = [];
  if (mention.chunkOrder != null) parts.push(`chunk ${mention.chunkOrder}`);
  if (mention.pageLabel) parts.push(mention.pageLabel);
  parts.push(mention.source);
  return parts.join(" | ");
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m9 4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 24,
  marginTop: 28,
  padding: 24,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, var(--accent-soft)), var(--surface))",
  boxShadow: "var(--shadow-sm)",
};

const introStyle: CSSProperties = {
  gridColumn: "1 / -1",
  maxWidth: 760,
};

const headingStyle: CSSProperties = {
  fontSize: "clamp(1.45rem, 1.25rem + 0.7vw, 2rem)",
  letterSpacing: 0,
  marginBottom: 8,
};

const introCopyStyle: CSSProperties = {
  maxWidth: "62ch",
  lineHeight: 1.55,
};

const columnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
  gap: 18,
  minWidth: 0,
};

const columnStyle: CSSProperties = {
  minWidth: 0,
};

const columnHeadingStyle: CSSProperties = {
  marginBottom: 10,
  fontFamily: "var(--font-sans)",
  fontSize: "0.86rem",
  fontWeight: 700,
  letterSpacing: 0,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const baseLinkStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  minWidth: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "color-mix(in srgb, var(--surface) 88%, transparent)",
  color: "var(--text)",
  textDecoration: "none",
};

const contextLinkStyle: CSSProperties = {
  ...baseLinkStyle,
  minHeight: 64,
  padding: "10px 12px",
  alignItems: "flex-start",
  flexDirection: "column",
};

const moveLinkStyle: CSSProperties = {
  ...baseLinkStyle,
  minHeight: 62,
  padding: "11px 13px",
  alignItems: "center",
};

const textClampStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  fontSize: "0.76rem",
  lineHeight: 1.35,
};

const movesStyle: CSSProperties = {
  borderTop: "1px solid var(--border)",
  paddingTop: 18,
  minWidth: 0,
};

const moveLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.88rem",
  lineHeight: 1.25,
};

const moveDetailStyle: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: "0.76rem",
  lineHeight: 1.35,
};
