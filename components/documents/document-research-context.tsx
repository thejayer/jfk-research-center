import type {
  DocumentCard,
  DocumentDetail,
  EntityCard,
  MentionExcerpt,
  TopicCard,
} from "@/lib/api-types";
import { formatNumber } from "@/lib/format";
import { ResearchContextPanel } from "@/components/research/research-context-panel";

type DocumentResearchContextProps = {
  doc: DocumentDetail;
  topics: TopicCard[];
  entities: EntityCard[];
  mentions: MentionExcerpt[];
  relatedDocuments: DocumentCard[];
};

/**
 * Builds the document-level research context panel from already-fetched
 * document relationships.
 *
 * @param doc Current document detail used for title search and NAID labels.
 * @param topics Topic lanes connected to the document.
 * @param entities Named entities mentioned by the document.
 * @param mentions OCR passage matches with optional chunk anchors.
 * @param relatedDocuments Neighboring records to compare against.
 */
export function DocumentResearchContext({
  doc,
  topics,
  entities,
  mentions,
  relatedDocuments,
}: DocumentResearchContextProps) {
  // Primary items drive the suggested action rail; conditional spreads below
  // omit actions when a relationship type is unavailable.
  const primaryEntity = entities[0];
  const primaryTopic = topics[0];
  const primaryMention = mentions.find((mention) => mention.chunkOrder != null);
  const primaryRelatedDocument = relatedDocuments[0];

  return (
    <ResearchContextPanel
      id="research-context"
      title="How this record connects"
      description="Jump from the archival item into its topic lanes, named entities, matched passages, and neighboring records."
      sections={[
        // Sections keep relationship groups compact and cap each list to the
        // strongest few items already ranked by the upstream data layer.
        {
          title: "Topic lanes",
          emptyText: "No topic lane is indexed yet.",
          links: topics.slice(0, 4).map((topic) => ({
            href: topic.href,
            label: topic.title,
            meta: `${formatNumber(topic.documentCount)} records`,
          })),
        },
        {
          title: "Mentioned entities",
          emptyText: "No named entity matches are indexed yet.",
          links: entities.slice(0, 5).map((entity) => ({
            href: entity.href,
            label: entity.name,
            meta: entity.type,
          })),
        },
        {
          title: "Passage anchors",
          emptyText: "No passage anchors are indexed yet.",
          links: mentions.slice(0, 3).map((mention) => ({
            // Mentions with chunk order deep-link to the OCR chunk; otherwise
            // fall back to the full OCR section so every passage link lands.
            href:
              mention.chunkOrder != null
                ? `#chunk-${mention.chunkOrder}`
                : "#ocr-text",
            label:
              mention.matchedTerms[0] ?? mention.pageLabel ?? "Matched passage",
            meta: formatMentionMeta(mention),
          })),
        },
      ]}
      actions={[
        // Conditional spreads keep the action rail focused on available
        // relationships while the title search remains a stable fallback.
        ...(primaryTopic
          ? [
              {
                href: `/search?topic=${encodeURIComponent(primaryTopic.slug)}`,
                label: "Search this topic",
                detail: primaryTopic.title,
              },
            ]
          : []),
        ...(primaryEntity
          ? [
              {
                href: `/search?entity=${encodeURIComponent(primaryEntity.slug)}&mode=mention`,
                label: "Find matching passages",
                detail: primaryEntity.name,
              },
            ]
          : []),
        ...(primaryMention
          ? [
              {
                href: `#chunk-${primaryMention.chunkOrder}`,
                label: "Open first matched chunk",
                detail: formatMentionMeta(primaryMention),
              },
            ]
          : []),
        ...(primaryRelatedDocument
          ? [
              {
                href: primaryRelatedDocument.href,
                label: "Compare nearby record",
                detail: primaryRelatedDocument.title,
              },
            ]
          : []),
        {
          href: `/search?q=${encodeURIComponent(doc.title)}&mode=document`,
          label: "Search this title",
          detail: `NAID ${doc.naid}`,
        },
      ]}
    />
  );
}

function formatMentionMeta(mention: MentionExcerpt): string {
  const parts = [];
  if (mention.chunkOrder != null) parts.push(`chunk ${mention.chunkOrder}`);
  if (mention.pageLabel) parts.push(mention.pageLabel);
  parts.push(mention.source);
  return parts.join(" | ");
}
