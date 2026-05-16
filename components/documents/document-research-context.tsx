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

  return (
    <ResearchContextPanel
      id="research-context"
      title="How this record connects"
      description="Jump from the archival item into its topic lanes, named entities, matched passages, and neighboring records."
      sections={[
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
