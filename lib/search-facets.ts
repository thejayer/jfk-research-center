import type { SearchFilterInput, SearchFacetCountScope } from "./api-types";

export const SEARCH_FACET_YEAR_BOUNDS = { min: 1950, max: 2005 } as const;

export type SearchFacetGroup =
  | "agency"
  | "year"
  | "entity"
  | "topic"
  | "confidence";

export type FacetedSearchMode = "document" | "mention" | "semantic";

/** Confidence is a document-match property, not a passage/vector property. */
export function searchFiltersForMode(
  mode: FacetedSearchMode,
  filters: SearchFilterInput,
): SearchFilterInput {
  return mode === "document" ? filters : { ...filters, confidence: [] };
}

export function semanticCandidateLimit(
  limit: number,
  hasMetadataFilters: boolean,
): number {
  const requested = Math.max(1, Math.floor(limit));
  return hasMetadataFilters ? Math.min(250, requested * 5) : requested;
}

/**
 * Facet counts use one rule in mock and warehouse-backed search:
 *
 * - each value counts matching documents, never passages;
 * - the text query and filters from other groups are applied;
 * - the current group's own filter is omitted (self-excluding facets).
 *
 * With no query or filters this is the corpus-wide distribution. As soon as a
 * query or filter is present it is a query-scoped distribution.
 */
export function searchFacetCountScope(
  query: string,
  filters: SearchFilterInput,
): SearchFacetCountScope {
  return query.trim() || hasSearchFilterInput(filters) ? "query" : "corpus";
}

export function hasSearchFilterInput(filters: SearchFilterInput): boolean {
  return (
    !!filters.agencies?.length ||
    !!filters.entities?.length ||
    !!filters.topics?.length ||
    !!filters.confidence?.length ||
    typeof filters.yearFrom === "number" ||
    typeof filters.yearTo === "number"
  );
}

export function withoutFacetGroup(
  filters: SearchFilterInput,
  group: SearchFacetGroup,
): SearchFilterInput {
  switch (group) {
    case "agency":
      return { ...filters, agencies: [] };
    case "year":
      return { ...filters, yearFrom: null, yearTo: null };
    case "entity":
      return { ...filters, entities: [] };
    case "topic":
      return { ...filters, topics: [] };
    case "confidence":
      return { ...filters, confidence: [] };
  }
}

/** Keep selected values visible so a zero-result selection can always clear. */
export function rankedFacetValues(
  counts: Record<string, number>,
  selected: readonly string[] = [],
): string[] {
  return Array.from(
    new Set([
      ...Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([value]) => value),
      ...selected,
    ]),
  ).sort(
    (a, b) =>
      (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b),
  );
}

export function denseSearchFacetYears(): string[] {
  const years: string[] = [];
  for (
    let year = SEARCH_FACET_YEAR_BOUNDS.min;
    year <= SEARCH_FACET_YEAR_BOUNDS.max;
    year += 1
  ) {
    years.push(String(year));
  }
  return years;
}
