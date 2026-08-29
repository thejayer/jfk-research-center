import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(fetchDocument).toContain("fetchDocumentOcrFirstPage");
    expect(fetchDocument).not.toMatch(/fetchDocumentOcrChunks/);
    expect(fetchDocument).not.toMatch(/search_ocr_chunks/);
    expect(fetchDocument).not.toMatch(/jfk_text_chunks/);
  });
});
