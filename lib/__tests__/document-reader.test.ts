import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  archivalPageCount,
  displayDocumentTitle,
  documentDisplayFields,
  documentReaderHref,
  documentSourceLinks,
  formatArchivalPageCount,
  formatOcrReaderStatus,
  isGenericDocumentTitle,
  isLatestReaderLoad,
  isPdfUrl,
  parseChunkParam,
  parseOcrJumpInput,
  parsePageLabelNumber,
  primaryDocumentAction,
  requestedReaderChunk,
  shouldHideOcrForHashDeepLink,
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

describe("requestedReaderChunk", () => {
  it("uses a hash-only deep link when no query is present", () => {
    expect(requestedReaderChunk("", "#chunk-40")).toEqual({
      chunk: 40,
      hashOnly: true,
    });
    expect(requestedReaderChunk("", "#chunk-0")).toEqual({
      chunk: 0,
      hashOnly: true,
    });
  });

  it("prefers a later hash click over a stale ?chunk= after paging", () => {
    expect(requestedReaderChunk("?chunk=1", "#chunk-0")).toEqual({
      chunk: 0,
      hashOnly: false,
    });
  });

  it("keeps the query when hash and query agree", () => {
    expect(requestedReaderChunk("?chunk=40", "#chunk-40")).toEqual({
      chunk: 40,
      hashOnly: false,
    });
  });
});

describe("hash-pending reveal and load races", () => {
  it("hides the SSR first page only while a hash-only fetch is in flight", () => {
    expect(
      shouldHideOcrForHashDeepLink({ hideUntilLoad: true, settled: false }),
    ).toBe(true);
    expect(
      shouldHideOcrForHashDeepLink({ hideUntilLoad: true, settled: true }),
    ).toBe(false);
    expect(
      shouldHideOcrForHashDeepLink({ hideUntilLoad: false, settled: false }),
    ).toBe(false);
  });

  it("drops a stale page response after a newer load starts", () => {
    expect(isLatestReaderLoad(1, 2)).toBe(false);
    expect(isLatestReaderLoad(2, 2)).toBe(true);
  });
});

describe("document page fetch alignment", () => {
  it("generateMetadata uses the same ?chunk= as the page body", () => {
    const source = readFileSync(
      new URL("../../app/document/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    const metadata = source.slice(
      source.indexOf("export async function generateMetadata"),
      source.indexOf("export default async function DocumentPage"),
    );
    expect(metadata).toContain("searchParams");
    expect(metadata).toContain("parseChunkParam(resolvedSearchParams.chunk)");
    expect(metadata).toContain("fetchDocument(id, parseChunkParam");
    expect(metadata).toContain("displayDocumentTitle");
    expect(source).toContain("fetchDocument(id, requestedChunk)");
  });

  it("research-context loaded-page anchors use ?chunk= so they survive paging", () => {
    const source = readFileSync(
      new URL("../../components/documents/document-research-context.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("documentReaderHref(doc.id");
    expect(source).not.toMatch(/href:\s*`#chunk-\$/);
  });

  it("metadata panel hides pageCount 0 and shows the NARA title when derived", () => {
    const source = readFileSync(
      new URL("../../components/documents/metadata-panel.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("formatArchivalPageCount");
    expect(source).toContain("sourceTitle");
    expect(source).not.toMatch(/doc\.pageCount \? formatNumber\(doc\.pageCount\)/);
  });

  it("the reader clears hash-pending on apply and on error, and ignores stale loads", () => {
    const source = readFileSync(
      new URL("../../components/documents/ocr-page-reader.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("setHashPending(false)");
    expect(source).toContain("isLatestReaderLoad(generation, loadGenRef.current)");
    expect(source).toContain("requestedReaderChunk(");
    expect(source).toContain("shouldHideOcrForHashDeepLink");
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
  it("replaces empty, Untitled Record, and Untitled {doc_type} with a derived title", () => {
    expect(
      displayDocumentTitle({
        title: "Untitled Record",
        naid: "124-10190-10075",
        agency: "FBI",
        description: "BULKY ENC · Release: Redact",
      }),
    ).toBe("FBI bulky file");
    expect(
      displayDocumentTitle({
        title: "",
        naid: "124-10190-10075",
        agency: "FBI",
        description: "BULKY ENC · Release: Redact",
      }),
    ).toBe("FBI bulky file");
    expect(
      displayDocumentTitle({
        title: "Untitled PAPER-TEXTUAL DOCUMENT",
        naid: "124-10200-10001",
        agency: "FBI",
        documentType: "PAPER-TEXTUAL DOCUMENT",
        description: "Release: Redact",
      }),
    ).toBe("FBI paper");
    expect(
      displayDocumentTitle({
        title: "Untitled MEMORANDUM.",
        naid: "180-10001-10001",
        agency: "HSCA",
        documentType: "MEMORANDUM.",
      }),
    ).toBe("HSCA memo");
    expect(
      displayDocumentTitle({
        title: "Untitled CABLE",
        naid: "180-10001-10002",
        agency: "HSCA",
        documentType: "CABLE",
      }),
    ).toBe("HSCA cable");
    expect(
      documentDisplayFields({
        title: "Untitled Record",
        naid: "124-10190-10075",
        agency: "FBI",
        description: "BULKY ENC · Release: Redact",
      }),
    ).toEqual({
      title: "FBI bulky file",
      sourceTitle: "Untitled Record",
    });
  });

  it("treats NARA placeholders as generic but keeps real titles", () => {
    expect(isGenericDocumentTitle("Untitled Record")).toBe(true);
    expect(isGenericDocumentTitle("Untitled PAPER-TEXTUAL DOCUMENT")).toBe(
      true,
    );
    expect(isGenericDocumentTitle("[RESTRICTED]")).toBe(true);
    expect(isGenericDocumentTitle("WITHHELD")).toBe(true);
    expect(isGenericDocumentTitle("PAPER - TEXTUAL DOCUMENT", "PAPER - TEXTUAL DOCUMENT")).toBe(
      true,
    );
    expect(isGenericDocumentTitle("201 FILE OF PROTECTABLE SOURCE.")).toBe(
      false,
    );
    expect(
      isGenericDocumentTitle("Untitled memo concerning Oswald"),
    ).toBe(false);
    expect(
      displayDocumentTitle({
        title: "CABLE RE PHOTOS AND OSWALD'S MOTHER.",
        naid: "104-10086-10153",
        agency: "CIA",
        documentType: "PAPER - TEXTUAL DOCUMENT",
      }),
    ).toBe("CABLE RE PHOTOS AND OSWALD'S MOTHER.");
    expect(
      displayDocumentTitle({
        title: "PAPER, TEXTUAL DOCUMENT from BRANIGAN, W. A. to SULLIVAN, W. C.",
        naid: "124-10274-10044",
        agency: "FBI",
        documentType: "PAPER, TEXTUAL DOCUMENT",
      }),
    ).toBe("PAPER, TEXTUAL DOCUMENT from BRANIGAN, W. A. to SULLIVAN, W. C.");
    expect(
      displayDocumentTitle({
        title: "[RESTRICTED]",
        naid: "104-10001-10001",
        agency: "CIA",
        documentType: "PAPER - TEXTUAL DOCUMENT",
      }),
    ).toBe("CIA paper");
  });

  it("does not invent a page count when NARA pages is 0 and no label exists", () => {
    expect(formatArchivalPageCount({ pageCount: 0, lastPageLabel: null })).toBeNull();
    expect(
      formatArchivalPageCount({ pageCount: 0, lastPageLabel: "p. 2119" }),
    ).toEqual({ label: "Archival pages", value: "~2,119" });
    expect(
      formatArchivalPageCount({ pageCount: 14, lastPageLabel: "p. 2119" }),
    ).toEqual({ label: "Pages", value: "14" });
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
