import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const warehouse = vi.hoisted(() => ({
  fetchDocumentOcrPage: vi.fn(),
}));

vi.mock("@/lib/warehouse", () => warehouse);

import { GET as getDocumentOcr } from "@/app/api/document/[id]/ocr/route";

describe("first-party document OCR page route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stays public and returns one full OCR page", async () => {
    warehouse.fetchDocumentOcrPage.mockResolvedValue({
      documentId: "104-10086-10152",
      page: {
        pageLabel: "p. 2",
        text: "Full OCR page text, not a 500-character card excerpt.",
        chunkOrder: 1,
      },
      prevChunkOrder: 0,
      nextChunkOrder: 2,
      chunkCount: 12,
      firstChunkOrder: 0,
      lastChunkOrder: 11,
    });

    const response = await getDocumentOcr(
      new NextRequest(
        "https://example.test/api/document/104-10086-10152/ocr?chunk=1",
      ),
      { params: Promise.resolve({ id: "104-10086-10152" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      documentId: "104-10086-10152",
      chunkCount: 12,
      page: { chunkOrder: 1, text: expect.stringContaining("Full OCR") },
    });
    expect(warehouse.fetchDocumentOcrPage).toHaveBeenCalledWith(
      "104-10086-10152",
      1,
    );
  });

  it("returns 404 when the document has no cheap OCR page", async () => {
    warehouse.fetchDocumentOcrPage.mockResolvedValue(null);
    const response = await getDocumentOcr(
      new NextRequest("https://example.test/api/document/missing/ocr"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});

