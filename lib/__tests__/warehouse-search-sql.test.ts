import { describe, expect, it } from "vitest";
import {
  buildCorpusAgencyFacetSql,
  buildCorpusTopicFacetSql,
  buildDocumentOnePageSql,
  buildDocumentPageMetaSql,
  buildDocumentPagesSql,
  buildDocumentReadBundleSql,
  buildDocumentReadCoreSql,
  buildDocumentSearchSql,
  buildFilterOnlyDocumentsSql,
  buildIdentifierSearchSql,
  buildMentionSearchSql,
  buildOcrHitDocumentIdSql,
  buildOcrSnippetSql,
  buildQueryMatchedDocumentsSql,
  buildDocumentTopicCountSql,
  buildDocumentTopicSlugsSql,
  sortTopicSlugsByDisplayOrder,
  buildTopicMembershipSql,
  literalDocumentIds,
  OCR_HIT_DOCUMENT_ID_LIMIT,
  SEARCH_DOCUMENT_COLUMNS,
  sqlDocumentIdInList,
  sqlHasSelectiveDocumentIdFilter,
  sqlLikeScansOcrWithoutDocumentIdFilter,
  sqlMentionsOcrChunks,
  sqlScansLegacyTextChunks,
  sqlUsesCardExcerpts,
  sqlSelectsReleaseHistory,
  sqlSelectsStarFromRecords,
  sqlUsesOcrTokenTable,
  sqlUsesDocumentTopicMap,
  sqlExistsScansMvpTopicDocs,
  sqlUsesPagedOcrTables,
  sqlHasOcrPagePartitionFilter,
} from "../warehouse-search-sql";

const tables = {
  project: "jfk-vault",
  curatedDataset: "jfk_curated",
  mvpDataset: "jfk_mvp",
};

const topics = [
  { slug: "cia", table: "cia_docs" },
  { slug: "fbi", table: "fbi_docs" },
];

describe("warehouse search SQL cost envelope", () => {
  it("keeps document search off OCR chunk tables and off SELECT r.*", () => {
    const sql = buildDocumentSearchSql(tables, "WHERE match_confidence IS NOT NULL", 50, 0);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sqlSelectsStarFromRecords(sql)).toBe(false);
    expect(sqlSelectsReleaseHistory(sql)).toBe(false);
    expect(sql).toContain("UNNEST(@ocrHitIds)");
    for (const column of SEARCH_DOCUMENT_COLUMNS) {
      expect(sql).toContain(`r.${column}`);
    }
  });

  it("loads OCR document ids from the clustered token table, not chunk_text", () => {
    const sql = buildOcrHitDocumentIdSql(tables, 1);
    expect(sqlUsesOcrTokenTable(sql)).toBe(true);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sql).toContain("token >= @ocrTok0 AND token < @ocrTok0End");
    expect(sql).not.toMatch(/LIKE/i);
    expect(sql).toContain(`LIMIT ${OCR_HIT_DOCUMENT_ID_LIMIT}`);
  });

  it("intersects multi-token OCR lookups so each range can prune a cluster", () => {
    const sql = buildOcrHitDocumentIdSql(tables, 2);
    expect(sql).toContain("INTERSECT DISTINCT");
    expect(sql).toContain("@ocrTok1");
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
  });

  it("bounds OCR hit document ids well above current corpus coverage", () => {
    expect(OCR_HIT_DOCUMENT_ID_LIMIT).toBeGreaterThan(2165);
  });

  it("loads mention excerpts from the thin card table, never fat OCR bodies", () => {
    const sql = buildMentionSearchSql(
      tables,
      "r.agency IN UNNEST(@agencies)",
      ["104-10004-10143", "124-10158-10023"],
      50,
      0,
    );
    expect(sqlUsesCardExcerpts(sql)).toBe(true);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sql).not.toMatch(/\bLIKE\b/i);
    expect(sql).toContain("'104-10004-10143'");
    expect(sqlHasSelectiveDocumentIdFilter(sql)).toBe(true);
  });

  it("does not touch fat OCR tables when mention has no document ids", () => {
    const sql = buildMentionSearchSql(tables, "", [], 50, 0);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlUsesCardExcerpts(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
  });

  it("loads result-page snippets from the thin card table, never fat OCR bodies", () => {
    const sql = buildOcrSnippetSql(tables, ["104-10004-10143", "124-10158-10023"]);
    expect(sqlUsesCardExcerpts(sql)).toBe(true);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sql).not.toMatch(/\bLIKE\b/i);
    expect(sql).toContain("'104-10004-10143'");
  });

  it("does not read the thin or fat OCR tables when the snippet page is empty", () => {
    const sql = buildOcrSnippetSql(tables, []);
    expect(sqlUsesCardExcerpts(sql)).toBe(false);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
  });

  it("treats UNNEST and subquery document_id filters as non-selective for OCR LIKE", () => {
    expect(
      sqlLikeScansOcrWithoutDocumentIdFilter(
        "SELECT chunk_text FROM search_ocr_chunks WHERE document_id IN UNNEST(@documentIds) AND LOWER(chunk_text) LIKE @qLike",
      ),
    ).toBe(true);
    expect(
      sqlLikeScansOcrWithoutDocumentIdFilter(
        "SELECT chunk_text FROM search_ocr_chunks WHERE document_id IN (SELECT document_id FROM tokens) AND LOWER(chunk_text) LIKE @qLike",
      ),
    ).toBe(true);
    expect(
      sqlLikeScansOcrWithoutDocumentIdFilter(
        "SELECT chunk_text FROM search_ocr_chunks WHERE document_id IN ('104-10004-10143') AND LOWER(chunk_text) LIKE @qLike",
      ),
    ).toBe(false);
  });

  it("quotes only safe document id literals", () => {
    expect(literalDocumentIds(["104-10004-10143", "'; DROP TABLE x; --"])).toEqual([
      "104-10004-10143",
    ]);
    expect(sqlDocumentIdInList("document_id", [])).toBe("FALSE");
  });

  it("reads document OCR meta without touching fat chunk bodies", () => {
    const sql = buildDocumentPageMetaSql(tables);
    expect(sqlUsesPagedOcrTables(sql)).toBe(true);
    expect(sql).toContain("search_ocr_page_meta");
    expect(sql).not.toMatch(/chunk_text/i);
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
  });

  it("reads the first-page plus last-label pages in one partitioned job", () => {
    const sql = buildDocumentPagesSql(tables);
    expect(sqlUsesPagedOcrTables(sql)).toBe(true);
    expect(sqlHasOcrPagePartitionFilter(sql)).toBe(true);
    expect(sql).toContain("chunk_order IN UNNEST(@chunkOrders)");
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sql).not.toMatch(/FARM_FINGERPRINT/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
  });

  it("bundles document metadata into one job without fat OCR or MVP EXISTS", () => {
    const sql = buildDocumentReadBundleSql(tables);
    expect(sql).toContain("jfk_records");
    expect(sql).toContain("jfk_document_entity_map");
    expect(sqlUsesDocumentTopicMap(sql)).toBe(true);
    expect(sqlUsesPagedOcrTables(sql)).toBe(true);
    expect(sql).toContain("search_ocr_page_meta");
    expect(sql).not.toContain("search_ocr_pages");
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sql).not.toMatch(/chunk_embeddings/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlExistsScansMvpTopicDocs(sql)).toBe(false);
    expect(sqlSelectsStarFromRecords(sql)).toBe(false);
    expect(sql).toMatch(/document_id = @id/);
    expect(sql).toContain("AS related_rows");
    expect(sql).not.toMatch(/SELECT\s+r\.\*/);
    expect(sql).toContain("release_history");
    expect(sql).toContain("ORDER BY ri.shared DESC, rel.document_id");
    const relatedStart = sql.lastIndexOf(
      "ARRAY(SELECT AS STRUCT",
      sql.indexOf("AS related_rows"),
    );
    const relatedBlock = sql.slice(relatedStart, sql.indexOf("AS related_rows"));
    expect(relatedStart).toBeGreaterThan(-1);
    expect(relatedBlock).toContain("rel.document_id");
    expect(relatedBlock).not.toContain("release_history");
  });

  it("keeps topic_slugs as one ARRAY subquery, not a closed SELECT then FROM", () => {
    const sql = buildDocumentReadBundleSql(tables);
    // Regression for the PR 134 syntax error:
    // ARRAY(SELECT topic_slug) FROM … )  — BigQuery: Expected end of input but got ")"
    expect(sql).not.toMatch(/ARRAY\(SELECT topic_slug\)\s+FROM/i);
    expect(sql).toMatch(
      /ARRAY\(\s*SELECT topic_slug\s+FROM[\s\S]+document_topic_map[\s\S]+WHERE document_id = \(SELECT document_id FROM target\)\s*\)\s+AS topic_slugs/,
    );
    const coreSql = buildDocumentReadCoreSql(tables);
    expect(coreSql).not.toMatch(/ARRAY\(SELECT topic_slug\)\s+FROM/i);
  });

  it("de-correlates topic_slugs and ocr_meta from outer t.document_id", () => {
    const sql = buildDocumentReadBundleSql(tables);
    // BigQuery: "Correlated subqueries that reference other tables are not
    // supported unless they can be de-correlated, such as by transforming
    // them into an efficient JOIN." Outer `t.document_id` against
    // document_topic_map / search_ocr_page_meta fails; the scalar
    // `(SELECT document_id FROM target)` de-correlates and succeeds.
    const topicStart = sql.indexOf("ARRAY(SELECT topic_slug");
    const topicEnd = sql.indexOf("AS topic_slugs");
    const topicBlock = sql.slice(topicStart, topicEnd);
    expect(topicStart).toBeGreaterThan(-1);
    expect(topicBlock).toContain("document_id = (SELECT document_id FROM target)");
    expect(topicBlock).not.toContain("= t.document_id");

    const ocrStart = sql.indexOf("(SELECT AS STRUCT document_id, chunk_count");
    const ocrEnd = sql.indexOf("AS ocr_meta");
    const ocrBlock = sql.slice(ocrStart, ocrEnd);
    expect(ocrStart).toBeGreaterThan(-1);
    expect(ocrBlock).toContain("document_id = (SELECT document_id FROM target)");
    expect(ocrBlock).not.toContain("= t.document_id");

    expect(sql).not.toMatch(/document_id = t\.document_id/);

    const coreSql = buildDocumentReadCoreSql(tables);
    expect(coreSql).not.toContain("document_topic_map");
    expect(coreSql).not.toContain("search_ocr_page_meta");
    expect(coreSql).not.toMatch(/document_id = t\.document_id/);
  });

  it("falls back to a core bundle that omits optional thin tables", () => {
    const sql = buildDocumentReadCoreSql(tables);
    expect(sql).toContain("jfk_document_entity_map");
    expect(sqlUsesDocumentTopicMap(sql)).toBe(false);
    expect(sql).not.toContain("search_ocr_page_meta");
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlSelectsStarFromRecords(sql)).toBe(false);
    expect(sql).toContain("ORDER BY ri.shared DESC, rel.document_id");
  });

  it("reads one document OCR page from the partitioned table, never fat bodies", () => {
    const sql = buildDocumentOnePageSql(tables);
    expect(sqlUsesPagedOcrTables(sql)).toBe(true);
    expect(sqlHasOcrPagePartitionFilter(sql)).toBe(true);
    expect(sql).toContain("search_ocr_pages");
    expect(sql).toContain("doc_shard = @shard");
    expect(sql).toContain("chunk_order = @chunkOrder");
    expect(sql).not.toMatch(/search_ocr_chunks/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sql).not.toMatch(/FARM_FINGERPRINT/i);
  });

  it("keeps identifier search on slim record columns", () => {
    const sql = buildIdentifierSearchSql(
      tables,
      "r.document_id = @qNorm",
      50,
      0,
    );
    expect(sqlSelectsStarFromRecords(sql)).toBe(false);
    expect(sqlSelectsReleaseHistory(sql)).toBe(false);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
  });

  it("scores query-scoped facet documents without scanning OCR text", () => {
    const sql = buildQueryMatchedDocumentsSql(tables);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sql).toContain("UNNEST(@ocrHitIds)");
    expect(sqlSelectsStarFromRecords(sql)).toBe(false);
    expect(sql).toMatch(/SELECT r\.document_id/);
  });

  it("loads filter-only facet documents from record metadata without OCR", () => {
    const sql = buildFilterOnlyDocumentsSql(tables);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sql).not.toMatch(/LIKE/i);
    expect(sql).toContain("CAST(NULL AS STRING) AS match_confidence");
  });

  it("loads document-page topic slugs from the thin map, never EXISTS on MVP docs", () => {
    const sql = buildDocumentTopicSlugsSql(tables);
    expect(sqlUsesDocumentTopicMap(sql)).toBe(true);
    expect(sqlExistsScansMvpTopicDocs(sql)).toBe(false);
    expect(sql).not.toMatch(/jfk_mvp/i);
    expect(sql).not.toMatch(/\bEXISTS\b/i);
    expect(sql).toContain("document_id = @id");
  });

  it("counts topic chips from the thin map, never fat MVP tables", () => {
    const sql = buildDocumentTopicCountSql(tables);
    expect(sqlUsesDocumentTopicMap(sql)).toBe(true);
    expect(sql).toMatch(/GROUP BY topic_slug/);
    expect(sqlExistsScansMvpTopicDocs(sql)).toBe(false);
    expect(sql).not.toMatch(/jfk_mvp/i);
    expect(sql).not.toMatch(/\bEXISTS\b/i);
  });

  it("restores topic display order after an unordered map fetch", () => {
    expect(
      sortTopicSlugsByDisplayOrder(
        ["fbi", "warren-commission", "cia"],
        ["warren-commission", "hsca", "cia", "fbi"],
      ),
    ).toEqual(["warren-commission", "cia", "fbi"]);
  });

  it("treats the retired document topic EXISTS union as a fat scan", () => {
    expect(
      sqlExistsScansMvpTopicDocs(
        `SELECT 'cia' AS slug FROM (SELECT 1) WHERE EXISTS (
           SELECT 1 FROM \`jfk-vault.jfk_mvp.cia_docs\` WHERE document_id = @id)`,
      ),
    ).toBe(true);
    expect(sqlExistsScansMvpTopicDocs(buildDocumentTopicSlugsSql(tables))).toBe(
      false,
    );
  });

  it("loads topic membership as document_id + slug, not SELECT * from MVP copies", () => {
    const sql = buildTopicMembershipSql(tables, topics);
    expect(sql).toContain("SELECT document_id, 'cia' AS topic_slug");
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
  });

  it("uses cheap COUNT(*) corpus topic aggregates instead of exploding MVP rows", () => {
    const sql = buildCorpusTopicFacetSql(tables, topics);
    expect(sql).toMatch(/COUNT\(\*\)/);
    expect(sql).not.toMatch(/LOWER\(.*LIKE/i);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
  });

  it("aggregates corpus agencies from records metadata only", () => {
    const sql = buildCorpusAgencyFacetSql(tables);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sql).toContain("GROUP BY agency");
  });
});
