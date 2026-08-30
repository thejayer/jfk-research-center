import { describe, expect, it } from "vitest";
import {
  archivalPageCount,
  displayDocumentTitle,
  documentReaderHref,
  documentSourceLinks,
  formatOcrReaderStatus,
  isGenericDocumentTitle,
  isPdfUrl,
  parseChunkParam,
  parseOcrJumpInput,
  parsePageLabelNumber,
  primaryDocumentAction,
} from "../document-reader";

describe("parseChunkParam", () => {
  it("accepts 0 as a real first-page chunk", () => {
    expect(parseChunkParam("0")).toBe(0);
    expect(parseChunkParam(["0"])).toBe(0);
  });

  it("rejects empty or non-integer values", () => {
    expect(parseChunkParam(undefined)).toBeNull();
    expect(parseChunkParam("")).toBeNull();
    expect(parseChunkParam("p. 2")).toBeNull();
    expect(parseChunkParam("1.5")).toBeNull();
  });
});

describe("parseOcrJumpInput", () => {
  it("reads a chunk number, including 0", () => {
    expect(parseOcrJumpInput("0")).toEqual({ kind: "chunk", order: 0 });
    expect(parseOcrJumpInput(" 6138 ")).toEqual({ kind: "chunk", order: 6138 });
  });

  it("treats archival page labels as unresolvable without a scan", () => {
    expect(parseOcrJumpInput("p. 500")).toEqual({
      kind: "page-label",
      label: "p. 500",
    });
    expect(parseOcrJumpInput("page 12")).toEqual({
      kind: "page-label",
      label: "p. 12",
    });
  });
});

describe("documentReaderHref", () => {
  it("writes a first-paint query plus hash", () => {
    expect(documentReaderHref("124-10190-10075", 0)).toBe(
      "/document/124-10190-10075?chunk=0#chunk-0",
    );
    expect(documentReaderHref("124-10190-10075", 40)).toBe(
      "/document/124-10190-10075?chunk=40#chunk-40",
    );
  });

  it("omits paging when no chunk is selected", () => {
    expect(documentReaderHref("124-10190-10075")).toBe(
      "/document/124-10190-10075",
    );
  });
});

describe("page label status copy", () => {
  it("formats a real-reader status from pageLabel plus honest totals", () => {
    expect(
      formatOcrReaderStatus({
        pageLabel: "p. 1",
        lastPageLabel: "p. 2119",
        chunkCount: 6138,
      }),
    ).toBe("Page 1 of ~2,119 · 6,138 OCR pages");
  });

  it("does not invent an archival total when the last label is missing", () => {
    expect(
      formatOcrReaderStatus({
        pageLabel: "p. 1",
        chunkCount: 12,
      }),
    ).toBe("p. 1 · 12 OCR pages");
  });

  it("derives an archival count from the last pageLabel when NARA pages is 0", () => {
    expect(
      archivalPageCount({ pageCount: 0, lastPageLabel: "p. 2119" }),
    ).toEqual({ count: 2119, estimated: true });
    expect(archivalPageCount({ pageCount: 14, lastPageLabel: "p. 2119" })).toEqual({
      count: 14,
      estimated: false,
    });
    expect(archivalPageCount({ pageCount: 0, lastPageLabel: null })).toBeNull();
  });

  it("parses archival numbers out of page labels", () => {
    expect(parsePageLabelNumber("p. 2119")).toBe(2119);
    expect(parsePageLabelNumber("Page 1")).toBe(1);
    expect(parsePageLabelNumber("cover sheet")).toBeNull();
  });
});

describe("document title and source actions", () => {
  it("replaces Untitled Record with an honest agency label", () => {
    expect(
      displayDocumentTitle({
        title: "Untitled Record",
        naid: "124-10190-10075",
        agency: "FBI",
        description: "BULKY ENC · Release: Redact",
      }),
    ).toBe("FBI bulky file");
    expect(isGenericDocumentTitle("Untitled Record")).toBe(true);
    expect(isGenericDocumentTitle("201 FILE OF PROTECTABLE SOURCE.")).toBe(
      false,
    );
  });

  it("labels a PDF as the scan, not the catalog", () => {
    const pdf =
      "https://www.archives.gov/files/research/jfk/releases/2022/docid-32989529.pdf";
    expect(isPdfUrl(pdf)).toBe(true);
    expect(
      documentSourceLinks({ sourceUrl: pdf, digitalObjectUrl: pdf }),
    ).toEqual([
      {
        kind: "pdf",
        href: pdf,
        label: "NARA scan (PDF)",
        note: "Archival PDF / scanned pages",
      },
    ]);
    expect(
      primaryDocumentAction({ sourceUrl: pdf, digitalObjectUrl: pdf }),
    ).toEqual({ href: pdf, label: "Open PDF" });
  });
});
