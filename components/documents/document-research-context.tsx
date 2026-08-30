import type {
  DocumentCard,
  DocumentDetail,
  EntityCard,
  MentionExcerpt,
  TopicCard,
} from "@/lib/api-types";
import { documentReaderHref } from "@/lib/document-reader";
import { formatNumber } from "@/lib/format";
import {
  ResearchContextPanel,
  type ResearchContextAction,
} from "@/components/research/research-context-panel";

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
  const ocrMentions = mentions.filter(
    (mention) => mention.source === "ocr" && mention.chunkOrder != null,
  );
  const primaryMention = ocrMentions[0];
  const primaryRelatedDocument = relatedDocuments[0];
  const actions: ResearchContextAction[] = [
    ...(primaryTopic
      ? [
          {
            href: `/search?topic=${encodeURIComponent(primaryTopic.slug)}`,
            label: "Search this topic",
            detail: primaryTopic.title,
            reliability: "curated_metadata" as const,
          },
        ]
      : []),
    ...(primaryEntity
      ? [
          {
            href: `/search?entity=${encodeURIComponent(primaryEntity.slug)}&mode=mention`,
            label: "Find matching passages",
            detail: primaryEntity.name,
            reliability: "derived_signal" as const,
          },
        ]
      : []),
    ...(primaryMention
      ? [
          {
            href: documentReaderHref(doc.id, primaryMention.chunkOrder),
            label: "Open first matched chunk",
            detail: formatMentionMeta(primaryMention),
            reliability: "ocr_text" as const,
          },
        ]
      : []),
    ...(primaryRelatedDocument
      ? [
          {
            href: primaryRelatedDocument.href,
            label: "Compare nearby record",
            detail: primaryRelatedDocument.title,
            reliability: primaryRelatedDocument.hasOcr
              ? ("ocr_text" as const)
              : ("curated_metadata" as const),
          },
        ]
      : []),
    {
      href: `/search?q=${encodeURIComponent(doc.title)}&mode=document`,
      label: "Search this title",
      detail: `NAID ${doc.naid}`,
      reliability: "curated_metadata",
    },
  ];

  return (
    <ResearchContextPanel
      id="research-context"
      title="How this record connects"
      description="Topic and entity links come from curated metadata. Passage anchors are only the OCR page currently loaded — not a search of the whole file."
      sections={[
        // Sections keep relationship groups compact and cap each list to the
        // strongest few items already ranked by the upstream data layer.
        {
          title: "Topic lanes",
          emptyText: "No topic lane is indexed yet.",
          links: topics.slice(0, 4).map((topic) => ({
            href: topic.href,
            label: topic.title,
            meta: topic.documentCount
              ? `${formatNumber(topic.documentCount)} records`
              : topic.eyebrow ?? "",
            reliability: "curated_metadata",
          })),
        },
        {
          title: "Mentioned entities",
          emptyText: "No named entity matches are indexed yet.",
          links: entities.slice(0, 5).map((entity) => ({
            href: entity.href,
            label: entity.name,
            meta: entity.type,
            reliability: "curated_metadata",
          })),
        },
        {
          title: "Loaded-page anchors",
          emptyText: "No entity names appear on the currently loaded OCR page.",
          links: ocrMentions.slice(0, 3).map((mention) => ({
            href:
              mention.chunkOrder != null
                ? documentReaderHref(doc.id, mention.chunkOrder)
                : "#ocr-text",
            label:
              mention.matchedTerms[0] ?? mention.pageLabel ?? "Loaded page",
            meta: formatMentionMeta(mention),
            reliability: "ocr_text",
          })),
        },
      ]}
      actions={actions}
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
