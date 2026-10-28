import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const warehouseSource = readFileSync(
  new URL("../warehouse.ts", import.meta.url),
  "utf8",
);

describe("document read warehouse path", () => {
  it("caches public document reads and loads metadata in one bundle job", () => {
    const start = warehouseSource.indexOf("export async function fetchDocument");
    const end = warehouseSource.indexOf("const DOCUMENT_SITEMAP_TTL_MS");
    const fetchDocument = warehouseSource.slice(start, end);

    expect(fetchDocument).toContain("withDocumentCache");
    expect(fetchDocument).toContain("documentCacheKey");
    expect(fetchDocument).toContain("buildDocumentReadBundleSql");
    expect(fetchDocument).toContain("loadDocumentReadBundle");
    expect(fetchDocument).toContain("loadDocumentEntityGraph");
    expect(fetchDocument).toContain("loadDocumentTopicMap");
    expect(fetchDocument).toContain("relatedDocumentIdsFor");
    expect(fetchDocument).toContain("DOCUMENT_READ_INDEX_TTL_MS");
    expect(fetchDocument).toContain("DOCUMENT_ENTITY_MAP_MAX_ROWS");
    expect(fetchDocument).toContain("documentReadIndexScanLimit");
    expect(fetchDocument).toContain("readTtlPromiseCache");
    expect(fetchDocument).toContain("buildDocumentEntityFallbackSql");
    expect(fetchDocument).toContain("over_cap");
    expect(fetchDocument).toContain("using per-document fallback");
    expect(fetchDocument).not.toContain("buildDocumentEntityGraph([])");
    expect(fetchDocument).not.toContain("isDocumentReadBundleUnavailable");
    expect(fetchDocument).not.toContain("markDocumentReadBundleUnavailable");
    expect(fetchDocument).not.toMatch(/SELECT \*\s+FROM `\$\{PROJECT\}.*jfk_records`/);
    expect(fetchDocument).not.toMatch(/SELECT r\.\*/);
    expect(fetchDocument).not.toMatch(/search_ocr_chunks/);
    expect(fetchDocument).not.toMatch(/chunk_embeddings/);
    expect(fetchDocument).not.toMatch(/jfk_text_chunks/);
  });

  it("does not fan the former six standalone document jobs back out", () => {
    const start = warehouseSource.indexOf("async function loadWarehouseDocument");
    const end = warehouseSource.indexOf("const DOCUMENT_SITEMAP_TTL_MS");
    const load = warehouseSource.slice(start, end);
    expect(load).toContain("loadDocumentReadBundle");
    expect(load).toContain("fetchDocumentOcrFirstPage");
    expect(load).toContain("resolveDocumentEntityRows");
    expect(load).toContain("loadDocumentEntityFallback");
    expect(load).toContain("fetchDocumentTopics");
    expect(load).not.toMatch(/WITH this_entities AS/);
    expect(load).not.toMatch(/SELECT entity_id, confidence, match_source/);
  });

  it("caches corpus manifest and case timeline reads with a short TTL", () => {
    expect(warehouseSource).toContain("CORPUS_MANIFEST_TTL_MS = 60_000");
    expect(warehouseSource).toContain("CASE_TIMELINE_TTL_MS = 60_000");
    expect(warehouseSource).toContain("loadWarehouseCorpusManifest");
    expect(warehouseSource).toContain("loadWarehouseCaseTimeline");
    expect(warehouseSource).toMatch(
      /readTtlPromiseCache\(corpusManifestCache\)/,
    );
    expect(warehouseSource).toMatch(/readTtlPromiseCache\(caseTimelineCache\)/);
  });

  it("caches the home payload for 10 minutes after the in-process SSR move", () => {
    expect(warehouseSource).toContain("HOME_TTL_MS = 10 * 60_000");
    expect(warehouseSource).toContain("fetchHomeUncached");
    expect(warehouseSource).toMatch(/readTtlPromiseCache\(homeCache\)/);
  });

  it("does not cache an empty entity graph when the thin-table index is over cap", () => {
    const start = warehouseSource.indexOf("async function loadDocumentEntityGraph");
    const end = warehouseSource.indexOf("async function loadDocumentTopicMap");
    const loadGraph = warehouseSource.slice(start, end);
    expect(loadGraph).toContain('kind: "over_cap"');
    expect(loadGraph).toContain("using per-document fallback");
    expect(loadGraph).not.toContain("buildDocumentEntityGraph([])");
    expect(loadGraph).toContain("documentReadIndexScanLimit(DOCUMENT_ENTITY_MAP_MAX_ROWS)");
  });
});
