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

  it("parses yearFrom/yearTo as numbers", () => {
    const r = parseSearchParams({ yearFrom: "1960", yearTo: "1975" });
    expect(r.filters.yearFrom).toBe(1960);
    expect(r.filters.yearTo).toBe(1975);
  });

  it("leaves yearFrom/yearTo null when absent or unparseable", () => {
    const r1 = parseSearchParams({});
    expect(r1.filters.yearFrom).toBeNull();
    expect(r1.filters.yearTo).toBeNull();
    const r2 = parseSearchParams({ yearFrom: "garbage" });
    expect(r2.filters.yearFrom).toBeNull();
  });

  it("keeps only the first q if an array is passed", () => {
    const r = parseSearchParams({ q: ["first", "second"] });
    expect(r.q).toBe("first");
  });

  it("defaults page to 1 and parses page as int", () => {
    expect(parseSearchParams({}).page).toBe(1);
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
  });

  it("clamps page=0 / negative / garbage to 1", () => {
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSearchParams({ page: "-2" }).page).toBe(1);
    expect(parseSearchParams({ page: "garbage" }).page).toBe(1);
  });
});

describe("buildSearchUrl", () => {
  const emptyFilters = {
    agency: [],
    yearFrom: null,
    yearTo: null,
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

  it("serializes yearFrom/yearTo when set", () => {
    const url = buildSearchUrl("x", "document", {
      ...emptyFilters,
      yearFrom: 1963,
      yearTo: 1978,
    });
    expect(url).toContain("yearFrom=1963");
    expect(url).toContain("yearTo=1978");
  });

  it("omits yearFrom/yearTo when null", () => {
    const url = buildSearchUrl("x", "document", emptyFilters);
    expect(url).not.toContain("yearFrom");
    expect(url).not.toContain("yearTo");
  });

  it("omits page=1 but serializes page>1", () => {
    expect(buildSearchUrl("x", "document", emptyFilters, 1)).not.toContain(
      "page=",
    );
    expect(buildSearchUrl("x", "document", emptyFilters, 3)).toContain(
      "page=3",
    );
  });

  it("round-trips through parseSearchParams", () => {
    const url = buildSearchUrl("Oswald", "mention", {
      agency: ["CIA"],
      yearFrom: 1963,
      yearTo: 1978,
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
      yearFrom: bag.yearFrom?.[0],
      yearTo: bag.yearTo?.[0],
      entity: bag.entity,
      topic: bag.topic,
      confidence: bag.confidence,
    });
    expect(parsed.q).toBe("Oswald");
    expect(parsed.mode).toBe("mention");
    expect(parsed.filters.agency).toEqual(["CIA"]);
    expect(parsed.filters.yearFrom).toBe(1963);
    expect(parsed.filters.yearTo).toBe(1978);
    expect(parsed.filters.confidence).toEqual(["high", "medium"]);
  });
});

describe("toggleFilter", () => {
  const baseline = {
    agency: ["CIA"],
    yearFrom: null,
    yearTo: null,
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
    expect(next.yearFrom).toBe(baseline.yearFrom);
    expect(next.entity).toBe(baseline.entity);
  });
});

describe("hasAnyFilter", () => {
  const empty = {
    agency: [],
    yearFrom: null,
    yearTo: null,
    entity: [],
    topic: [],
    confidence: [] as ("high" | "medium" | "low" | "none")[],
  };

  it("is false when all filters are empty", () => {
    expect(hasAnyFilter(empty)).toBe(false);
  });

  it("is true when a list filter has entries", () => {
    expect(
      hasAnyFilter({ ...empty, confidence: ["high"] }),
    ).toBe(true);
  });

  it("is true when only yearFrom is set", () => {
    expect(hasAnyFilter({ ...empty, yearFrom: 1963 })).toBe(true);
  });

  it("is true when only yearTo is set", () => {
    expect(hasAnyFilter({ ...empty, yearTo: 1978 })).toBe(true);
  });
});
