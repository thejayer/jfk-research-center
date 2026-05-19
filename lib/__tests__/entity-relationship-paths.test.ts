import { describe, expect, it } from "vitest";
import type { EntityResponse } from "../api-types";
import { buildEntityRelationshipPaths } from "../entity-relationship-paths";

describe("entity relationship paths", () => {
  it("builds typed paths from documents, timeline, topics, and related entities", () => {
    const paths = buildEntityRelationshipPaths(entityResponse());

    expect(paths.map((path) => path.id)).toEqual([
      "document:doc-1",
      "document:doc-2",
      "timeline:mexico-city-trip",
      "topic:mexico-city",
      "entity:cia",
    ]);

    expect(paths[0]).toMatchObject({
      title: "Record trail",
      strength: "direct",
      origin: { type: "entity", href: "/entity/lee-harvey-oswald" },
      hops: [
        {
          reason: "Highlighted record mention or metadata match",
          node: { type: "document", href: "/document/doc-1" },
        },
      ],
    });

    const timelinePath = paths.find((path) => path.id === "timeline:mexico-city-trip");
    expect(timelinePath?.hops.map((hop) => hop.node.type)).toEqual([
      "timeline",
      "document",
    ]);
    expect(timelinePath?.hops[0].node.href).toBe("#mexico-city-trip");
    expect(timelinePath?.hops[1]).toMatchObject({
      reason: "Timeline entry cites or references this record",
      node: { href: "/document/doc-1" },
    });

    const topicPath = paths.find((path) => path.id === "topic:mexico-city");
    expect(topicPath?.hops[0]).toMatchObject({
      reason: "42 indexed documents in this lane",
      node: { type: "topic", meta: "42 documents" },
    });
  });

  it("matches timeline documents by normalized id or NAID", () => {
    const data = entityResponse({
      timelineRelatedDocumentIds: [" 193887 "],
    });

    const timelinePath = buildEntityRelationshipPaths(data).find(
      (path) => path.id === "timeline:mexico-city-trip",
    );

    expect(timelinePath?.hops[1].node.href).toBe("/document/doc-1");
  });

  it("returns an empty path list when no relationship data exists", () => {
    const data = entityResponse({
      documents: [],
      timelineRelatedDocumentIds: [],
      topics: [],
      relatedEntities: [],
      timelineEvents: [],
    });

    expect(buildEntityRelationshipPaths(data)).toEqual([]);
  });
});

function entityResponse(
  overrides: {
    documents?: EntityResponse["topDocuments"];
    timelineEvents?: EntityResponse["timeline"];
    timelineRelatedDocumentIds?: string[];
    topics?: EntityResponse["relatedTopics"];
    relatedEntities?: EntityResponse["relatedEntities"];
  } = {},
): EntityResponse {
  const documents =
    overrides.documents ??
    [
      {
        id: "doc-1",
        naid: "193887",
        title: "Oswald 201 file",
        href: "/document/doc-1",
        tags: ["CIA"],
        agency: "CIA",
        dateLabel: "1963",
        hasOcr: true,
      },
      {
        id: "doc-2",
        naid: "193888",
        title: "Warren Commission exhibit",
        href: "/document/doc-2",
        tags: ["Commission"],
        agency: "Warren Commission",
        dateLabel: "1964",
        hasOcr: true,
      },
    ];

  return {
    entity: {
      slug: "lee-harvey-oswald",
      name: "Lee Harvey Oswald",
      type: "person",
      summary: "Former Marine and accused assassin.",
      documentCount: 12,
      mentionCount: 120,
      href: "/entity/lee-harvey-oswald",
      aliases: ["LHO"],
      description: "Former Marine and accused assassin.",
    },
    timeline:
      overrides.timelineEvents ??
      [
        {
          id: "mexico-city-trip",
          date: "1963-09-27",
          dateLabel: "Sep. 27, 1963",
          title: "Mexico City trip",
          description: "Oswald traveled to Mexico City.",
          relatedDocumentIds: overrides.timelineRelatedDocumentIds ?? ["doc-1"],
        },
      ],
    relatedTopics:
      overrides.topics ??
      [
        {
          slug: "mexico-city",
          title: "Mexico City",
          summary: "Diplomatic and intelligence records.",
          documentCount: 42,
          href: "/topics/mexico-city",
        },
      ],
    relatedEntities:
      overrides.relatedEntities ??
      [
        {
          slug: "cia",
          name: "Central Intelligence Agency",
          type: "org",
          summary: "US foreign intelligence agency.",
          documentCount: 30,
          mentionCount: 88,
          href: "/entity/cia",
        },
      ],
    topDocuments: documents,
    mentionExcerpts: [],
    sources: [],
    facts: [],
  };
}
