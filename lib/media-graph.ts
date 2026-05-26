import type {
  CooccurrenceGraph,
  CooccurrenceLink,
  CooccurrenceNode,
  MediaAsset,
} from "./api-types";
import { listMediaAssets, mediaAssetHref, mediaRightsLabel } from "./media-assets";

type RelatedGraphNode = Pick<CooccurrenceNode, "id" | "name" | "type">;

const mediaNodePrefix = "media:";
const topicNodePrefix = "topic:";

const storageLabels = {
  metadata_only: "Metadata only",
  external_reference: "External reference",
  eligible_for_cache: "Cache eligible",
  cached: "Cached",
} as const satisfies Record<MediaAsset["storageStatus"], string>;

/**
 * Adds rights-aware official media records to a co-occurrence graph.
 *
 * Media assets become media nodes, then link to known entity nodes and topic
 * concept nodes from relatedEntities/relatedTopics metadata. Existing document
 * co-occurrence links are preserved.
 */
export function addMediaAssetsToCooccurrenceGraph(
  graph: CooccurrenceGraph,
  {
    assets = listMediaAssets(),
    entityNodes = [],
    topicLabels = {},
  }: {
    assets?: readonly MediaAsset[];
    entityNodes?: readonly RelatedGraphNode[];
    topicLabels?: Readonly<Record<string, string>>;
  } = {},
): CooccurrenceGraph {
  const nodesById = new Map<string, CooccurrenceNode>();
  for (const node of graph.nodes) {
    nodesById.set(node.id, { ...node });
  }

  const entityNodeById = new Map(entityNodes.map((node) => [node.id, node]));
  const links: CooccurrenceLink[] = graph.links.map((link) => ({
    ...link,
    kind: link.kind ?? "cooccurrence",
    documents: [...link.documents],
  }));
  const seenLinks = new Set(links.map((link) => linkKey(link.source, link.target)));

  for (const asset of assets) {
    const mediaId = mediaGraphNodeId(asset.id);
    const relatedEntityIds = asset.relatedEntities.filter(Boolean);
    const relatedTopicIds = asset.relatedTopics.filter(Boolean);
    if (relatedEntityIds.length === 0 && relatedTopicIds.length === 0) continue;

    nodesById.set(mediaId, mediaAssetToNode(asset));

    for (const entityId of relatedEntityIds) {
      ensureEntityNode(nodesById, entityNodeById.get(entityId));
      if (!nodesById.has(entityId)) continue;
      addUniqueLink(links, seenLinks, {
        source: mediaId,
        target: entityId,
        count: 1,
        kind: "media_entity",
        label: "Official media link",
        href: mediaAssetHref(asset.id),
        documents: [],
      });
    }

    for (const topicId of relatedTopicIds) {
      const topicNodeId = topicGraphNodeId(topicId);
      ensureTopicNode(nodesById, topicId, topicLabels[topicId]);
      addUniqueLink(links, seenLinks, {
        source: mediaId,
        target: topicNodeId,
        count: 1,
        kind: "media_topic",
        label: "Topic media link",
        href: mediaAssetHref(asset.id),
        documents: [],
      });
    }
  }

  const peersById = buildPeers(links);
  const nodes = [...nodesById.values()]
    .map((node) => ({
      ...node,
      degree: peersById.get(node.id)?.size ?? 0,
    }))
    .filter((node) => node.degree > 0)
    .sort(
      (a, b) =>
        b.degree - a.degree ||
        typeRank(a.type) - typeRank(b.type) ||
        a.name.localeCompare(b.name),
    );

  const keptNodeIds = new Set(nodes.map((node) => node.id));
  return {
    ...graph,
    nodes,
    links: links
      .filter((link) => keptNodeIds.has(link.source) && keptNodeIds.has(link.target))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      ),
  };
}

/** Returns the prefixed graph node id used for a media asset card. */
export function mediaGraphNodeId(assetId: string): string {
  return `${mediaNodePrefix}${assetId}`;
}

/** Returns the prefixed graph node id used for a topic card. */
export function topicGraphNodeId(topicId: string): string {
  return `${topicNodePrefix}${topicId}`;
}

function mediaAssetToNode(asset: MediaAsset): CooccurrenceNode {
  return {
    id: mediaGraphNodeId(asset.id),
    name: asset.title,
    type: "media",
    degree: 0,
    href: mediaAssetHref(asset.id),
    searchHref: null,
    typeLabel: "Media",
    description: asset.description,
    meta: [asset.collection, asset.dateLabel ?? asset.date, asset.mediaType]
      .filter(Boolean)
      .join(" / "),
    collection: asset.collection,
    sourceUrl: asset.sourceUrl,
    rightsLabel: mediaRightsLabel(asset.rightsStatus),
    storageLabel: storageLabels[asset.storageStatus],
  };
}

function ensureEntityNode(
  nodesById: Map<string, CooccurrenceNode>,
  entity: RelatedGraphNode | undefined,
) {
  if (!entity || nodesById.has(entity.id)) return;
  nodesById.set(entity.id, {
    ...entity,
    degree: 0,
    href: `/entity/${encodeURIComponent(entity.id)}`,
    typeLabel: entityTypeLabel(entity.type),
  });
}

function ensureTopicNode(
  nodesById: Map<string, CooccurrenceNode>,
  topicId: string,
  topicLabel: string | undefined,
) {
  const id = topicGraphNodeId(topicId);
  if (nodesById.has(id)) return;
  nodesById.set(id, {
    id,
    name: topicLabel ?? labelFromSlug(topicId),
    type: "concept",
    degree: 0,
    href: `/topic/${encodeURIComponent(topicId)}`,
    searchHref: `/search?mode=mention&topic=${encodeURIComponent(topicId)}`,
    typeLabel: "Topic",
    description: "Topic relationship from official media metadata.",
    meta: "Topic connection",
  });
}

function addUniqueLink(
  links: CooccurrenceLink[],
  seenLinks: Set<string>,
  link: CooccurrenceLink,
) {
  const key = linkKey(link.source, link.target);
  if (seenLinks.has(key)) return;
  seenLinks.add(key);
  links.push(link);
}

function buildPeers(links: readonly CooccurrenceLink[]): Map<string, Set<string>> {
  const peersById = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.source === link.target) continue;
    if (!peersById.has(link.source)) peersById.set(link.source, new Set());
    if (!peersById.has(link.target)) peersById.set(link.target, new Set());
    peersById.get(link.source)?.add(link.target);
    peersById.get(link.target)?.add(link.source);
  }
  return peersById;
}

function linkKey(source: string, target: string): string {
  return source < target ? `${source}--${target}` : `${target}--${source}`;
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
    case "media":
      return "Media";
  }
}

function typeRank(type: CooccurrenceNode["type"]): number {
  switch (type) {
    case "person":
      return 0;
    case "org":
      return 1;
    case "place":
      return 2;
    case "concept":
      return 3;
    case "media":
      return 4;
  }
}

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
