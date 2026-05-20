import type {
  CaseTimelineEvent,
  DocumentCard,
  EntityCard,
  MentionExcerpt,
  TopicCard,
} from "./api-types";
import {
  documentReadingContextLimit,
  documentReadingPassageLimit,
  documentReadingSectionPreviewLimit,
} from "./constants";
import { timelineEventHref } from "./timeline-source-bridge";

export type DocumentReadingGuideItemType =
  | "passage"
  | "topic"
  | "entity"
  | "timeline"
  | "record";

/** Link target rendered in the sticky document reading guide. */
export type DocumentReadingGuideItem = {
  id: string;
  type: DocumentReadingGuideItemType;
  href: string;
  label: string;
  meta: string;
};

/** Grouped close-reading navigation generated from document context. */
export type DocumentReadingGuide = {
  passageJumps: DocumentReadingGuideItem[];
  contextLinks: DocumentReadingGuideItem[];
};

/**
 * Builds sticky-reader navigation from matched OCR passages and nearby context.
 *
 * Passage jumps dedupe by anchor so repeated matches in the same chunk do not
 * crowd the guide. Context links preserve a stable topic/entity/timeline/record
 * order so the sidebar remains predictable while reading.
 */
export function buildDocumentReadingGuide({
  mentions,
  topics,
  entities,
  timelineEvents,
  relatedDocuments,
}: {
  mentions: readonly MentionExcerpt[];
  topics: readonly TopicCard[];
  entities: readonly EntityCard[];
  timelineEvents: readonly CaseTimelineEvent[];
  relatedDocuments: readonly DocumentCard[];
}): DocumentReadingGuide {
  return {
    passageJumps: buildPassageJumps(mentions),
    contextLinks: [
      ...topics.slice(0, documentReadingSectionPreviewLimit).map(topicLink),
      ...entities.slice(0, documentReadingSectionPreviewLimit).map(entityLink),
      ...timelineEvents.slice(0, documentReadingSectionPreviewLimit).map(timelineLink),
      ...relatedDocuments.slice(0, documentReadingSectionPreviewLimit).map(recordLink),
    ].slice(0, documentReadingContextLimit),
  };
}

function buildPassageJumps(
  mentions: readonly MentionExcerpt[],
): DocumentReadingGuideItem[] {
  const seen = new Set<string>();
  const items: DocumentReadingGuideItem[] = [];

  for (const mention of mentions) {
    const href =
      mention.chunkOrder != null ? `#chunk-${mention.chunkOrder}` : `#chunk-${mention.id}`;
    if (seen.has(href)) continue;
    seen.add(href);
    items.push({
      id: mention.id,
      type: "passage",
      href,
      label: mention.chunkOrder != null ? `Chunk ${mention.chunkOrder}` : "Matched passage",
      meta: passageMeta(mention),
    });
    if (items.length >= documentReadingPassageLimit) break;
  }

  return items;
}

function topicLink(topic: TopicCard): DocumentReadingGuideItem {
  return {
    id: `topic:${topic.slug}`,
    type: "topic",
    href: topic.href,
    label: topic.title,
    meta: `${topic.documentCount.toLocaleString()} documents`,
  };
}

function entityLink(entity: EntityCard): DocumentReadingGuideItem {
  return {
    id: `entity:${entity.slug}`,
    type: "entity",
    href: entity.href,
    label: entity.name,
    meta: entity.type,
  };
}

function timelineLink(event: CaseTimelineEvent): DocumentReadingGuideItem {
  return {
    id: `timeline:${event.id}`,
    type: "timeline",
    href: timelineEventHref(event),
    label: event.title,
    meta: event.date,
  };
}

function recordLink(document: DocumentCard): DocumentReadingGuideItem {
  return {
    id: `record:${document.id}`,
    type: "record",
    href: document.href,
    label: document.title,
    meta: document.agency ?? document.dateLabel ?? "Related record",
  };
}

function passageMeta(mention: MentionExcerpt): string {
  const terms = mention.matchedTerms.slice(0, 2).join(", ");
  if (mention.pageLabel && terms) return `${mention.pageLabel} / ${terms}`;
  if (mention.pageLabel) return mention.pageLabel;
  if (terms) return terms;
  return mention.source;
}
