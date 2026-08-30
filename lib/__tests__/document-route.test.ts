import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const warehouse = vi.hoisted(() => ({
  fetchDocument: vi.fn(),
}));

vi.mock("@/lib/warehouse", () => warehouse);

import { GET as getDocument } from "@/app/api/document/[id]/route";

describe("first-party document route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the first OCR page when no chunk is requested", async () => {
    warehouse.fetchDocument.mockResolvedValue({
      document: { id: "124-10190-10075", title: "Untitled Record" },
    });

    const response = await getDocument(
      new NextRequest("https://example.test/api/document/124-10190-10075"),
      { params: Promise.resolve({ id: "124-10190-10075" }) },
    );

    expect(response.status).toBe(200);
    expect(warehouse.fetchDocument).toHaveBeenCalledWith(
      "124-10190-10075",
      { chunkOrder: null },
    );
  });

  it("forwards ?chunk= so a shareable URL can SSR that page", async () => {
    warehouse.fetchDocument.mockResolvedValue({
      document: {
        id: "124-10190-10075",
        ocrPages: [{ pageLabel: "p. 2", text: "later page", chunkOrder: 40 }],
      },
    });

    const response = await getDocument(
      new NextRequest(
        "https://example.test/api/document/124-10190-10075?chunk=40",
      ),
      { params: Promise.resolve({ id: "124-10190-10075" }) },
    );

    expect(response.status).toBe(200);
    expect(warehouse.fetchDocument).toHaveBeenCalledWith(
      "124-10190-10075",
      { chunkOrder: 40 },
    );
  });
});
