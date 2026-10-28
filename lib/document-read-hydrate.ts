/**
 * In-process helpers for the document-page payload.
 *
 * The live document job reads jfk_records only. Entity rows, related
 * document ids, and topic slugs come from thin tables that are loaded
 * once per Cloud Run instance — not joined into every page job.
 */

export type DocumentEntityMapRow = {
  document_id: string;
  entity_id: string;
  confidence: string;
  match_source: string;
};

export type DocumentMapRow = {
  entity_id: string;
  confidence: string;
  match_source: string;
};

export type RelatedDocumentId = {
  document_id: string;
  shared: number;
};

export type DocumentEntityGraph = {
  byDocument: Map<string, DocumentMapRow[]>;
  byEntity: Map<string, string[]>;
};

export const RELATED_DOCUMENT_LIMIT = 6;

/**
 * Builds inverted indexes for one-document lookups after a single
 * entity-map scan.
 */
export function buildDocumentEntityGraph(
  rows: readonly DocumentEntityMapRow[],
): DocumentEntityGraph {
  const byDocument = new Map<string, DocumentMapRow[]>();
  const byEntity = new Map<string, string[]>();

  for (const row of rows) {
    const documentId = row.document_id?.trim();
    const entityId = row.entity_id?.trim();
    if (!documentId || !entityId) continue;

    const mapRows = byDocument.get(documentId) ?? [];
    mapRows.push({
      entity_id: entityId,
      confidence: row.confidence,
      match_source: row.match_source,
    });
    byDocument.set(documentId, mapRows);

    const documents = byEntity.get(entityId) ?? [];
    documents.push(documentId);
    byEntity.set(entityId, documents);
  }

  return { byDocument, byEntity };
}

export function mapRowsForDocument(
  graph: DocumentEntityGraph,
  documentId: string,
): DocumentMapRow[] {
  return graph.byDocument.get(documentId) ?? [];
}

/**
 * Same ranking as the retired bundle SQL: other documents that share
 * the most mapped entities, then document_id, capped at six.
 */
export function relatedDocumentIdsFor(
  graph: DocumentEntityGraph,
  documentId: string,
  limit = RELATED_DOCUMENT_LIMIT,
): RelatedDocumentId[] {
  const mapRows = mapRowsForDocument(graph, documentId);
  if (mapRows.length === 0) return [];

  const shared = new Map<string, number>();
  for (const row of mapRows) {
    const others = graph.byEntity.get(row.entity_id) ?? [];
    for (const otherId of others) {
      if (otherId === documentId) continue;
      shared.set(otherId, (shared.get(otherId) ?? 0) + 1);
    }
  }

  return [...shared.entries()]
    .map(([id, count]) => ({ document_id: id, shared: count }))
    .sort(
      (left, right) =>
        right.shared - left.shared ||
        left.document_id.localeCompare(right.document_id),
    )
    .slice(0, limit);
}

export function sortRelatedRows<T extends { document_id: string }>(
  rows: readonly T[],
  relatedIds: readonly RelatedDocumentId[],
): T[] {
  const rank = new Map(
    relatedIds.map((item, index) => [item.document_id, index]),
  );
  return [...rows].sort((left, right) => {
    const leftRank = rank.get(left.document_id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.document_id) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.document_id.localeCompare(right.document_id);
  });
}
