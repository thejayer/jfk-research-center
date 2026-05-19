import type {
  DocumentCard,
  EntityCard,
  EntityResponse,
  TimelineEvent,
  TopicCard,
} from "./api-types";

export type EntityRelationshipNodeType =
  | "entity"
  | "document"
  | "topic"
  | "timeline"
  | "related-entity";

export type EntityRelationshipStrength = "direct" | "context" | "lead";

export type EntityRelationshipNode = {
  type: EntityRelationshipNodeType;
  label: string;
  href: string;
  meta: string;
};

export type EntityRelationshipHop = {
  reason: string;
  node: EntityRelationshipNode;
};

export type EntityRelationshipPath = {
  id: string;
  title: string;
  summary: string;
  strength: EntityRelationshipStrength;
  origin: EntityRelationshipNode;
  hops: EntityRelationshipHop[];
};

const maxRelationshipPaths = 8;
const directDocumentLimit = 3;
const timelineLimit = 2;
const topicLimit = 2;
const relatedEntityLimit = 2;

/**
 * Builds compact, source-linked entity paths from already indexed entity data.
 *
 * Paths describe co-occurrence, chronology, and topic context only; they do not
 * imply causation unless a future data source explicitly models that.
 */
export function buildEntityRelationshipPaths(data: EntityResponse): EntityRelationshipPath[] {
  const origin = entityNode(data.entity);
  const documentPaths = data.topDocuments
    .slice(0, directDocumentLimit)
    .map((document) => documentPath(origin, document));
  const timelinePaths = data.timeline
    .slice(0, timelineLimit)
    .map((event) => timelinePath(origin, event, data.topDocuments));
  const topicPaths = data.relatedTopics
    .slice(0, topicLimit)
    .map((topic) => topicPath(origin, topic));
  const entityPaths = data.relatedEntities
    .slice(0, relatedEntityLimit)
    .map((entity) => relatedEntityPath(origin, entity));

  return [
    ...documentPaths,
    ...timelinePaths,
    ...topicPaths,
    ...entityPaths,
  ].slice(0, maxRelationshipPaths);
}

function documentPath(
  origin: EntityRelationshipNode,
  document: DocumentCard,
): EntityRelationshipPath {
  return {
    id: `document:${document.id}`,
    title: "Record trail",
    summary:
      "A direct record path from the entity profile into a highlighted archival document.",
    strength: "direct",
    origin,
    hops: [
      {
        reason: "Highlighted record mention or metadata match",
        node: documentNode(document),
      },
    ],
  };
}

function timelinePath(
  origin: EntityRelationshipNode,
  event: TimelineEvent,
  documents: DocumentCard[],
): EntityRelationshipPath {
  const relatedDocument = findRelatedDocument(event, documents);
  const hops: EntityRelationshipHop[] = [
    {
      reason: "Chronology entry connected to this profile",
      node: timelineNode(event),
    },
  ];

  if (relatedDocument) {
    hops.push({
      reason: "Timeline entry cites or references this record",
      node: documentNode(relatedDocument),
    });
  }

  return {
    id: `timeline:${event.id}`,
    title: "Chronology path",
    summary:
      "A time-based path that keeps the entity tied to the record chronology without implying causation.",
    strength: "context",
    origin,
    hops,
  };
}

function topicPath(
  origin: EntityRelationshipNode,
  topic: TopicCard,
): EntityRelationshipPath {
  return {
    id: `topic:${topic.slug}`,
    title: "Topic lane",
    summary:
      "A thematic path into a research lane that shares indexed records with this entity.",
    strength: "context",
    origin,
    hops: [
      {
        reason: `${topic.documentCount.toLocaleString()} indexed documents in this lane`,
        node: topicNode(topic),
      },
    ],
  };
}

function relatedEntityPath(
  origin: EntityRelationshipNode,
  entity: EntityCard,
): EntityRelationshipPath {
  const mentions =
    entity.mentionCount === undefined
      ? "Related entity index"
      : `${entity.mentionCount.toLocaleString()} indexed mentions`;

  return {
    id: `entity:${entity.slug}`,
    title: "Entity lead",
    summary:
      "A lead into another person, organization, place, or concept that appears near this profile in the index.",
    strength: "lead",
    origin,
    hops: [
      {
        reason: mentions,
        node: relatedEntityNode(entity),
      },
    ],
  };
}

function findRelatedDocument(
  event: TimelineEvent,
  documents: readonly DocumentCard[],
): DocumentCard | null {
  const identities = new Set(
    (event.relatedDocumentIds ?? [])
      .map((id) => normalizeIdentity(id))
      .filter((id): id is string => Boolean(id)),
  );

  if (identities.size === 0) return null;

  return (
    documents.find(
      (document) =>
        identities.has(normalizeIdentity(document.id) ?? "") ||
        identities.has(normalizeIdentity(document.naid) ?? ""),
    ) ?? null
  );
}

function entityNode(entity: EntityResponse["entity"]): EntityRelationshipNode {
  return {
    type: "entity",
    label: entity.name,
    href: entity.href,
    meta: entity.type,
  };
}

function documentNode(document: DocumentCard): EntityRelationshipNode {
  return {
    type: "document",
    label: document.title,
    href: document.href,
    meta: document.agency ?? document.dateLabel ?? document.documentType ?? "Document",
  };
}

function timelineNode(event: TimelineEvent): EntityRelationshipNode {
  return {
    type: "timeline",
    label: event.title,
    href: `#${encodeURIComponent(event.id)}`,
    meta: event.dateLabel,
  };
}

function topicNode(topic: TopicCard): EntityRelationshipNode {
  return {
    type: "topic",
    label: topic.title,
    href: topic.href,
    meta: `${topic.documentCount.toLocaleString()} documents`,
  };
}

function relatedEntityNode(entity: EntityCard): EntityRelationshipNode {
  return {
    type: "related-entity",
    label: entity.name,
    href: entity.href,
    meta: entity.type,
  };
}

function normalizeIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
