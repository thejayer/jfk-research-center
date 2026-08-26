import { describe, expect, it } from "vitest";
import {
  buildCorpusAgencyFacetSql,
  buildCorpusTopicFacetSql,
  buildDocumentSearchSql,
  buildFilterOnlyDocumentsSql,
  buildOcrHitDocumentIdSql,
  buildQueryMatchedDocumentsSql,
  buildTopicMembershipSql,
  OCR_HIT_DOCUMENT_ID_LIMIT,
  sqlMentionsOcrChunks,
  sqlSelectsStarFromRecords,
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
  it("keeps document search off the OCR chunk table", () => {
    const sql = buildDocumentSearchSql(tables, "WHERE match_confidence IS NOT NULL", 50, 0);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sql).toContain("UNNEST(@ocrHitIds)");
    expect(sqlSelectsStarFromRecords(sql)).toBe(true);
  });

  it("selects only document ids from OCR, not every matching chunk body", () => {
    const sql = buildOcrHitDocumentIdSql(tables);
    expect(sqlMentionsOcrChunks(sql)).toBe(true);
    expect(sql).toMatch(/SELECT\s+document_id/i);
    expect(sql).not.toMatch(/ANY_VALUE\(chunk_text\)/i);
  });

  it("bounds OCR hit document ids well above current corpus coverage", () => {
    expect(OCR_HIT_DOCUMENT_ID_LIMIT).toBeGreaterThan(2165);
    const sql = buildOcrHitDocumentIdSql(tables);
    expect(sql).toContain(`LIMIT ${OCR_HIT_DOCUMENT_ID_LIMIT}`);
  });

  it("scores query-scoped facet documents without scanning OCR text", () => {
    const sql = buildQueryMatchedDocumentsSql(tables);
    expect(sqlMentionsOcrChunks(sql)).toBe(false);
    expect(sql).toContain("UNNEST(@ocrHitIds)");
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
