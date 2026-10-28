import { describe, expect, it } from "vitest";
import {
  RELATED_DOCUMENT_LIMIT,
  buildDocumentEntityGraph,
  mapRowsForDocument,
  relatedDocumentIdsFor,
  sortRelatedRows,
} from "../document-read-hydrate";

const rows = [
  {
    document_id: "doc-a",
    entity_id: "oswald",
    confidence: "high",
    match_source: "title",
  },
  {
    document_id: "doc-a",
    entity_id: "cia",
    confidence: "medium",
    match_source: "description",
  },
  {
    document_id: "doc-b",
    entity_id: "oswald",
    confidence: "low",
    match_source: "ocr",
  },
  {
    document_id: "doc-c",
    entity_id: "oswald",
    confidence: "low",
    match_source: "ocr",
  },
  {
    document_id: "doc-c",
    entity_id: "cia",
    confidence: "high",
    match_source: "title",
  },
  {
    document_id: "doc-d",
    entity_id: "ruby",
    confidence: "low",
    match_source: "ocr",
  },
];

describe("document read hydrate", () => {
  it("returns map rows for one document", () => {
    const graph = buildDocumentEntityGraph(rows);
    expect(mapRowsForDocument(graph, "doc-a")).toEqual([
      { entity_id: "oswald", confidence: "high", match_source: "title" },
      { entity_id: "cia", confidence: "medium", match_source: "description" },
    ]);
    expect(mapRowsForDocument(graph, "missing")).toEqual([]);
  });

  it("ranks related documents by shared entities then id", () => {
    const graph = buildDocumentEntityGraph(rows);
    expect(relatedDocumentIdsFor(graph, "doc-a")).toEqual([
      { document_id: "doc-c", shared: 2 },
      { document_id: "doc-b", shared: 1 },
    ]);
    expect(relatedDocumentIdsFor(graph, "doc-d")).toEqual([]);
  });

  it("caps related documents at six", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      document_id: `other-${String(index).padStart(2, "0")}`,
      entity_id: "oswald",
      confidence: "low",
      match_source: "ocr",
    }));
    const graph = buildDocumentEntityGraph([
      {
        document_id: "doc-a",
        entity_id: "oswald",
        confidence: "high",
        match_source: "title",
      },
      ...many,
    ]);
    const related = relatedDocumentIdsFor(graph, "doc-a");
    expect(related).toHaveLength(RELATED_DOCUMENT_LIMIT);
    expect(related.map((item) => item.document_id)).toEqual([
      "other-00",
      "other-01",
      "other-02",
      "other-03",
      "other-04",
      "other-05",
    ]);
  });

  it("reorders related record rows to match shared rank", () => {
    const graph = buildDocumentEntityGraph(rows);
    const relatedIds = relatedDocumentIdsFor(graph, "doc-a");
    expect(
      sortRelatedRows(
        [{ document_id: "doc-b" }, { document_id: "doc-c" }],
        relatedIds,
      ).map((row) => row.document_id),
    ).toEqual(["doc-c", "doc-b"]);
  });
});
