import { describe, expect, it } from "vitest";
import type { CooccurrenceGraph } from "../api-types";
import { buildCaseLinkChart } from "../case-link-chart";

const graph: CooccurrenceGraph = {
  nodes: [
    { id: "oswald", name: "Lee Harvey Oswald", type: "person", degree: 8 },
    { id: "cia", name: "Central Intelligence Agency", type: "org", degree: 6 },
    { id: "dealey-plaza", name: "Dealey Plaza", type: "place", degree: 4 },
    { id: "mexico-city", name: "Mexico City trip", type: "concept", degree: 3 },
  ],
  links: [
    { source: "oswald", target: "cia", count: 12 },
    { source: "oswald", target: "dealey-plaza", count: 9 },
    { source: "cia", target: "mexico-city", count: 5 },
    { source: "dealey-plaza", target: "mexico-city", count: 2 },
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
    expect(chart.summary.hiddenNodeCount).toBe(1);
    expect(chart.summary.hiddenLinkCount).toBe(1);
  });
});
