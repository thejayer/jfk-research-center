/**
 * BigQuery SQL builders for warehouse-backed search.
 *
 * Search jobs must stay under JFK_BQ_MAX_BYTES_BILLED (256 MiB in production).
 * Document search must not scan jfk_text_chunks or search_ocr_chunks bodies.
 * OCR document IDs come from the token table (sql/33). Card snippets and
 * mention excerpts come from search_ocr_card_excerpts (sql/34). Document
 * reader pages come from search_ocr_page_meta + search_ocr_pages (sql/35).
 * Document topic chips come from document_topic_map (sql/36), not EXISTS
 * over jfk_mvp.*_docs. Record jobs select only the card columns — never
 * r.* / release_history.
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

export function ocrCardExcerptsTable({
  project,
  curatedDataset,
}: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.search_ocr_card_excerpts\``;
}

export function ocrPageMetaTable({
  project,
  curatedDataset,
}: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.search_ocr_page_meta\``;
}

export function ocrPagesTable({
  project,
  curatedDataset,
}: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.search_ocr_pages\``;
}

export function documentTopicMapTable({
  project,
  curatedDataset,
}: WarehouseTableRef): string {
  return `\`${project}.${curatedDataset}.document_topic_map\``;
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

/**
 * NAID / RIF-shaped ids we are willing to interpolate as BigQuery
 * string literals. `IN UNNEST(@documentIds)` does not cluster-prune
 * `search_ocr_chunks`; a literal `IN ('104-…', …)` does.
 */
export const DOCUMENT_ID_LITERAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function literalDocumentIds(documentIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of documentIds) {
    const id = raw.trim();
    if (!DOCUMENT_ID_LITERAL_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= OCR_HIT_DOCUMENT_ID_LIMIT) break;
  }
  return out;
}

export function sqlDocumentIdInList(
  column: string,
  documentIds: readonly string[],
): string {
  const ids = literalDocumentIds(documentIds);
  if (ids.length === 0) return "FALSE";
  return `${column} IN (${ids.map((id) => `'${id}'`).join(", ")})`;
}

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
export function buildOcrSnippetSql(
  tables: WarehouseTableRef,
  documentIds: readonly string[] = [],
): string {
  const idFilter = sqlDocumentIdInList("document_id", documentIds);
  if (idFilter === "FALSE") {
    return `SELECT CAST(NULL AS STRING) AS document_id, CAST(NULL AS STRING) AS hit_text
     WHERE FALSE`;
  }
  return `SELECT document_id, excerpt AS hit_text
     FROM ${ocrCardExcerptsTable(tables)}
    WHERE ${idFilter}`;
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
  documentIds: readonly string[],
  limit: number,
  offset: number,
): string {
  const idFilter = sqlDocumentIdInList("e.document_id", documentIds);
  if (idFilter === "FALSE") {
    return `SELECT CAST(NULL AS STRING) AS document_id,
              CAST(NULL AS STRING) AS naid,
              CAST(NULL AS STRING) AS title,
              CAST(NULL AS STRING) AS agency,
              CAST(NULL AS STRING) AS description,
              CAST(NULL AS STRING) AS document_type,
              CAST(NULL AS STRING) AS chunk_id,
              CAST(NULL AS INT64) AS chunk_order,
              CAST(NULL AS STRING) AS chunk_text,
              CAST(NULL AS STRING) AS page_label,
              CAST(0 AS INT64) AS total_count
         WHERE FALSE`;
  }
  const extraWhere = whereSql.trim() ? `AND ${whereSql}` : "";
  return `SELECT r.document_id, r.naid, r.title,
              r.agency, r.description, r.document_type,
              e.chunk_id, e.chunk_order, e.excerpt AS chunk_text, e.page_label,
              COUNT(*) OVER() AS total_count
         FROM ${ocrCardExcerptsTable(tables)} e
         JOIN ${recordsTable(tables)} r
           USING (document_id)
        WHERE ${idFilter}
          ${extraWhere}
        ORDER BY e.document_id, e.chunk_order
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
}

export function buildMentionSearchCountSql(
  tables: WarehouseTableRef,
  whereSql: string,
  documentIds: readonly string[],
): string {
  const idFilter = sqlDocumentIdInList("e.document_id", documentIds);
  if (idFilter === "FALSE") {
    return `SELECT CAST(0 AS INT64) AS n WHERE FALSE`;
  }
  const extraWhere = whereSql.trim() ? `AND ${whereSql}` : "";
  return `SELECT COUNT(*) AS n
         FROM ${ocrCardExcerptsTable(tables)} e
         JOIN ${recordsTable(tables)} r
           USING (document_id)
        WHERE ${idFilter}
          ${extraWhere}`;
}

/**
 * Thin per-document OCR bounds. No chunk_text — this job must stay at
 * the on-demand 10 MiB floor even if the table is fully scanned.
 */
export function buildDocumentPageMetaSql(tables: WarehouseTableRef): string {
  return `SELECT document_id, chunk_count, first_chunk_order, last_chunk_order, doc_shard
         FROM ${ocrPageMetaTable(tables)}
        WHERE document_id = @id
        LIMIT 1`;
}

/**
 * One OCR page. `doc_shard = @shard` is required so BigQuery can prune
 * the RANGE-partitioned table. Do not compute the shard only from
 * FARM_FINGERPRINT(@id) in this WHERE — that does not reliably prune.
 */
export function buildDocumentOnePageSql(tables: WarehouseTableRef): string {
  return `SELECT chunk_id, chunk_order, chunk_text, page_label, source_type,
              prev_chunk_order, next_chunk_order
         FROM ${ocrPagesTable(tables)}
        WHERE doc_shard = @shard
          AND document_id = @id
          AND chunk_order = @chunkOrder
        LIMIT 1`;
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

/**
 * Topic slugs for one document. Must not EXISTS-scan jfk_mvp.*_docs.
 */
export function buildDocumentTopicSlugsSql(tables: WarehouseTableRef): string {
  return `SELECT topic_slug AS slug
         FROM ${documentTopicMapTable(tables)}
        WHERE document_id = @id`;
}

/**
 * Per-slug document counts from the thin map. A full scan of ~47k
 * (document_id, slug) rows is the on-demand 10 MiB floor — not the
 * 110 MiB EXISTS/COUNT over full-width jfk_mvp.*_docs copies.
 */
export function buildDocumentTopicCountSql(tables: WarehouseTableRef): string {
  return `SELECT topic_slug AS slug, COUNT(*) AS n
         FROM ${documentTopicMapTable(tables)}
        GROUP BY topic_slug`;
}

export function sortTopicSlugsByDisplayOrder(
  slugs: readonly string[],
  displayOrder: readonly string[],
): string[] {
  return [...slugs].sort((a, b) => {
    const ai = displayOrder.indexOf(a);
    const bi = displayOrder.indexOf(b);
    return (ai === -1 ? displayOrder.length : ai) -
      (bi === -1 ? displayOrder.length : bi);
  });
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

export function sqlUsesCardExcerpts(sql: string): boolean {
  return /search_ocr_card_excerpts/i.test(sql);
}

export function sqlScansLegacyTextChunks(sql: string): boolean {
  return /jfk_text_chunks/i.test(sql);
}

export function sqlUsesOcrTokenTable(sql: string): boolean {
  return /search_ocr_document_tokens/i.test(sql);
}

export function sqlUsesPagedOcrTables(sql: string): boolean {
  return /search_ocr_pages/i.test(sql) || /search_ocr_page_meta/i.test(sql);
}

/** True when a page-body job can prune search_ocr_pages by shard. */
export function sqlHasOcrPagePartitionFilter(sql: string): boolean {
  return /doc_shard\s*=\s*@shard\b/i.test(sql);
}

export function sqlUsesDocumentTopicMap(sql: string): boolean {
  return /document_topic_map/i.test(sql);
}

/** True when a job EXISTS-scans full-width jfk_mvp topic copies. */
export function sqlExistsScansMvpTopicDocs(sql: string): boolean {
  return /EXISTS\s*\(/i.test(sql) && /jfk_mvp\.\w+_docs/i.test(sql);
}

export function sqlSelectsStarFromRecords(sql: string): boolean {
  return /SELECT\s+r\.\*/i.test(sql);
}

export function sqlSelectsReleaseHistory(sql: string): boolean {
  return /release_history/i.test(sql);
}

/** True when a clustering-column filter is a literal IN list or equality. */
export function sqlHasSelectiveDocumentIdFilter(sql: string): boolean {
  return (
    /document_id\s+IN\s*\(\s*'[^']+'/i.test(sql) ||
    /document_id\s*=\s*@id\b/i.test(sql) ||
    /document_id\s*=\s*'[^']+'/i.test(sql)
  );
}

/**
 * True when a query LIKEs OCR text without a pruneable document_id
 * predicate. `IN UNNEST(@…)` and `IN (SELECT …)` do not count — those
 * are the live 128 MiB leak on search_ocr_chunks.
 */
export function sqlLikeScansOcrWithoutDocumentIdFilter(sql: string): boolean {
  if (!/chunk_text/i.test(sql) || !/\bLIKE\b/i.test(sql)) return false;
  if (/UNNEST\s*\(\s*@/i.test(sql)) return true;
  if (/document_id\s+IN\s*\(\s*SELECT\b/i.test(sql)) return true;
  return !sqlHasSelectiveDocumentIdFilter(sql);
}
