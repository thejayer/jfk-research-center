import type {
  CaseTimelineEvent,
  CorpusManifest,
  TimelineDocumentLink,
} from "./api-types";

export type ReleaseExplorerStatus = "indexed" | "pending" | "timeline_only";

export type ReleaseExplorerItem = {
  id: string;
  date: string;
  year: string;
  title: string;
  description: string;
  releaseSet: string | null;
  recordCount: number;
  status: ReleaseExplorerStatus;
  relatedTopicIds: string[];
  relatedEntityIds: string[];
  sourceExternal: string[];
  documentLinks: TimelineDocumentLink[];
};

export type ReleaseExplorerFilters = {
  year?: string | null;
  status?: ReleaseExplorerStatus | "all" | null;
  topic?: string | null;
};

export type ReleaseExplorerResult = {
  items: ReleaseExplorerItem[];
  years: string[];
  topics: string[];
  statusCounts: Record<ReleaseExplorerStatus, number>;
};

/** Builds release explorer rows from release timeline events and manifest coverage. */
export function buildReleaseExplorer(
  events: readonly CaseTimelineEvent[],
  manifest: CorpusManifest,
  filters: ReleaseExplorerFilters = {},
): ReleaseExplorerResult {
  const allItems = events
    .filter((event) => event.category === "release")
    .map((event) => eventToReleaseItem(event, manifest))
    .sort((a, b) => b.date.localeCompare(a.date));

  const years = Array.from(new Set(allItems.map((item) => item.year))).sort(
    (a, b) => b.localeCompare(a),
  );
  const topics = Array.from(
    new Set(allItems.flatMap((item) => item.relatedTopicIds)),
  ).sort((a, b) => a.localeCompare(b));
  const statusCounts = countStatuses(allItems);

  const normalizedStatus = normalizeReleaseStatusFilter(filters.status);
  const normalizedYear = filters.year?.trim() || null;
  const normalizedTopic = filters.topic?.trim() || null;

  return {
    items: allItems.filter((item) => {
      if (normalizedYear && item.year !== normalizedYear) return false;
      if (normalizedStatus && item.status !== normalizedStatus) return false;
      if (normalizedTopic && !item.relatedTopicIds.includes(normalizedTopic)) {
        return false;
      }
      return true;
    }),
    years,
    topics,
    statusCounts,
  };
}

export function releaseStatusLabel(status: ReleaseExplorerStatus): string {
  switch (status) {
    case "indexed":
      return "Indexed";
    case "pending":
      return "Pending";
    case "timeline_only":
      return "Timeline only";
  }
}

export function releaseStatusDescription(status: ReleaseExplorerStatus): string {
  switch (status) {
    case "indexed":
      return "The corpus manifest reports indexed records for this release set.";
    case "pending":
      return "The corpus manifest knows this release set but does not yet index it.";
    case "timeline_only":
      return "This release appears in the timeline, but no matching manifest set was found.";
  }
}

export function normalizeReleaseStatusFilter(
  status: unknown,
): ReleaseExplorerStatus | null {
  return status === "indexed" || status === "pending" || status === "timeline_only"
    ? status
    : null;
}

function eventToReleaseItem(
  event: CaseTimelineEvent,
  manifest: CorpusManifest,
): ReleaseExplorerItem {
  const year = event.date.slice(0, 4);
  const releaseSet = findReleaseSet(year, manifest);
  const recordCount = releaseSet ? manifest.recordsByRelease[releaseSet] ?? 0 : 0;

  return {
    id: event.id,
    date: event.date,
    year,
    title: event.title,
    description: event.description,
    releaseSet,
    recordCount,
    status: releaseStatus(releaseSet, manifest),
    relatedTopicIds: Array.from(new Set(event.relatedTopicIds)).sort(),
    relatedEntityIds: Array.from(new Set(event.relatedEntityIds)).sort(),
    sourceExternal: event.sourceExternal,
    documentLinks: event.documentLinks,
  };
}

function findReleaseSet(year: string, manifest: CorpusManifest): string | null {
  const keys = Object.keys(manifest.recordsByRelease);
  return (
    keys.find((key) => key === year) ??
    keys.find((key) => key.split(/[^0-9]+/).includes(year)) ??
    null
  );
}

function releaseStatus(
  releaseSet: string | null,
  manifest: CorpusManifest,
): ReleaseExplorerStatus {
  if (!releaseSet) return "timeline_only";
  if (manifest.releasesIndexed.includes(releaseSet)) return "indexed";
  if (manifest.releasesPending.includes(releaseSet)) return "pending";
  return "timeline_only";
}

function countStatuses(
  items: readonly ReleaseExplorerItem[],
): Record<ReleaseExplorerStatus, number> {
  return items.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { indexed: 0, pending: 0, timeline_only: 0 },
  );
}
