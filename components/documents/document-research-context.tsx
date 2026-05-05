import Link from "next/link";
import type { ReactNode } from "react";
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
      className="document-research-context"
    >
      <div className="document-research-context__intro">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Research context
        </div>
        <h2 id="research-context-title">How this record connects</h2>
        <p className="muted">
          Jump from the archival item into its topic lanes, named entities,
          matched passages, and neighboring records.
        </p>
      </div>

      <div className="document-research-context__columns">
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

      <aside aria-label="Suggested next moves" className="document-research-context__moves">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Suggested moves
        </div>
        <div className="document-research-context__move-list">
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
    <div>
      <h3>{title}</h3>
      <div className="document-research-context__link-list">{children}</div>
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
    <Link href={href} className="document-research-context__link">
      <span>{label}</span>
      <span className="muted">{meta}</span>
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
    <Link href={href} className="document-research-context__move">
      <span>
        <strong>{label}</strong>
        <span className="muted">{detail}</span>
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
