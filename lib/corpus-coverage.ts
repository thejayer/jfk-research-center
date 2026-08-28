import type { CorpusManifest } from "./api-types";
import { formatNumber } from "./format";

/**
 * Copy helpers for OCR and release-scope disclosure.
 *
 * Every user-facing coverage sentence should go through these functions so
 * the masthead, search chrome, and about pages stay locked to the same
 * `corpusManifest` fields the homepage counters already use.
 */
export type CorpusCoverageStats = Pick<
  CorpusManifest,
  "totalRecords" | "recordsWithOcr" | "releasesIndexed" | "releasesPending"
>;

export const MASTHEAD_STATUS_NOTE = "OCR partial";
export const MASTHEAD_FALLBACK_RELEASE_NOTE = "NARA subset";

export function formatIndexedReleases(releasesIndexed: string[]): string {
  return releasesIndexed.filter(Boolean).join(", ");
}

export function mastheadReleaseNote(
  manifest: Pick<CorpusManifest, "releasesIndexed"> | null | undefined,
): string {
  const label = formatIndexedReleases(manifest?.releasesIndexed ?? []);
  return label ? `Releases ${label}` : MASTHEAD_FALLBACK_RELEASE_NOTE;
}

export function ocrCoverageSentence(manifest: CorpusCoverageStats): string {
  return `Full-text OCR covers ${formatNumber(manifest.recordsWithOcr)} of ${formatNumber(manifest.totalRecords)} indexed records (the ABBYY subset).`;
}

export function ocrSearchLimitationSentence(
  manifest: CorpusCoverageStats,
): string {
  return `Mention and full-text search only cover those ${formatNumber(manifest.recordsWithOcr)} records. A miss can mean the text is not indexed, not that the record is absent from NARA.`;
}

export function documentSearchCoverageSentence(
  manifest: CorpusCoverageStats,
): string {
  return `${ocrCoverageSentence(manifest)} Titles and descriptions cover the full indexed subset.`;
}

export function mentionSearchCoverageSentence(
  manifest: CorpusCoverageStats,
): string {
  return `${ocrCoverageSentence(manifest)} ${ocrSearchLimitationSentence(manifest)}`;
}

export function searchEmptyBody({
  hasQuery,
  mode,
  manifest,
}: {
  hasQuery: boolean;
  mode: "document" | "mention" | "semantic";
  manifest: CorpusCoverageStats;
}): string {
  if (!hasQuery) {
    return `${ocrCoverageSentence(manifest)} Passage and mention search only run against that OCR subset.`;
  }
  if (mode === "mention" || mode === "semantic") {
    return mentionSearchCoverageSentence(manifest);
  }
  return `${ocrCoverageSentence(manifest)} A title miss searches the whole index; a passage miss can be coverage, not absence from NARA.`;
}

export function searchModeCoverageSentence({
  mode,
  manifest,
}: {
  mode: "document" | "mention" | "semantic";
  manifest: CorpusCoverageStats;
}): string {
  if (mode === "mention" || mode === "semantic") {
    return mentionSearchCoverageSentence(manifest);
  }
  return documentSearchCoverageSentence(manifest);
}

export function pendingReleasesSentence(
  manifest: Pick<CorpusManifest, "releasesPending">,
): string {
  if (manifest.releasesPending.length === 0) return "";
  return `Releases not yet indexed: ${manifest.releasesPending.join(", ")}.`;
}

export function methodologyPendingLimitation(
  manifest: Pick<CorpusManifest, "releasesPending">,
): string {
  const pending = pendingReleasesSentence(manifest);
  if (!pending) return "";
  return `${pending} Those years are not searchable here.`;
}

export function withCoverageNote<T extends CorpusCoverageStats>(
  manifest: T,
): T & { coverageNote: string } {
  return {
    ...manifest,
    coverageNote: ocrCoverageSentence(manifest),
  };
}
