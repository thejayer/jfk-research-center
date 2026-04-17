import { describe, it, expect } from "vitest";
import {
  parseSearchParams,
  buildSearchUrl,
  toggleFilter,
  hasAnyFilter,
} from "../search";

describe("parseSearchParams", () => {
  it("defaults to document mode with no filters", () => {
    const r = parseSearchParams({});
    expect(r.q).toBe("");
    expect(r.mode).toBe("document");
    expect(hasAnyFilter(r.filters)).toBe(false);
  });

  it("reads q and mention mode", () => {
    const r = parseSearchParams({ q: "Kostikov", mode: "mention" });
    expect(r.q).toBe("Kostikov");
    expect(r.mode).toBe("mention");
  });

  it("treats unknown modes as document", () => {
    expect(parseSearchParams({ mode: "garbage" }).mode).toBe("document");
  });

  it("accepts repeated filter values as an array", () => {
    const r = parseSearchParams({ agency: ["CIA", "FBI"] });
    expect(r.filters.agency).toEqual(["CIA", "FBI"]);
  });

  it("splits a comma-list when next.js collapses repeats", () => {
    const r = parseSearchParams({ confidence: "high,low" });
    expect(r.filters.confidence).toEqual(["high", "low"]);
  });

  it("keeps only the first q if an array is passed", () => {
    const r = parseSearchParams({ q: ["first", "second"] });
    expect(r.q).toBe("first");
  });
});

describe("buildSearchUrl", () => {
  const emptyFilters = {
    agency: [],
    year: [],
    entity: [],
    topic: [],
    confidence: [],
  };

  it("returns /search when nothing is set", () => {
    expect(buildSearchUrl("", "document", emptyFilters)).toBe("/search");
  });

  it("serializes q", () => {
    expect(buildSearchUrl("Kostikov", "document", emptyFilters)).toBe(
      "/search?q=Kostikov",
    );
  });

  it("omits mode=document (the default) but keeps mention", () => {
    expect(buildSearchUrl("x", "document", emptyFilters)).not.toContain("mode=");
    expect(buildSearchUrl("x", "mention", emptyFilters)).toContain("mode=mention");
  });

  it("appends repeated filter keys instead of comma-joining", () => {
    const url = buildSearchUrl("x", "document", {
      ...emptyFilters,
      agency: ["CIA", "FBI"],
    });
    const params = new URL(`http://x${url}`).searchParams.getAll("agency");
    expect(params).toEqual(["CIA", "FBI"]);
  });

  it("round-trips through parseSearchParams", () => {
    const url = buildSearchUrl("Oswald", "mention", {
      agency: ["CIA"],
      year: ["1963"],
      entity: ["oswald"],
      topic: ["mexico-city"],
      confidence: ["high", "medium"],
    });
    const qs = url.split("?")[1]!;
    const bag: Record<string, string[]> = {};
    for (const [k, v] of new URLSearchParams(qs)) {
      (bag[k] ??= []).push(v);
    }
    const parsed = parseSearchParams({
      q: bag.q?.[0],
      mode: bag.mode?.[0],
      agency: bag.agency,
      year: bag.year,
      entity: bag.entity,
      topic: bag.topic,
      confidence: bag.confidence,
    });
    expect(parsed.q).toBe("Oswald");
    expect(parsed.mode).toBe("mention");
    expect(parsed.filters.agency).toEqual(["CIA"]);
    expect(parsed.filters.confidence).toEqual(["high", "medium"]);
  });
});

describe("toggleFilter", () => {
  const baseline = {
    agency: ["CIA"],
    year: [] as string[],
    entity: [] as string[],
    topic: [] as string[],
    confidence: [] as ("high" | "medium" | "low" | "none")[],
  };

  it("adds when absent", () => {
    expect(toggleFilter(baseline, "agency", "FBI").agency).toEqual(["CIA", "FBI"]);
  });

  it("removes when present", () => {
    expect(toggleFilter(baseline, "agency", "CIA").agency).toEqual([]);
  });

  it("leaves other keys untouched", () => {
    const next = toggleFilter(baseline, "agency", "FBI");
    expect(next.year).toBe(baseline.year);
    expect(next.entity).toBe(baseline.entity);
  });
});

describe("hasAnyFilter", () => {
  it("is false when all arrays are empty", () => {
    expect(
      hasAnyFilter({
        agency: [],
        year: [],
        entity: [],
        topic: [],
        confidence: [],
      }),
    ).toBe(false);
  });

  it("is true when any filter has entries", () => {
    expect(
      hasAnyFilter({
        agency: [],
        year: [],
        entity: [],
        topic: [],
        confidence: ["high"],
      }),
    ).toBe(true);
  });
});
