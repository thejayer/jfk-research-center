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
  fetchSearch: vi.fn(),
  fetchHome: vi.fn(),
  fetchTopic: vi.fn(),
  fetchAllTopics: vi.fn(),
  fetchEntity: vi.fn(),
  fetchAllEntities: vi.fn(),
  fetchPhysicalEvidenceIndex: vi.fn(),
  fetchPhysicalEvidenceItem: vi.fn(),
  fetchCompare: vi.fn(),
  fetchOpenQuestionsIndex: vi.fn(),
  fetchOpenQuestionsTopic: vi.fn(),
  fetchEstablishedFactsIndex: vi.fn(),
  fetchBibliographyIndex: vi.fn(),
  fetchEntityCooccurrence: vi.fn(),
  fetchDealeyPlazaWitnesses: vi.fn(),
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
  fetchEntity,
  fetchHome,
  fetchMediaAsset,
  fetchMediaIndex,
  fetchPhysicalEvidenceIndex,
  fetchPhysicalEvidenceItem,
  fetchSearch,
  fetchTopic,
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

  it("logs the original warehouse error before wrapping it as a 500", async () => {
    const cause = new Error("bytes billed exceeded");
    warehouse.fetchDocument.mockRejectedValue(cause);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchDocument("104-10004-10143")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 500,
      path: "/api/document/104-10004-10143",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[api-client] in-process read failed for ssr_document",
      cause,
    );
    errorSpy.mockRestore();
  });
});

describe("api-client remaining SSR reads", () => {
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

  it("loads search, home, topic, entity, and evidence without fetching the public origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    warehouse.fetchSearch.mockResolvedValue({ results: [], total: 0 });
    warehouse.fetchHome.mockResolvedValue({ stats: { documentCount: 1 } });
    warehouse.fetchTopic.mockResolvedValue({ topic: { slug: "cia" } });
    warehouse.fetchEntity.mockResolvedValue({ entity: { slug: "oswald" } });
    warehouse.fetchPhysicalEvidenceIndex.mockResolvedValue({ items: [] });
    warehouse.fetchPhysicalEvidenceItem.mockResolvedValue({
      id: "ce-399",
    });

    await expect(fetchSearch("oswald", "mention", { topic: ["cuba"] }, 50))
      .resolves.toEqual({ results: [], total: 0 });
    await expect(fetchHome()).resolves.toEqual({ stats: { documentCount: 1 } });
    await expect(fetchTopic("cia")).resolves.toEqual({ topic: { slug: "cia" } });
    await expect(fetchEntity("oswald")).resolves.toEqual({
      entity: { slug: "oswald" },
    });
    await expect(fetchPhysicalEvidenceIndex()).resolves.toEqual({ items: [] });
    await expect(fetchPhysicalEvidenceItem("ce-399")).resolves.toEqual({
      id: "ce-399",
    });

    expect(warehouse.fetchSearch).toHaveBeenCalledWith({
      query: "oswald",
      mode: "mention",
      filters: {
        agencies: undefined,
        yearFrom: undefined,
        yearTo: undefined,
        entities: undefined,
        topics: ["cuba"],
        confidence: undefined,
      },
      offset: 50,
    });
    expect(warehouse.fetchHome).toHaveBeenCalled();
    expect(warehouse.fetchTopic).toHaveBeenCalledWith("cia");
    expect(warehouse.fetchEntity).toHaveBeenCalledWith("oswald");
    expect(warehouse.fetchPhysicalEvidenceIndex).toHaveBeenCalled();
    expect(warehouse.fetchPhysicalEvidenceItem).toHaveBeenCalledWith("ce-399");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps warehouse search failures as 503 so the search page can fall back", async () => {
    const cause = new Error("warehouse search failed");
    warehouse.fetchSearch.mockRejectedValue(cause);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchSearch("oswald")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 503,
      path: "/api/search?q=oswald",
    });
    await expect(fetchSearch("oswald")).rejects.toBeInstanceOf(ApiRequestError);
    expect(errorSpy).toHaveBeenCalledWith(
      "[api-client] in-process read failed for ssr_search",
      cause,
    );
    errorSpy.mockRestore();
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
