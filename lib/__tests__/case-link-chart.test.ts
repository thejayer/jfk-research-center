import { describe, expect, it } from "vitest";
import type { CooccurrenceGraph } from "../api-types";
import {
  buildCaseLinkChart,
  findShortestCaseLinkPath,
} from "../case-link-chart";

const graph: CooccurrenceGraph = {
  nodes: [
    { id: "oswald", name: "Lee Harvey Oswald", type: "person", degree: 8 },
    { id: "cia", name: "Central Intelligence Agency", type: "org", degree: 6 },
    { id: "dealey-plaza", name: "Dealey Plaza", type: "place", degree: 4 },
    { id: "mexico-city", name: "Mexico City trip", type: "concept", degree: 3 },
    {
      id: "media:jfkl-jfkwhp-1963-11-22-b",
      name: "Trip to Texas: Dallas arrival at Love Field and motorcade",
      type: "media",
      degree: 1,
      href: "/media/jfkl-jfkwhp-1963-11-22-b",
      searchHref: null,
      typeLabel: "Media",
      description: "Official media record.",
      sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-1963-11-22-b",
      rightsLabel: "Public domain likely",
      storageLabel: "External reference",
    },
  ],
  links: [
    {
      source: "oswald",
      target: "cia",
      count: 12,
      documents: [
        {
          id: "wc-report-1964",
          naid: "193887",
          title: "Warren Commission Report",
          href: "/document/wc-report-1964",
          tags: ["Warren Commission"],
        },
      ],
    },
    { source: "oswald", target: "dealey-plaza", count: 9, documents: [] },
    { source: "cia", target: "mexico-city", count: 5, documents: [] },
    {
      source: "dealey-plaza",
      target: "mexico-city",
      count: 2,
      documents: [],
    },
    {
      source: "media:jfkl-jfkwhp-1963-11-22-b",
      target: "dealey-plaza",
      count: 1,
      kind: "media_topic",
      label: "Topic media link",
      href: "/media/jfkl-jfkwhp-1963-11-22-b",
      documents: [],
    },
  ],
  yearBounds: { min: 1950, max: 2005 },
  appliedRange: { yearFrom: 1963, yearTo: 1979 },
};

describe("case link chart", () => {
  it("converts co-occurrence data into chart nodes and labeled links", () => {
    const chart = buildCaseLinkChart(graph);

    expect(chart.nodes[0]).toMatchObject({
      id: "oswald",
      href: "/entity/oswald",
      searchHref: "/search?mode=mention&entity=oswald",
      typeLabel: "Person",
      rank: 1,
    });
    expect(chart.links[0]).toMatchObject({
      id: "oswald--cia",
      href: "/search?mode=mention&entity=oswald&entity=cia",
      label: "12 shared records",
      sourceName: "Lee Harvey Oswald",
      targetName: "Central Intelligence Agency",
      documents: [
        expect.objectContaining({
          id: "wc-report-1964",
          title: "Warren Commission Report",
        }),
      ],
    });
    expect(chart.summary.typeCounts.media).toBe(1);
  });

  it("preserves media node and link metadata for the detail panel", () => {
    const chart = buildCaseLinkChart(graph);
    const mediaNode = chart.nodes.find((node) => node.type === "media");
    const mediaLink = chart.links.find((link) => link.kind === "media_topic");

    expect(mediaNode).toMatchObject({
      id: "media:jfkl-jfkwhp-1963-11-22-b",
      href: "/media/jfkl-jfkwhp-1963-11-22-b",
      searchHref: null,
      typeLabel: "Media",
      rightsLabel: "Public domain likely",
      storageLabel: "External reference",
    });
    expect(mediaLink).toMatchObject({
      id: "media:jfkl-jfkwhp-1963-11-22-b--dealey-plaza",
      label: "Topic media link",
      href: "/media/jfkl-jfkwhp-1963-11-22-b",
      documents: [],
    });
  });

  it("caps nodes and links without leaving links to hidden nodes", () => {
    const chart = buildCaseLinkChart(graph, { maxNodes: 3, maxLinks: 1 });

    expect(chart.nodes.map((node) => node.id)).toEqual([
      "oswald",
      "cia",
      "dealey-plaza",
    ]);
    expect(chart.links).toHaveLength(1);
    expect(chart.links[0].source).toBe("oswald");
    expect(chart.links[0].target).toBe("cia");
    expect(chart.summary.hiddenNodeCount).toBe(2);
    expect(chart.summary.hiddenLinkCount).toBe(1);
  });

  it("finds the shortest visible path and preserves the strongest tie-break", () => {
    const chart = buildCaseLinkChart(graph);
    const path = findShortestCaseLinkPath(chart, "oswald", "mexico-city");

    expect(path?.nodes.map((node) => node.id)).toEqual([
      "oswald",
      "cia",
      "mexico-city",
    ]);
    expect(path?.steps.map((step) => step.link.id)).toEqual([
      "oswald--cia",
      "cia--mexico-city",
    ]);
  });

  it("returns null when filters hide every available path", () => {
    const chart = buildCaseLinkChart(graph);
    const path = findShortestCaseLinkPath(chart, "oswald", "mexico-city", {
      visibleNodeIds: new Set(["oswald", "mexico-city"]),
    });

    expect(path).toBeNull();
  });
});
