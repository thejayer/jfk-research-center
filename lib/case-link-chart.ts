import type {
  CooccurrenceGraph,
  CooccurrenceLink,
  CooccurrenceNode,
  DocumentCard,
} from "./api-types";

const defaultMaxNodes = 42;
const defaultMaxLinks = 90;

export type CaseLinkChartNode = CooccurrenceNode & {
  href: string;
  searchHref: string;
  typeLabel: string;
  rank: number;
};

export type CaseLinkChartLink = Omit<CooccurrenceLink, "documents"> & {
  id: string;
  href: string;
  label: string;
  sourceName: string;
  targetName: string;
  documents: DocumentCard[];
};

export type CaseLinkChart = {
  nodes: CaseLinkChartNode[];
  links: CaseLinkChartLink[];
  yearBounds: CooccurrenceGraph["yearBounds"];
  appliedRange: CooccurrenceGraph["appliedRange"];
  summary: {
    nodeCount: number;
    linkCount: number;
    hiddenNodeCount: number;
    hiddenLinkCount: number;
    typeCounts: Record<CooccurrenceNode["type"], number>;
  };
};

export function buildCaseLinkChart(
  graph: CooccurrenceGraph,
  {
    maxNodes = defaultMaxNodes,
    maxLinks = defaultMaxLinks,
  }: { maxNodes?: number; maxLinks?: number } = {},
): CaseLinkChart {
  const sortedNodes = [...graph.nodes].sort(
    (a, b) => b.degree - a.degree || a.name.localeCompare(b.name),
  );
  const keptNodes = sortedNodes.slice(0, Math.max(0, maxNodes));
  const keptNodeIds = new Set(keptNodes.map((node) => node.id));
  const nodeNameById = new Map(keptNodes.map((node) => [node.id, node.name]));

  const sortedLinks = graph.links
    .filter((link) => keptNodeIds.has(link.source) && keptNodeIds.has(link.target))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.source.localeCompare(b.source) ||
        a.target.localeCompare(b.target),
    );
  const keptLinks = sortedLinks.slice(0, Math.max(0, maxLinks));

  const typeCounts = {
    person: 0,
    org: 0,
    place: 0,
    concept: 0,
  } satisfies Record<CooccurrenceNode["type"], number>;

  const nodes = keptNodes.map((node, index): CaseLinkChartNode => {
    typeCounts[node.type] += 1;
    return {
      ...node,
      href: `/entity/${encodeURIComponent(node.id)}`,
      searchHref: entitySearchHref(node.id),
      typeLabel: entityTypeLabel(node.type),
      rank: index + 1,
    };
  });

  const links = keptLinks.map((link): CaseLinkChartLink => {
    const sourceName = nodeNameById.get(link.source) ?? link.source;
    const targetName = nodeNameById.get(link.target) ?? link.target;
    return {
      ...link,
      id: `${link.source}--${link.target}`,
      href: pairSearchHref(link),
      label: `${link.count.toLocaleString()} shared record${
        link.count === 1 ? "" : "s"
      }`,
      sourceName,
      targetName,
      documents: link.documents ?? [],
    };
  });

  return {
    nodes,
    links,
    yearBounds: graph.yearBounds,
    appliedRange: graph.appliedRange,
    summary: {
      nodeCount: nodes.length,
      linkCount: links.length,
      hiddenNodeCount: Math.max(0, graph.nodes.length - nodes.length),
      hiddenLinkCount: Math.max(0, sortedLinks.length - links.length),
      typeCounts,
    },
  };
}

function entityTypeLabel(type: CooccurrenceNode["type"]): string {
  switch (type) {
    case "person":
      return "Person";
    case "org":
      return "Organization";
    case "place":
      return "Place";
    case "concept":
      return "Concept";
  }
}

function entitySearchHref(entityId: string): string {
  const params = new URLSearchParams();
  params.set("mode", "mention");
  params.append("entity", entityId);
  return `/search?${params.toString()}`;
}

function pairSearchHref(link: CooccurrenceLink): string {
  const params = new URLSearchParams();
  params.set("mode", "mention");
  params.append("entity", link.source);
  params.append("entity", link.target);
  return `/search?${params.toString()}`;
}
