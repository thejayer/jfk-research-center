import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  OCR_PAGE_META_CACHE_MAX,
  OcrPageMetaCache,
  isOcrPageMetaTableUnavailable,
  markOcrPageMetaTableUnavailable,
  resetOcrPageMetaCacheForTests,
} from "../ocr-page-meta-cache";

const warehouseSource = readFileSync(
  new URL("../warehouse.ts", import.meta.url),
  "utf8",
);

describe("document reader warehouse path", () => {
  it("does not select chunk_text from fat OCR tables", () => {
    const start = warehouseSource.indexOf("async function fetchDocumentOcrPageMeta");
    const end = warehouseSource.indexOf("async function loadEntityMembership");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const documentOcr = warehouseSource.slice(start, end);

    expect(documentOcr).toContain("buildDocumentPageMetaSql");
    expect(documentOcr).toContain("buildDocumentOnePageSql");
    expect(documentOcr).not.toMatch(/search_ocr_chunks/);
    expect(documentOcr).not.toMatch(/jfk_text_chunks/);
    expect(documentOcr).not.toMatch(/search_ocr_card_excerpts/);
    expect(documentOcr).not.toMatch(/falling back to jfk_text_chunks/);
  });

  it("fetchDocument loads the first cheap page instead of LIMIT 12 fat chunks", () => {
    const start = warehouseSource.indexOf("export async function fetchDocument");
    const end = warehouseSource.indexOf("const DOCUMENT_SITEMAP_TTL_MS");
    const fetchDocument = warehouseSource.slice(start, end);
    expect(fetchDocument).toContain("withDocumentCache");
    expect(fetchDocument).toContain("documentCacheKey");
    expect(fetchDocument).toContain("buildDocumentReadBundleSql");
    expect(fetchDocument).toContain("fetchDocumentOcrFirstPage");
    expect(fetchDocument).toContain("options.chunkOrder");
    expect(fetchDocument).not.toMatch(/fetchDocumentOcrChunks/);
    expect(fetchDocument).not.toMatch(/search_ocr_chunks/);
    expect(fetchDocument).not.toMatch(/jfk_text_chunks/);
    expect(fetchDocument).toMatch(/source: "ocr"/);
    expect(fetchDocument).not.toMatch(/source: m\.match_source/);
  });

  it("loads requested and last OCR pages in one partitioned job", () => {
    const start = warehouseSource.indexOf("async function fetchDocumentOcrPageRows");
    const end = warehouseSource.indexOf("async function fetchDocumentOcrFirstPage(");
    const pageRows = warehouseSource.slice(start, end);
    expect(pageRows).toContain("buildDocumentPagesSql");
    expect(pageRows).toContain("chunkOrders");
    expect(pageRows).not.toMatch(/search_ocr_chunks/);
    expect(pageRows).not.toMatch(/jfk_text_chunks/);
  });

  it("caches only positive page-meta hits through the bounded helper", () => {
    const start = warehouseSource.indexOf("async function fetchDocumentOcrPageMeta");
    const end = warehouseSource.indexOf("async function fetchDocumentOcrPageRow");
    const documentOcr = warehouseSource.slice(start, end);
    expect(documentOcr).toContain("ocrPageMetaCache.setPositive");
    expect(documentOcr).not.toMatch(/ocrPageMetaCache\.set\(/);
    expect(documentOcr).toContain("markOcrPageMetaTableUnavailable");
    expect(documentOcr).toMatch(/if \(!meta\) return \{ kind: "none" \}/);
  });
});

function sampleMeta(id: string) {
  return {
    document_id: id,
    chunk_count: 2,
    first_chunk_order: 0,
    last_chunk_order: 1,
    doc_shard: 3,
  };
}

describe("ocr page-meta cache bounds", () => {
  afterEach(() => {
    resetOcrPageMetaCacheForTests();
  });

  it("evicts the oldest entry when over the size cap", () => {
    const cache = new OcrPageMetaCache(2, 60_000);
    cache.setPositive("a", sampleMeta("a"), 1_000);
    cache.setPositive("b", sampleMeta("b"), 1_000);
    cache.setPositive("c", sampleMeta("c"), 1_000);
    expect(cache.size).toBe(2);
    expect(cache.get("a", 1_000)).toBeUndefined();
    expect(cache.get("b", 1_000)?.document_id).toBe("b");
    expect(cache.get("c", 1_000)?.document_id).toBe("c");
  });

  it("does not keep expired hits", () => {
    const cache = new OcrPageMetaCache(10, 100);
    cache.setPositive("a", sampleMeta("a"), 1_000);
    expect(cache.get("a", 1_050)).toEqual(sampleMeta("a"));
    expect(cache.get("a", 1_100)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("touches LRU order on get so the hot key is not evicted first", () => {
    const cache = new OcrPageMetaCache(2, 60_000);
    cache.setPositive("a", sampleMeta("a"), 1_000);
    cache.setPositive("b", sampleMeta("b"), 1_000);
    expect(cache.get("a", 1_000)?.document_id).toBe("a");
    cache.setPositive("c", sampleMeta("c"), 1_000);
    expect(cache.get("b", 1_000)).toBeUndefined();
    expect(cache.get("a", 1_000)?.document_id).toBe("a");
  });

  it("keeps the production cap at 2000 and has no negative-entry API", () => {
    expect(OCR_PAGE_META_CACHE_MAX).toBe(2000);
    expect(typeof OcrPageMetaCache.prototype.setPositive).toBe("function");
    expect(
      Object.prototype.hasOwnProperty.call(OcrPageMetaCache.prototype, "setNegative"),
    ).toBe(false);
  });

  it("records table unavailability once, not per document id", () => {
    expect(isOcrPageMetaTableUnavailable(1_000)).toBe(false);
    markOcrPageMetaTableUnavailable(1_000);
    expect(isOcrPageMetaTableUnavailable(1_000)).toBe(true);
    expect(isOcrPageMetaTableUnavailable(1_000 + 5 * 60 * 1000)).toBe(false);
  });
});
