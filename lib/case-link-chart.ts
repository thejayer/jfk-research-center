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

/** One edge in a shortest-path result, preserving the directed traversal order. */
export type CaseLinkChartPathStep = {
  from: CaseLinkChartNode;
  to: CaseLinkChartNode;
  link: CaseLinkChartLink;
};

/** Shortest visible connection between two chart nodes plus its evidence links. */
export type CaseLinkChartPath = {
  source: CaseLinkChartNode;
  target: CaseLinkChartNode;
  nodes: CaseLinkChartNode[];
  links: CaseLinkChartLink[];
  steps: CaseLinkChartPathStep[];
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
      documents: link.documents,
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

/**
 * Finds the fewest-hop path between two chart nodes, optionally constrained to
 * the currently visible node/link ids. Ties are explored by strongest link count
 * first so equal-length paths prefer stronger shared-record evidence.
 */
export function findShortestCaseLinkPath(
  chart: Pick<CaseLinkChart, "nodes" | "links">,
  sourceId: string,
  targetId: string,
  {
    visibleNodeIds,
    visibleLinkIds,
  }: {
    visibleNodeIds?: Set<string>;
    visibleLinkIds?: Set<string>;
  } = {},
): CaseLinkChartPath | null {
  if (!sourceId || !targetId || sourceId === targetId) return null;

  const nodesById = new Map(chart.nodes.map((node) => [node.id, node]));
  const source = nodesById.get(sourceId);
  const target = nodesById.get(targetId);
  if (!source || !target) return null;
  if (
    visibleNodeIds &&
    (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId))
  ) {
    return null;
  }

  const adjacency = new Map<
    string,
    Array<{ nextId: string; link: CaseLinkChartLink }>
  >();
  for (const link of chart.links) {
    if (visibleLinkIds && !visibleLinkIds.has(link.id)) continue;
    if (
      visibleNodeIds &&
      (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target))
    ) {
      continue;
    }
    if (!nodesById.has(link.source) || !nodesById.has(link.target)) continue;
    const sourceEdges = adjacency.get(link.source) ?? [];
    sourceEdges.push({ nextId: link.target, link });
    adjacency.set(link.source, sourceEdges);

    const targetEdges = adjacency.get(link.target) ?? [];
    targetEdges.push({ nextId: link.source, link });
    adjacency.set(link.target, targetEdges);
  }

  for (const edges of adjacency.values()) {
    edges.sort(
      (a, b) =>
        b.link.count - a.link.count ||
        (nodesById.get(a.nextId)?.name ?? a.nextId).localeCompare(
          nodesById.get(b.nextId)?.name ?? b.nextId,
        ),
    );
  }

  const queue = [sourceId];
  const seen = new Set([sourceId]);
  const previous = new Map<string, { fromId: string; link: CaseLinkChartLink }>();

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    if (currentId === targetId) break;
    for (const edge of adjacency.get(currentId) ?? []) {
      if (seen.has(edge.nextId)) continue;
      seen.add(edge.nextId);
      previous.set(edge.nextId, { fromId: currentId, link: edge.link });
      queue.push(edge.nextId);
    }
  }

  if (!seen.has(targetId)) return null;

  const steps: CaseLinkChartPathStep[] = [];
  let currentId = targetId;
  while (currentId !== sourceId) {
    const prev = previous.get(currentId);
    if (!prev) return null;
    const from = nodesById.get(prev.fromId);
    const to = nodesById.get(currentId);
    if (!from || !to) return null;
    steps.unshift({ from, to, link: prev.link });
    currentId = prev.fromId;
  }

  return {
    source,
    target,
    nodes: [source, ...steps.map((step) => step.to)],
    links: steps.map((step) => step.link),
    steps,
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
