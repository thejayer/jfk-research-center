import { describe, expect, it } from "vitest";
import type { CaseTimelineEvent, CorpusManifest } from "../api-types";
import {
  buildReleaseExplorer,
  normalizeReleaseStatusFilter,
  releaseStatusDescription,
  releaseStatusLabel,
} from "../release-explorer";

const manifest: CorpusManifest = {
  totalRecords: 100,
  recordsWithOcr: 80,
  ocrPassages: 240,
  latestIndexedReleaseDate: "2025-03-18",
  releasesIndexed: ["2017-2018", "2025"],
  releasesPending: ["2026"],
  recordsByRelease: {
    "2017-2018": 40,
    "2025": 60,
    "2026": 0,
  },
  recordsWith2025Ocr: 60,
  coverageNote: "Test fixture",
};

const events: CaseTimelineEvent[] = [
  releaseEvent({
    id: "release-2025",
    date: "2025-03-18",
    relatedTopicIds: ["cia"],
    documentLinks: [{ documentId: "oswald-201-file-vol1", title: null, note: null }],
  }),
  releaseEvent({
    id: "release-2026",
    date: "2026-01-10",
    relatedTopicIds: ["arrb-releases"],
  }),
  releaseEvent({
    id: "release-1998",
    date: "1998-09-30",
    relatedTopicIds: ["arrb-releases"],
  }),
  {
    ...releaseEvent({ id: "investigation", date: "1964-09-24" }),
    category: "investigation",
  },
];

describe("release explorer helpers", () => {
  it("builds release rows with manifest status and record counts", () => {
    const result = buildReleaseExplorer(events, manifest);

    expect(result.items.map((item) => item.id)).toEqual([
      "release-2026",
      "release-2025",
      "release-1998",
    ]);
    expect(result.items[0]).toMatchObject({
      releaseSet: "2026",
      recordCount: 0,
      status: "pending",
    });
    expect(result.items[1]).toMatchObject({
      releaseSet: "2025",
      recordCount: 60,
      status: "indexed",
    });
    expect(result.items[2]).toMatchObject({
      releaseSet: null,
      recordCount: 0,
      status: "timeline_only",
    });
    expect(result.statusCounts).toEqual({
      indexed: 1,
      pending: 1,
      timeline_only: 1,
    });
  });

  it("filters by year, status, and topic", () => {
    expect(
      buildReleaseExplorer(events, manifest, { year: "2025" }).items.map(
        (item) => item.id,
      ),
    ).toEqual(["release-2025"]);
    expect(
      buildReleaseExplorer(events, manifest, { status: "pending" }).items.map(
        (item) => item.id,
      ),
    ).toEqual(["release-2026"]);
    expect(
      buildReleaseExplorer(events, manifest, { topic: "arrb-releases" }).items.map(
        (item) => item.id,
      ),
    ).toEqual(["release-2026", "release-1998"]);
  });

  it("normalizes status filters and exposes labels", () => {
    expect(normalizeReleaseStatusFilter("indexed")).toBe("indexed");
    expect(normalizeReleaseStatusFilter(" pending ")).toBe("pending");
    expect(normalizeReleaseStatusFilter("all")).toBeNull();
    expect(normalizeReleaseStatusFilter("unknown" as never)).toBeNull();
    expect(releaseStatusLabel("timeline_only")).toBe("Timeline only");
    expect(releaseStatusDescription("pending")).toContain("does not yet index");
  });
});

function releaseEvent(
  overrides: Partial<CaseTimelineEvent> & Pick<CaseTimelineEvent, "id" | "date">,
): CaseTimelineEvent {
  return {
    id: overrides.id,
    date: overrides.date,
    timeLocal: null,
    title: `Release ${overrides.date.slice(0, 4)}`,
    description: "Records were released.",
    category: "release",
    relatedEntityIds: overrides.relatedEntityIds ?? [],
    relatedTopicIds: overrides.relatedTopicIds ?? [],
    sourceExternal: overrides.sourceExternal ?? [],
    documentLinks: overrides.documentLinks ?? [],
    importance: overrides.importance ?? 3,
  };
}
