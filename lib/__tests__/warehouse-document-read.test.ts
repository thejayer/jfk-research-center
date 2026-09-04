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
    expect(fetchDocument).toContain("buildDocumentReadCoreSql");
    expect(fetchDocument).toContain("loadDocumentReadBundle");
    expect(fetchDocument).toContain("isDocumentReadBundleUnavailable");
    expect(fetchDocument).toContain("markDocumentReadBundleUnavailable");
    expect(fetchDocument).not.toContain("isOcrPageMetaTableUnavailable");
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
    expect(load).toContain("fetchDocumentOcrFirstPageFromMeta");
    expect(load).not.toMatch(/WITH this_entities AS/);
    expect(load).not.toMatch(/SELECT entity_id, confidence, match_source/);
  });
});
