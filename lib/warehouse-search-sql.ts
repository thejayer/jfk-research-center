/**
 * BigQuery SQL builders for warehouse-backed search.
 *
 * Search jobs must stay under JFK_BQ_MAX_BYTES_BILLED (256 MiB in production).
 * The July 2026 query-aware facet SQL failed that cap by scanning OCR text and
 * full-width jfk_mvp.* copies in one job. These builders keep each job narrow:
 * document_id-only topic membership, metadata scoring on jfk_records, and OCR
 * scans that never share a job with SELECT r.*.
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

export function recordsTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_records\``;
}

export function chunksTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_text_chunks\``;
}

export function entityMapTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_document_entity_map\``;
}

export function entitiesTable({ project, curatedDataset }: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.jfk_entities\``;
}

/**
 * Caps OCR-hit document IDs passed as `@ocrHitIds` on later jobs.
 * Corpus OCR coverage is ~2,165 unique RIFs; 10k is well above that
 * so ranking is unchanged for real queries while staying far under
 * BigQuery's 10 MB request-body limit.
 */
export const OCR_HIT_DOCUMENT_ID_LIMIT = 10_000;

export function buildOcrHitDocumentIdSql(tables: WarehouseTableRef): string {
  return `SELECT document_id
     FROM ${chunksTable(tables)}
    WHERE source_type IN ('abbyy_ocr', 'docai_ocr')
      AND LOWER(chunk_text) LIKE @qLike
    GROUP BY document_id
    LIMIT ${OCR_HIT_DOCUMENT_ID_LIMIT}`;
}

/** OCR snippets for a page of already-selected documents. */
export function buildOcrSnippetSql(tables: WarehouseTableRef): string {
  return `SELECT document_id, ANY_VALUE(chunk_text) AS hit_text
     FROM ${chunksTable(tables)}
    WHERE source_type IN ('abbyy_ocr', 'docai_ocr')
      AND document_id IN UNNEST(@documentIds)
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
         SELECT r.*,
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
         SELECT r.*,
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
  return /jfk_text_chunks/i.test(sql) || /chunk_text/i.test(sql);
}

export function sqlSelectsStarFromRecords(sql: string): boolean {
  return /SELECT\s+r\.\*/i.test(sql);
}
