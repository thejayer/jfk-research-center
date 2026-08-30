import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const warehouseSource = readFileSync(
  new URL("../warehouse.ts", import.meta.url),
  "utf8",
);

describe("document display titles in the warehouse adapter", () => {
  it("derives card titles from fields already on the record row", () => {
    const start = warehouseSource.indexOf("function rowToCard");
    const end = warehouseSource.indexOf("function rowToDetail");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const rowToCard = warehouseSource.slice(start, end);
    expect(rowToCard).toContain("documentDisplayFields");
    expect(rowToCard).toContain("sourceTitle");
    expect(rowToCard).toMatch(/^\s*title,$/m);
    expect(rowToCard).not.toMatch(/^\s*title:\s*r\.title/m);
  });

  it("does not scan OCR bodies to invent a title", () => {
    const start = warehouseSource.indexOf("function rowToCard");
    const end = warehouseSource.indexOf("function rowToDetail");
    const rowToCard = warehouseSource.slice(start, end);
    expect(rowToCard).not.toMatch(/search_ocr_chunks/);
    expect(rowToCard).not.toMatch(/jfk_text_chunks/);
    expect(rowToCard).not.toMatch(/EXISTS/);
  });

  it("uses the same helper for mention and semantic document titles", () => {
    expect(warehouseSource).toContain("function recordDisplayTitle");
    expect(warehouseSource.match(/recordDisplayTitle\(/g)?.length).toBeGreaterThan(4);
  });
});
