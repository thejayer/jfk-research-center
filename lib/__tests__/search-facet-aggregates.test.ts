import { describe, expect, it } from "vitest";
import {
  aggregateQuerySearchFacets,
  documentMatchesFilters,
  type SearchFacetDocument,
} from "../search-facet-aggregates";

const oswaldCia: SearchFacetDocument = {
  documentId: "104-10004-10143",
  agency: "CIA",
  year: 1963,
  matchConfidence: "high",
  entityIds: ["oswald", "cia"],
  topicSlugs: ["cia", "mexico-city"],
};

const fbiLow: SearchFacetDocument = {
  documentId: "124-10158-10023",
  agency: "FBI",
  year: 1964,
  matchConfidence: "low",
  entityIds: ["oswald", "fbi"],
  topicSlugs: ["fbi"],
};

describe("query-scoped search facet aggregates", () => {
  it("self-excludes the agency group so a CIA filter still lists FBI", () => {
    const facets = aggregateQuerySearchFacets({
      query: "Oswald",
      filters: { agencies: ["CIA"] },
      documents: [oswaldCia, fbiLow],
      entityLabels: { oswald: "Lee Harvey Oswald", cia: "CIA", fbi: "FBI" },
      topicLabels: { cia: "CIA Records", fbi: "FBI Records", "mexico-city": "Mexico City" },
    });

    expect(facets.countScope).toBe("query");
    expect(facets.agencyCounts).toEqual({ CIA: 1, FBI: 1 });
    expect(facets.topicCounts.cia).toBe(1);
    expect(facets.topicCounts.fbi).toBeUndefined();
    expect(facets.confidenceCounts).toEqual({ high: 1 });
  });

  it("omits documents that fail filters when the group is not excluded", () => {
    expect(
      documentMatchesFilters(fbiLow, { agencies: ["CIA"] }),
    ).toBe(false);
    expect(
      documentMatchesFilters(oswaldCia, { agencies: ["CIA"], yearFrom: 1963, yearTo: 1963 }),
    ).toBe(true);
  });
});
