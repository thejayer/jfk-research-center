import { describe, expect, it } from "vitest";
import {
  MASTHEAD_FALLBACK_RELEASE_NOTE,
  MASTHEAD_STATUS_NOTE,
  documentSearchCoverageSentence,
  formatIndexedReleases,
  mastheadReleaseNote,
  mentionSearchCoverageSentence,
  methodologyPendingLimitation,
  ocrCoverageSentence,
  ocrSearchLimitationSentence,
  pendingReleasesSentence,
  searchEmptyBody,
  searchModeCoverageSentence,
  withCoverageNote,
} from "../corpus-coverage";

const liveLike = {
  totalRecords: 37141,
  recordsWithOcr: 2165,
  releasesIndexed: ["2017-2018", "2021", "2022", "2023", "2025"],
  releasesPending: ["2026"],
};

describe("corpus coverage copy", () => {
  it("lists only the releases the manifest marks as indexed", () => {
    expect(formatIndexedReleases(liveLike.releasesIndexed)).toBe(
      "2017-2018, 2021, 2022, 2023, 2025",
    );
    expect(mastheadReleaseNote(liveLike)).toBe(
      "Releases 2017-2018, 2021, 2022, 2023, 2025",
    );
    expect(mastheadReleaseNote(liveLike)).not.toMatch(/2026/);
    expect(mastheadReleaseNote(null)).toBe(MASTHEAD_FALLBACK_RELEASE_NOTE);
    expect(mastheadReleaseNote({ releasesIndexed: [] })).toBe(
      MASTHEAD_FALLBACK_RELEASE_NOTE,
    );
    expect(MASTHEAD_STATUS_NOTE).toBe("OCR partial");
    expect(MASTHEAD_STATUS_NOTE.toLowerCase()).not.toContain("live");
  });

  it("states OCR coverage as a fraction of the same indexed-record count", () => {
    expect(ocrCoverageSentence(liveLike)).toBe(
      "Full-text OCR covers 2,165 of 37,141 indexed records (the ABBYY subset).",
    );
    expect(ocrSearchLimitationSentence(liveLike)).toContain("2,165");
    expect(ocrSearchLimitationSentence(liveLike)).toMatch(
      /not that the record is absent from NARA/,
    );
    expect(withCoverageNote(liveLike).coverageNote).toBe(
      ocrCoverageSentence(liveLike),
    );
  });

  it("keeps search empty-state and mode chrome on the same numbers", () => {
    expect(searchEmptyBody({ hasQuery: false, mode: "document", manifest: liveLike })).toBe(
      "Full-text OCR covers 2,165 of 37,141 indexed records (the ABBYY subset). Passage and mention search only run against that OCR subset.",
    );
    expect(
      searchEmptyBody({ hasQuery: true, mode: "mention", manifest: liveLike }),
    ).toBe(mentionSearchCoverageSentence(liveLike));
    expect(
      searchEmptyBody({ hasQuery: true, mode: "document", manifest: liveLike }),
    ).toContain("A title miss searches the whole index");
    expect(searchModeCoverageSentence({ mode: "document", manifest: liveLike })).toBe(
      documentSearchCoverageSentence(liveLike),
    );
    expect(searchModeCoverageSentence({ mode: "semantic", manifest: liveLike })).toBe(
      mentionSearchCoverageSentence(liveLike),
    );
  });

  it("names pending releases without claiming they are indexed", () => {
    expect(pendingReleasesSentence(liveLike)).toBe(
      "Releases not yet indexed: 2026.",
    );
    expect(methodologyPendingLimitation(liveLike)).toBe(
      "Releases not yet indexed: 2026. Those years are not searchable here.",
    );
    expect(methodologyPendingLimitation(liveLike)).not.toMatch(
      /will (be )?(OCR|ingest)/i,
    );
    expect(methodologyPendingLimitation({ releasesPending: [] })).toBe("");
  });

  it("does not hardcode a conflicting OCR unique-RIF count", () => {
    const other = {
      ...liveLike,
      totalRecords: 99,
      recordsWithOcr: 7,
    };
    expect(ocrCoverageSentence(other)).toBe(
      "Full-text OCR covers 7 of 99 indexed records (the ABBYY subset).",
    );
    expect(ocrCoverageSentence(other)).not.toContain("2,162");
    expect(ocrCoverageSentence(other)).not.toContain("2,176");
  });
});
