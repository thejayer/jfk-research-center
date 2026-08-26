import type {
  ConfidenceLevel,
  SearchFilters,
  SearchFilterInput,
} from "./api-types";
import {
  denseSearchFacetYears,
  rankedFacetValues,
  searchFacetCountScope,
  SEARCH_FACET_YEAR_BOUNDS,
  withoutFacetGroup,
  type SearchFacetGroup,
} from "./search-facets";

export type SearchFacetDocument = {
  documentId: string;
  agency: string | null;
  year: number | null;
  matchConfidence: ConfidenceLevel | null;
  entityIds: string[];
  topicSlugs: string[];
};

/**
 * Builds query-scoped, self-excluding facet counts from already-matched
 * documents. Used by warehouse search so the BigQuery job only scores
 * metadata; membership joins happen here.
 */
export function aggregateQuerySearchFacets({
  query,
  filters,
  documents,
  entityLabels,
  topicLabels,
}: {
  query: string;
  filters: SearchFilterInput;
  documents: SearchFacetDocument[];
  entityLabels: Record<string, string>;
  topicLabels: Record<string, string>;
}): SearchFilters {
  const agencyCounts = countBy(
    documentsMatching(documents, filters, "agency"),
    (document) => document.agency,
  );
  const yearCounts = countBy(
    documentsMatching(documents, filters, "year"),
    (document) =>
      document.year != null &&
      document.year >= SEARCH_FACET_YEAR_BOUNDS.min &&
      document.year <= SEARCH_FACET_YEAR_BOUNDS.max
        ? String(document.year)
        : null,
  );
  const entityCounts = countMany(
    documentsMatching(documents, filters, "entity"),
    (document) => document.entityIds,
  );
  const topicCounts = countMany(
    documentsMatching(documents, filters, "topic"),
    (document) => document.topicSlugs,
  );
  const confidenceCounts = query.trim()
    ? countBy(
        documentsMatching(documents, filters, "confidence"),
        (document) => document.matchConfidence,
      )
    : {};

  return {
    countScope: searchFacetCountScope(query, filters),
    years: denseSearchFacetYears(),
    yearCounts,
    yearBounds: SEARCH_FACET_YEAR_BOUNDS,
    agencies: rankedFacetValues(agencyCounts, filters.agencies ?? []),
    agencyCounts,
    topics: rankedFacetValues(topicCounts, filters.topics ?? []),
    topicLabels,
    topicCounts,
    entities: rankedFacetValues(entityCounts, filters.entities ?? []),
    entityLabels,
    entityCounts,
    confidence: rankedFacetValues(
      confidenceCounts,
      filters.confidence ?? [],
    ) as ConfidenceLevel[],
    confidenceCounts,
  };
}

export function documentsMatching(
  documents: SearchFacetDocument[],
  filters: SearchFilterInput,
  omit: SearchFacetGroup,
): SearchFacetDocument[] {
  const scoped = withoutFacetGroup(filters, omit);
  return documents.filter((document) => documentMatchesFilters(document, scoped));
}

export function documentMatchesFilters(
  document: SearchFacetDocument,
  filters: SearchFilterInput,
): boolean {
  if (
    filters.agencies?.length &&
    (!document.agency || !filters.agencies.includes(document.agency))
  ) {
    return false;
  }
  if (
    typeof filters.yearFrom === "number" &&
    (document.year == null || document.year < filters.yearFrom)
  ) {
    return false;
  }
  if (
    typeof filters.yearTo === "number" &&
    (document.year == null || document.year > filters.yearTo)
  ) {
    return false;
  }
  if (
    filters.entities?.length &&
    !filters.entities.some((entityId) => document.entityIds.includes(entityId))
  ) {
    return false;
  }
  if (
    filters.topics?.length &&
    !filters.topics.some((slug) => document.topicSlugs.includes(slug))
  ) {
    return false;
  }
  if (
    filters.confidence?.length &&
    (!document.matchConfidence ||
      !filters.confidence.includes(document.matchConfidence))
  ) {
    return false;
  }
  return true;
}

function countBy(
  documents: SearchFacetDocument[],
  readValue: (document: SearchFacetDocument) => string | null | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const document of documents) {
    const key = readValue(document);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countMany(
  documents: SearchFacetDocument[],
  readValues: (document: SearchFacetDocument) => readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const document of documents) {
    for (const key of new Set(readValues(document))) {
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}
