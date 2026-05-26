import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../api-types";

const nextHeaders = vi.hoisted(() => ({
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: nextHeaders.headers,
}));

import { fetchMediaAsset } from "../api-client";

const mediaAsset: MediaAsset = {
  id: "jfkl-test-media",
  title: "Test media asset",
  sourceName: "John F. Kennedy Presidential Library and Museum",
  sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-test",
  collection: "White House Photographs",
  digitalIdentifier: "JFKWHP-TEST",
  mediaType: "Negative",
  date: "1963-11-22",
  dateLabel: "1963 November 22",
  description: "Test official media asset.",
  creditLine:
    "White House Photographs. John F. Kennedy Presidential Library and Museum, Boston.",
  rightsStatus: "public_domain_likely",
  rightsNote: "Reviewed as a test fixture.",
  storageStatus: "external_reference",
  storageNote: "External reference only.",
  thumbnailUrl: null,
  imageUrl: null,
  localImagePath: null,
  tags: ["test"],
  relatedEntities: ["oswald"],
  relatedTopics: ["dealey-plaza"],
};

describe("api-client media helpers", () => {
  beforeEach(() => {
    vi.stubEnv("JFK_API_BASE_URL", "");
    nextHeaders.headers.mockResolvedValue(new Headers({ host: "example.test" }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches one media asset", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(mediaAsset, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMediaAsset(mediaAsset.id)).resolves.toEqual(mediaAsset);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://example.test/api/media/${mediaAsset.id}`,
      expect.objectContaining({
        next: { revalidate: 600 },
      }),
    );
  });

  it("returns null when one media asset is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(fetchMediaAsset("missing-media")).resolves.toBeNull();
  });
});
