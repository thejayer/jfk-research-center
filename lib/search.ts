/**
 * Lightweight client-side/server-side helpers for /search.
 *
 * The API route handles actual querying; this file contains small utilities
 * that the page uses to parse query strings and highlight hits.
 */

import type { ConfidenceLevel } from "./api-types";

export type SearchMode = "document" | "mention";

export type ParsedSearch = {
  q: string;
  mode: SearchMode;
  filters: {
    agency: string[];
    /** Event-date range (inclusive, from start_date); null means unbounded. */
    yearFrom: number | null;
    yearTo: number | null;
    entity: string[];
    topic: string[];
    confidence: ConfidenceLevel[];
  };
};

type ListFilterKey = "agency" | "entity" | "topic" | "confidence";

function multi(
  v: string | string[] | undefined,
): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  // Next.js collapses repeated query keys into a comma list sometimes; support both
  return v.split(",").filter(Boolean);
}

function singleInt(v: string | string[] | undefined): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ParsedSearch {
  const qRaw = searchParams.q;
  const modeRaw = searchParams.mode;

  const q = Array.isArray(qRaw) ? (qRaw[0] ?? "") : (qRaw ?? "");
  const mode: SearchMode =
    (Array.isArray(modeRaw) ? modeRaw[0] : modeRaw) === "mention"
      ? "mention"
      : "document";

  return {
    q,
    mode,
    filters: {
      agency: multi(searchParams.agency),
      yearFrom: singleInt(searchParams.yearFrom),
      yearTo: singleInt(searchParams.yearTo),
      entity: multi(searchParams.entity),
      topic: multi(searchParams.topic),
      confidence: multi(searchParams.confidence) as ConfidenceLevel[],
    },
  };
}

export function buildSearchUrl(
  q: string,
  mode: SearchMode,
  filters: ParsedSearch["filters"] = emptyFilters(),
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (mode !== "document") params.set("mode", mode);
  for (const key of ["agency", "entity", "topic", "confidence"] as const) {
    for (const v of filters[key]) params.append(key, v);
  }
  if (filters.yearFrom !== null) params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo !== null) params.set("yearTo", String(filters.yearTo));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function emptyFilters(): ParsedSearch["filters"] {
  return {
    agency: [],
    yearFrom: null,
    yearTo: null,
    entity: [],
    topic: [],
    confidence: [],
  };
}

export function toggleFilter(
  filters: ParsedSearch["filters"],
  key: ListFilterKey,
  value: string,
): ParsedSearch["filters"] {
  const current = filters[key] as string[];
  const exists = current.includes(value);
  const next = exists
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...filters, [key]: next };
}

export function hasAnyFilter(f: ParsedSearch["filters"]): boolean {
  if (
    f.agency.length +
      f.entity.length +
      f.topic.length +
      f.confidence.length >
    0
  ) {
    return true;
  }
  return f.yearFrom !== null || f.yearTo !== null;
}
