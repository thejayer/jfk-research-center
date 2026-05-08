import { describe, expect, it } from "vitest";
import { buildCompareResponse, buildSearchResponse } from "../mock-data";

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
