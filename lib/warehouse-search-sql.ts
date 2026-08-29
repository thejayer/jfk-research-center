/**
 * BigQuery SQL builders for warehouse-backed search.
 *
 * Search jobs must stay under JFK_BQ_MAX_BYTES_BILLED (256 MiB in production).
 * Document search must not scan jfk_text_chunks.chunk_text. OCR document IDs
 * come from the clustered token table (sql/33). Record jobs select only the
 * card columns — never r.* / release_history.
 */

export type WarehouseTableRef = {
  project: string;
  curatedDataset: string;
  mvpDataset: string;
};

export type TopicTableRef = {
  slug: string;
  table: string;
};

/** Columns needed to render a search result card. Not r.* / release_history. */
export const SEARCH_DOCUMENT_COLUMNS = [
  "document_id",
  "naid",
  "title",
  "description",
  "record_group",
  "agency",
  "start_date",
  "document_type",
  "has_ocr",
  "release_set",
] as const;

export function recordsTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_records\``;
}

export function chunksTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_text_chunks\``;
}

export function ocrTokenTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.search_ocr_document_tokens\``;
}

export function ocrChunksTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.search_ocr_chunks\``;
}

export function entityMapTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_document_entity_map\``;
}

export function entitiesTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_entities\``;
}

export function searchDocumentSelectSql(alias = "r"): string {
  return SEARCH_DOCUMENT_COLUMNS.map((column) => `${alias}.${column}`).join(",\n              ");
}

/**
 * Caps OCR-hit document IDs passed as `@ocrHitIds` on later jobs.
 * Corpus OCR coverage is ~2,165 unique RIFs; 10k is well above that
 * so ranking is unchanged for real queries while staying far under
 * BigQuery's 10 MB request-body limit.
 */
export const OCR_HIT_DOCUMENT_ID_LIMIT = 10_000;

function ocrTokenDocumentIdSubquery(
  tables: WarehouseTableRef,
  tokenCount: number,
): string {
  if (tokenCount <= 0) {
    return `SELECT document_id FROM UNNEST(CAST([] AS ARRAY<STRING>)) AS document_id`;
  }
  if (tokenCount === 1) {
    return `SELECT document_id
          FROM ${ocrTokenTable(tables)}
         WHERE token >= @ocrTok0 AND token < @ocrTok0End
         GROUP BY document_id
         LIMIT ${OCR_HIT_DOCUMENT_ID_LIMIT}`;
  }
  const branches = Array.from({ length: tokenCount }, (_, index) => {
    return `SELECT document_id
          FROM ${ocrTokenTable(tables)}
         WHERE token >= @ocrTok${index} AND token < @ocrTok${index}End
         GROUP BY document_id`;
  });
  return `SELECT document_id FROM (
        ${branches.join("\n        INTERSECT DISTINCT\n        ")}
        )
        LIMIT ${OCR_HIT_DOCUMENT_ID_LIMIT}`;
}

/**
 * OCR-hit document IDs from the clustered token table.
 * `tokenCount` must match the @ocrTokN / @ocrTokNEnd params.
 */
export function buildOcrHitDocumentIdSql(
  tables: WarehouseTableRef,
  tokenCount = 1,
): string {
  return `SELECT document_id
     FROM (${ocrTokenDocumentIdSubquery(tables, tokenCount)})`;
}

/** OCR snippets for a page of already-selected documents. */
export function buildOcrSnippetSql(tables: WarehouseTableRef): string {
  return `SELECT document_id, ANY_VALUE(chunk_text) AS hit_text
     FROM ${ocrChunksTable(tables)}
    WHERE document_id IN UNNEST(@documentIds)
      AND LOWER(chunk_text) LIKE @qLike
    GROUP BY document_id`;
}

export function buildDocumentMatchConfidenceSql(): string {
  return `CASE
          WHEN @qNorm = '' THEN CAST(NULL AS STRING)
          WHEN LOWER(r.title) LIKE @qLike THEN 'high'
          WHEN LOWER(r.description) LIKE @qLike THEN 'medium'
          WHEN r.document_id IN UNNEST(@ocrHitIds) THEN 'low'
        END`;
}

/**
 * Score and page document matches from jfk_records only.
 * OCR hits arrive as @ocrHitIds so this job does not scan jfk_text_chunks.
 */
export function buildDocumentSearchSql(
  tables: WarehouseTableRef,
  whereSql: string,
  limit: number,
  offset: number,
): string {
  return `WITH scored AS (
         SELECT ${searchDocumentSelectSql("r")},
                ${buildDocumentMatchConfidenceSql()} AS match_confidence
           FROM ${recordsTable(tables)} r
       )
       SELECT scored.*, COUNT(*) OVER() AS total_count
         FROM scored
        ${whereSql}
        ORDER BY
          CASE match_confidence
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END,
          start_date DESC NULLS LAST
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
}

export function buildDocumentSearchCountSql(
  tables: WarehouseTableRef,
  whereSql: string,
): string {
  return `WITH scored AS (
         SELECT ${searchDocumentSelectSql("r")},
                ${buildDocumentMatchConfidenceSql()} AS match_confidence
           FROM ${recordsTable(tables)} r
       )
       SELECT COUNT(*) AS n
         FROM scored
        ${whereSql}`;
}

export function buildQueryMatchedDocumentsSql(tables: WarehouseTableRef): string {
  return `SELECT r.document_id,
              r.agency,
              r.start_date,
              ${buildDocumentMatchConfidenceSql()} AS match_confidence
         FROM ${recordsTable(tables)} r
        WHERE ${buildDocumentMatchConfidenceSql()} IS NOT NULL`;
}

/** Filter-only searches have no text query; score every record's metadata. */
export function buildFilterOnlyDocumentsSql(tables: WarehouseTableRef): string {
  return `SELECT r.document_id,
              r.agency,
              r.start_date,
              CAST(NULL AS STRING) AS match_confidence
         FROM ${recordsTable(tables)} r`;
}

export function buildMentionSearchSql(
  tables: WarehouseTableRef,
  whereSql: string,
  tokenCount: number,
  limit: number,
  offset: number,
): string {
  const tokenFilter =
    tokenCount > 0
      ? `c.document_id IN (${ocrTokenDocumentIdSubquery(tables, tokenCount)})`
      : "FALSE";
  return `SELECT r.document_id, r.naid, r.title,
              c.chunk_id, c.chunk_order, c.chunk_text, c.page_label,
              COUNT(*) OVER() AS total_count
         FROM ${ocrChunksTable(tables)} c
         JOIN ${recordsTable(tables)} r
           USING (document_id)
        WHERE ${tokenFilter}
          AND ${whereSql}
        ORDER BY c.document_id, c.chunk_order
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
}

export function buildMentionSearchCountSql(
  tables: WarehouseTableRef,
  whereSql: string,
  tokenCount: number,
): string {
  const tokenFilter =
    tokenCount > 0
      ? `c.document_id IN (${ocrTokenDocumentIdSubquery(tables, tokenCount)})`
      : "FALSE";
  return `SELECT COUNT(*) AS n
         FROM ${ocrChunksTable(tables)} c
         JOIN ${recordsTable(tables)} r
           USING (document_id)
        WHERE ${tokenFilter}
          AND ${whereSql}`;
}

export function buildDocumentPageChunksSql(tables: WarehouseTableRef): string {
  return `SELECT chunk_id, chunk_order, chunk_text, page_label, source_type
         FROM ${ocrChunksTable(tables)}
        WHERE document_id = @id
        ORDER BY chunk_order
        LIMIT 12`;
}

export function buildIdentifierSearchSql(
  tables: WarehouseTableRef,
  whereSql: string,
  limit: number,
  offset: number,
): string {
  return `SELECT ${searchDocumentSelectSql("r")},
              'high' AS match_confidence,
              COUNT(*) OVER() AS total_count
         FROM ${recordsTable(tables)} r
        WHERE ${whereSql}
        ORDER BY r.start_date DESC NULLS LAST
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
}

export function buildCorpusYearFacetSql(tables: WarehouseTableRef): string {
  return `SELECT CAST(EXTRACT(YEAR FROM start_date) AS STRING) AS y,
              COUNT(*) AS n
         FROM ${recordsTable(tables)}
        WHERE start_date IS NOT NULL
          AND EXTRACT(YEAR FROM start_date) BETWEEN 1950 AND 2005
        GROUP BY y`;
}

export function buildCorpusAgencyFacetSql(tables: WarehouseTableRef): string {
  return `SELECT agency, COUNT(*) AS n
         FROM ${recordsTable(tables)}
        WHERE agency IS NOT NULL AND TRIM(agency) != ''
        GROUP BY agency`;
}

export function buildCorpusEntityFacetSql(tables: WarehouseTableRef): string {
  return `SELECT entity_id, COUNT(DISTINCT document_id) AS n
         FROM ${entityMapTable(tables)}
        GROUP BY entity_id`;
}

export function buildCorpusTopicFacetSql(
  tables: WarehouseTableRef,
  topics: readonly TopicTableRef[],
): string {
  return topics
    .map(
      (topic) =>
        `SELECT '${topic.slug}' AS slug, COUNT(*) AS n
         FROM \`${tables.project}.${tables.mvpDataset}.${topic.table}\``,
    )
    .join("\n UNION ALL ");
}

/** document_id + slug only — never SELECT * from the full-width MVP copies. */
export function buildTopicMembershipSql(
  tables: WarehouseTableRef,
  topics: readonly TopicTableRef[],
): string {
  return topics
    .map(
      (topic) =>
        `SELECT document_id, '${topic.slug}' AS topic_slug
         FROM \`${tables.project}.${tables.mvpDataset}.${topic.table}\``,
    )
    .join("\n UNION ALL ");
}

export function buildEntityMembershipSql(tables: WarehouseTableRef): string {
  return `SELECT document_id, entity_id
     FROM ${entityMapTable(tables)}`;
}

export function sqlMentionsOcrChunks(sql: string): boolean {
  return /jfk_text_chunks/i.test(sql) || /search_ocr_chunks/i.test(sql);
}

export function sqlScansLegacyTextChunks(sql: string): boolean {
  return /jfk_text_chunks/i.test(sql);
}

export function sqlUsesOcrTokenTable(sql: string): boolean {
  return /search_ocr_document_tokens/i.test(sql);
}

export function sqlSelectsStarFromRecords(sql: string): boolean {
  return /SELECT\s+r\.\*/i.test(sql);
}

export function sqlSelectsReleaseHistory(sql: string): boolean {
  return /release_history/i.test(sql);
}
