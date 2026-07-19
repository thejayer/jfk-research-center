import { describe, expect, it } from "vitest";
import {
  denseSearchFacetYears,
  rankedFacetValues,
  searchFacetCountScope,
  searchFiltersForMode,
  semanticCandidateLimit,
  withoutFacetGroup,
} from "../search-facets";

describe("search facet count contract", () => {
  it("distinguishes the corpus-wide empty state from query-scoped counts", () => {
    expect(searchFacetCountScope("", {})).toBe("corpus");
    expect(searchFacetCountScope("Oswald", {})).toBe("query");
    expect(searchFacetCountScope("", { agencies: ["CIA"] })).toBe("query");
  });

  it("removes only the group being counted", () => {
    const filters = {
      agencies: ["CIA"],
      entities: ["oswald"],
      topics: ["cia"],
      confidence: ["high" as const],
      yearFrom: 1959,
      yearTo: 1963,
    };

    expect(withoutFacetGroup(filters, "agency")).toEqual({
      ...filters,
      agencies: [],
    });
    expect(withoutFacetGroup(filters, "year")).toEqual({
      ...filters,
      yearFrom: null,
      yearTo: null,
    });
    expect(withoutFacetGroup(filters, "entity")).toEqual({
      ...filters,
      entities: [],
    });
    expect(withoutFacetGroup(filters, "topic")).toEqual({
      ...filters,
      topics: [],
    });
    expect(withoutFacetGroup(filters, "confidence")).toEqual({
      ...filters,
      confidence: [],
    });
  });

  it("keeps selected zero-result values available after applying a filter", () => {
    expect(rankedFacetValues({ CIA: 4, FBI: 2 }, ["Missing"])).toEqual([
      "CIA",
      "FBI",
      "Missing",
    ]);
  });

  it("uses one stable inclusive event-date range", () => {
    const years = denseSearchFacetYears();
    expect(years[0]).toBe("1950");
    expect(years.at(-1)).toBe("2005");
    expect(years).toHaveLength(56);
  });

  it("uses confidence only for document-mode facet context", () => {
    const filters = { agencies: ["CIA"], confidence: ["high" as const] };

    expect(searchFiltersForMode("document", filters).confidence).toEqual([
      "high",
    ]);
    expect(searchFiltersForMode("mention", filters)).toEqual({
      agencies: ["CIA"],
      confidence: [],
    });
    expect(searchFiltersForMode("semantic", filters).confidence).toEqual([]);
  });

  it("boundedly overfetches semantic candidates only for metadata filters", () => {
    expect(semanticCandidateLimit(25, false)).toBe(25);
    expect(semanticCandidateLimit(25, true)).toBe(125);
    expect(semanticCandidateLimit(100, true)).toBe(250);
  });
});
