import { describe, expect, it } from "vitest";
import {
  buildCorpusAgencyFacetSql,
  buildCorpusTopicFacetSql,
  buildDocumentPageChunksSql,
  buildDocumentSearchSql,
  buildFilterOnlyDocumentsSql,
  buildIdentifierSearchSql,
  buildMentionSearchSql,
  buildOcrHitDocumentIdSql,
  buildOcrSnippetSql,
  buildQueryMatchedDocumentsSql,
  buildTopicMembershipSql,
  literalDocumentIds,
  OCR_HIT_DOCUMENT_ID_LIMIT,
  SEARCH_DOCUMENT_COLUMNS,
  sqlDocumentIdInList,
  sqlHasSelectiveDocumentIdFilter,
  sqlLikeScansOcrWithoutDocumentIdFilter,
  sqlMentionsOcrChunks,
  sqlScansLegacyTextChunks,
  sqlSelectsReleaseHistory,
  sqlSelectsStarFromRecords,
  sqlUsesOcrTokenTable,
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

  it("restricts mention search to literal token-hit document ids", () => {
    const sql = buildMentionSearchSql(
      tables,
      "LOWER(c.chunk_text) LIKE @qLike",
      ["104-10004-10143", "124-10158-10023"],
      50,
      0,
    );
    expect(sql).toContain("search_ocr_chunks");
    expect(sql).toContain("'104-10004-10143'");
    expect(sql).toContain("'124-10158-10023'");
    expect(sql).not.toMatch(/UNNEST\s*\(\s*@/i);
    expect(sqlUsesOcrTokenTable(sql)).toBe(false);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sqlLikeScansOcrWithoutDocumentIdFilter(sql)).toBe(false);
    expect(sqlHasSelectiveDocumentIdFilter(sql)).toBe(true);
  });

  it("does not touch search_ocr_chunks when mention has no document ids", () => {
    const sql = buildMentionSearchSql(
      tables,
      "LOWER(c.chunk_text) LIKE @qLike",
      [],
      50,
      0,
    );
    expect(sql).not.toContain("search_ocr_chunks");
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sqlLikeScansOcrWithoutDocumentIdFilter(sql)).toBe(false);
  });

  it("inlines result-page document ids so snippet LIKE can prune the cluster", () => {
    const sql = buildOcrSnippetSql(tables, ["104-10004-10143", "124-10158-10023"]);
    expect(sql).toContain("search_ocr_chunks");
    expect(sql).toContain("'104-10004-10143'");
    expect(sql).not.toMatch(/UNNEST\s*\(\s*@documentIds/i);
    expect(sql).not.toMatch(/jfk_text_chunks/i);
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sqlLikeScansOcrWithoutDocumentIdFilter(sql)).toBe(false);
    expect(sqlHasSelectiveDocumentIdFilter(sql)).toBe(true);
  });

  it("does not LIKE-scan search_ocr_chunks when the snippet page is empty", () => {
    const sql = buildOcrSnippetSql(tables, []);
    expect(sql).not.toContain("search_ocr_chunks");
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
    expect(sqlLikeScansOcrWithoutDocumentIdFilter(sql)).toBe(false);
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

  it("reads document-page OCR from the clustered projection by document_id", () => {
    const sql = buildDocumentPageChunksSql(tables);
    expect(sql).toContain("search_ocr_chunks");
    expect(sql).toContain("document_id = @id");
    expect(sqlScansLegacyTextChunks(sql)).toBe(false);
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
