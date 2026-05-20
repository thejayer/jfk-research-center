import { describe, expect, it } from "vitest";
import type {
  CaseTimelineEvent,
  DocumentCard,
  EntityCard,
  MentionExcerpt,
  TopicCard,
} from "../api-types";
import {
  documentReadingContextLimit,
  documentReadingPassageLimit,
} from "../constants";
import { buildDocumentReadingGuide } from "../document-reading-guide";

describe("document reading guide", () => {
  it("builds deduped passage jump points from OCR mentions", () => {
    const guide = buildDocumentReadingGuide({
      mentions: [
        mention({ id: "m1", chunkOrder: 7, pageLabel: "p. 2" }),
        mention({ id: "m2", chunkOrder: 7, matchedTerms: ["duplicate"] }),
        mention({ id: "m3", chunkOrder: null, matchedTerms: ["passport"] }),
      ],
      topics: [],
      entities: [],
      timelineEvents: [],
      relatedDocuments: [],
    });

    expect(guide.passageJumps).toEqual([
      expect.objectContaining({
        id: "m1",
        type: "passage",
        href: "#chunk-7",
        label: "Chunk 7",
        meta: "p. 2 / Oswald, Mexico City",
      }),
      expect.objectContaining({
        id: "m3",
        href: "#chunk-m3",
        label: "Matched passage",
        meta: "passport",
      }),
    ]);
  });

  it("builds context links in a stable reading order", () => {
    const guide = buildDocumentReadingGuide({
      mentions: [],
      topics: [topic("mexico-city"), topic("cia")],
      entities: [entity("oswald"), entity("cia")],
      timelineEvents: [timelineEvent("case-mexico-city")],
      relatedDocuments: [document("wc-report-1964")],
    });

    expect(guide.contextLinks.map((item) => item.type)).toEqual([
      "topic",
      "topic",
      "entity",
      "entity",
      "timeline",
      "record",
    ]);
    expect(guide.contextLinks[4]).toMatchObject({
      href: "/timeline?view=list#case-mexico-city",
      label: "Mexico City trip",
      meta: "1963-09-27",
    });
  });

  it("truncates passage jumps after deduplication", () => {
    const duplicateChunk = mention({ id: "duplicate", chunkOrder: 1 });
    const mentions = [
      duplicateChunk,
      mention({ id: "duplicate-ignored", chunkOrder: 1 }),
      ...Array.from({ length: documentReadingPassageLimit + 3 }, (_, index) =>
        mention({ id: `m-${index + 2}`, chunkOrder: index + 2 }),
      ),
    ];

    const guide = buildDocumentReadingGuide({
      mentions,
      topics: [],
      entities: [],
      timelineEvents: [],
      relatedDocuments: [],
    });

    expect(guide.passageJumps).toHaveLength(documentReadingPassageLimit);
    expect(guide.passageJumps.map((item) => item.href)).toEqual(
      Array.from(
        { length: documentReadingPassageLimit },
        (_, index) => `#chunk-${index + 1}`,
      ),
    );
  });

  it("truncates context links with stable type ordering", () => {
    const guide = buildDocumentReadingGuide({
      mentions: [],
      topics: Array.from({ length: 4 }, (_, index) => topic(`topic-${index + 1}`)),
      entities: Array.from({ length: 4 }, (_, index) => entity(`entity-${index + 1}`)),
      timelineEvents: Array.from({ length: 4 }, (_, index) =>
        timelineEvent(`timeline-${index + 1}`),
      ),
      relatedDocuments: Array.from({ length: 4 }, (_, index) =>
        document(`document-${index + 1}`),
      ),
    });

    expect(guide.contextLinks).toHaveLength(documentReadingContextLimit);
    expect(guide.contextLinks.map((item) => item.id)).toEqual([
      "topic:topic-1",
      "topic:topic-2",
      "entity:entity-1",
      "entity:entity-2",
      "timeline:timeline-1",
      "timeline:timeline-2",
    ]);
  });
});

function mention(overrides: Partial<MentionExcerpt>): MentionExcerpt {
  return {
    id: overrides.id ?? "mention",
    documentId: "doc",
    documentTitle: "Document",
    documentHref: "/document/doc",
    excerpt: "Oswald in Mexico City",
    matchedTerms: overrides.matchedTerms ?? ["Oswald", "Mexico City"],
    confidence: "high",
    source: "ocr",
    pageLabel: overrides.pageLabel,
    chunkOrder: overrides.chunkOrder,
  };
}

function topic(slug: string): TopicCard {
  return {
    slug,
    title:
      slug === "cia"
        ? "CIA"
        : slug === "mexico-city"
          ? "Mexico City"
          : `Topic ${slug}`,
    summary: "Topic summary",
    documentCount: slug === "cia" ? 12 : 24,
    href: `/topics/${slug}`,
  };
}

function entity(slug: string): EntityCard {
  return {
    slug,
    name:
      slug === "cia"
        ? "Central Intelligence Agency"
        : slug === "oswald"
          ? "Lee Harvey Oswald"
          : `Entity ${slug}`,
    type: slug === "cia" ? "org" : "person",
    summary: "Entity summary",
    href: `/entity/${slug}`,
  };
}

function timelineEvent(id: string): CaseTimelineEvent {
  return {
    id,
    date: "1963-09-27",
    timeLocal: null,
    title: "Mexico City trip",
    description: "Oswald travels to Mexico City.",
    category: "operational",
    relatedEntityIds: ["oswald"],
    relatedTopicIds: ["mexico-city"],
    sourceExternal: [],
    documentLinks: [],
    importance: 4,
  };
}

function document(id: string): DocumentCard {
  return {
    id,
    naid: "193887",
    title: "Warren Commission Report",
    href: `/document/${id}`,
    tags: [],
    agency: "Warren Commission",
  };
}
