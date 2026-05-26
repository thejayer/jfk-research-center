import { describe, expect, it } from "vitest";
import {
  buildCompareResponse,
  buildDocumentResponse,
  buildEntityCooccurrence,
  buildSearchResponse,
} from "../mock-data";

describe("buildSearchResponse", () => {
  it("applies document filters in mock mode", () => {
    const response = buildSearchResponse({
      query: "Oswald",
      mode: "document",
      filters: { agencies: ["CIA"], entities: ["oswald"] },
    });

    expect(response.total).toBeGreaterThan(0);
    expect(
      response.results.every(
        (r) => r.kind === "document" && r.document.agency === "CIA",
      ),
    ).toBe(true);
  });

  it("paginates document results without changing the total", () => {
    const all = buildSearchResponse({ query: "", mode: "document", limit: 100 });
    const page = buildSearchResponse({
      query: "",
      mode: "document",
      limit: 2,
      offset: 1,
    });

    expect(page.total).toBe(all.total);
    expect(page.results).toHaveLength(2);
    expect(page.results[0]).toEqual(all.results[1]);
  });

  it("returns no mention results for an empty query", () => {
    const response = buildSearchResponse({ query: "", mode: "mention" });

    expect(response.total).toBe(0);
    expect(response.results).toEqual([]);
  });
});

describe("buildDocumentResponse", () => {
  it("resolves documents by NAID while preserving canonical links", () => {
    const byId = buildDocumentResponse("wc-report-1964");
    const byNaid = buildDocumentResponse("193887");

    expect(byNaid).not.toBeNull();
    expect(byNaid?.document.id).toBe("wc-report-1964");
    expect(byNaid?.document.href).toBe("/document/wc-report-1964");
    expect(byNaid?.mentions).toEqual(byId?.mentions);
  });
});

describe("buildEntityCooccurrence", () => {
  it("normalizes reversed year inputs and clamps the applied range", () => {
    const response = buildEntityCooccurrence({
      yearFrom: 1979,
      yearTo: 1963,
    });

    expect(response.yearBounds).toEqual({ min: 1950, max: 2005 });
    expect(response.appliedRange).toEqual({ yearFrom: 1963, yearTo: 1979 });
    expect(response.links.length).toBeGreaterThan(0);
  });

  it("filters links below the requested minimum co-occurrence count", () => {
    const loose = buildEntityCooccurrence({ minCount: 2 });
    const strict = buildEntityCooccurrence({ minCount: 6 });
    const looseCooccurrenceLinks = loose.links.filter(
      (link) => (link.kind ?? "cooccurrence") === "cooccurrence",
    );
    const strictCooccurrenceLinks = strict.links.filter(
      (link) => (link.kind ?? "cooccurrence") === "cooccurrence",
    );

    expect(strictCooccurrenceLinks.length).toBeLessThan(looseCooccurrenceLinks.length);
    expect(strictCooccurrenceLinks.every((link) => link.count >= 6)).toBe(true);
    expect(strict.nodes.every((node) => node.degree > 0)).toBe(true);
    expect(
      looseCooccurrenceLinks.every((link) => link.documents.length > 0),
    ).toBe(true);
    expect(
      strictCooccurrenceLinks.every((link) => link.documents.length > 0),
    ).toBe(true);
  });

  it("adds rights-aware media and topic nodes from media metadata", () => {
    const response = buildEntityCooccurrence({ minCount: 2 });
    const mediaLinks = response.links.filter((link) =>
      link.kind?.startsWith("media_"),
    );

    expect(response.nodes.some((node) => node.type === "media")).toBe(true);
    expect(
      response.nodes.some(
        (node) => node.id.startsWith("topic:") && node.typeLabel === "Topic",
      ),
    ).toBe(true);
    expect(mediaLinks.length).toBeGreaterThan(0);
    expect(mediaLinks.every((link) => link.documents.length === 0)).toBe(true);
    expect(
      response.nodes
        .filter((node) => node.type === "media")
        .every((node) => node.href?.startsWith("/media/")),
    ).toBe(true);
  });

  it("sets node degree from the number of linked peers", () => {
    const response = buildEntityCooccurrence({ minCount: 2 });
    const peersById = new Map<string, Set<string>>();

    for (const link of response.links) {
      if (!peersById.has(link.source)) peersById.set(link.source, new Set());
      if (!peersById.has(link.target)) peersById.set(link.target, new Set());
      peersById.get(link.source)?.add(link.target);
      peersById.get(link.target)?.add(link.source);
    }

    for (const node of response.nodes) {
      expect(node.degree).toBe(peersById.get(node.id)?.size ?? 0);
    }
  });
});

describe("buildCompareResponse", () => {
  it("models a multi-release compare fixture", () => {
    const response = buildCompareResponse("oswald-201-file-vol1");

    expect(response).not.toBeNull();
    expect(response?.canonicalKey.value).toBe("104-10004-10156");
    expect(response?.versions).toHaveLength(3);
    expect(response?.versions.some((version) => version.ocrAvailable)).toBe(true);
    expect(response?.limitations.length).toBeGreaterThan(0);
  });

  it("returns null when no compare fixture exists", () => {
    expect(buildCompareResponse("missing-record")).toBeNull();
  });
});
