import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../api-types";

const nextHeaders = vi.hoisted(() => ({
  headers: vi.fn(),
}));

const warehouse = vi.hoisted(() => ({
  fetchDocument: vi.fn(),
  fetchDocumentOcrPage: vi.fn(),
  fetchCaseTimeline: vi.fn(),
  fetchCorpusManifest: vi.fn(),
  fetchMediaIndex: vi.fn(),
}));

const mediaAssets = vi.hoisted(() => ({
  getMediaAsset: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: nextHeaders.headers,
}));

vi.mock("../warehouse", () => warehouse);
vi.mock("../media-assets", () => mediaAssets);

import {
  ApiRequestError,
  buildInternalFetchHeaders,
  fetchCaseTimeline,
  fetchCorpusManifest,
  fetchDocument,
  fetchMediaAsset,
  fetchMediaIndex,
  fetchSearch,
} from "../api-client";
import {
  JFK_INTERNAL_REQUEST_MARKER_HEADER,
  validateInternalRequestMarker,
} from "../cost-request";

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
    vi.stubEnv("JFK_API_BASE_URL", "https://researchjfk.ai");
    nextHeaders.headers.mockResolvedValue(new Headers({ host: "example.test" }));
    mediaAssets.getMediaAsset.mockReturnValue(mediaAsset);
    warehouse.fetchMediaIndex.mockResolvedValue({ assets: [mediaAsset] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads one media asset in-process without looping through the public origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMediaAsset(mediaAsset.id)).resolves.toEqual(mediaAsset);
    expect(mediaAssets.getMediaAsset).toHaveBeenCalledWith(mediaAsset.id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when one media asset is missing", async () => {
    mediaAssets.getMediaAsset.mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());

    await expect(fetchMediaAsset("missing-media")).resolves.toBeNull();
  });

  it("loads the media index in-process", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchMediaIndex()).resolves.toEqual({ assets: [mediaAsset] });
    expect(warehouse.fetchMediaIndex).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("api-client in-process SSR reads", () => {
  beforeEach(() => {
    vi.stubEnv("JFK_API_BASE_URL", "https://researchjfk.ai");
    nextHeaders.headers.mockResolvedValue(
      new Headers({
        host: "researchjfk.ai",
        "x-jfk-traffic-class": "browser",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads documents, timeline, and corpus manifest without fetching the public origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    warehouse.fetchDocument.mockResolvedValue({ document: { id: "104-10004-10143" } });
    warehouse.fetchCaseTimeline.mockResolvedValue({ events: [] });
    warehouse.fetchCorpusManifest.mockResolvedValue({ totalRecords: 1 });

    await expect(fetchDocument("104-10004-10143", 2)).resolves.toEqual({
      document: { id: "104-10004-10143" },
    });
    await expect(fetchCaseTimeline()).resolves.toEqual({ events: [] });
    await expect(fetchCorpusManifest()).resolves.toEqual({ totalRecords: 1 });

    expect(warehouse.fetchDocument).toHaveBeenCalledWith("104-10004-10143", {
      chunkOrder: 2,
    });
    expect(warehouse.fetchCaseTimeline).toHaveBeenCalled();
    expect(warehouse.fetchCorpusManifest).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("api-client search errors", () => {
  beforeEach(() => {
    vi.stubEnv("JFK_API_BASE_URL", "");
    nextHeaders.headers.mockResolvedValue(new Headers({ host: "example.test" }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("throws a typed error when warehouse search returns 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "warehouse search failed" }, { status: 503 }),
      ),
    );

    await expect(fetchSearch("oswald")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 503,
      path: "/api/search?q=oswald",
    });
    await expect(fetchSearch("oswald")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("throws on a 500 warehouse failure so the search page can render a fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "warehouse search failed" }, { status: 500 }),
      ),
    );

    await expect(fetchSearch("")).rejects.toMatchObject({
      status: 500,
      path: "/api/search",
    });
  });
});

describe("internal API fetch headers", () => {
  const secret = "test-internal-marker-secret";
  const incoming = new Headers({
    "x-jfk-request-id": "request_123",
    "x-jfk-request-fingerprint": "abcdef0123456789",
    "x-jfk-traffic-class": "browser",
    [JFK_INTERNAL_REQUEST_MARKER_HEADER]: "a".repeat(64),
  });

  it("omits per-request ids from cacheable fetches and replaces markers", async () => {
    const forwarded = await buildInternalFetchHeaders(
      incoming,
      { revalidate: 300 },
      secret,
    );

    expect(forwarded.get("x-jfk-request-id")).toBeNull();
    expect(forwarded.get("x-jfk-request-fingerprint")).toBe(
      "abcdef0123456789",
    );
    expect(forwarded.get("x-jfk-traffic-class")).toBe("browser");
    expect(forwarded.get(JFK_INTERNAL_REQUEST_MARKER_HEADER)).not.toBe(
      "a".repeat(64),
    );
    expect(await validateInternalRequestMarker(forwarded, secret)).toBe(true);
  });

  it("retains per-request ids only for no-store fetches", async () => {
    const forwarded = await buildInternalFetchHeaders(
      incoming,
      { noStore: true },
      secret,
    );

    expect(forwarded.get("x-jfk-request-id")).toBe("request_123");
    expect(await validateInternalRequestMarker(forwarded, secret)).toBe(true);
  });
});
