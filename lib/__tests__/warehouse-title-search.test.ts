import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sqlUsesOcrTokenTable, TITLE_SEARCH_MAX_ROWS } from "../warehouse-search-sql";

const bqQuery = vi.fn<
  (options: { query: string; params: Record<string, unknown> }) =>
    Promise<[Record<string, unknown>[]]>
>();
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    return { query: bqQuery };
  }),
}));

function titleRow(
  documentId: string,
  agency: string | null,
  startDate: string | null,
  titleRank = 0,
  title = "FBI REPORT: MEXICO CITY",
) {
  return {
    document_id: documentId,
    naid: documentId,
    title,
    agency,
    start_date: startDate === null ? null : { value: startDate },
    title_rank: titleRank,
  };
}

type Group = {
  agency: string | null;
  start_year: number | null;
  match_count?: number;
  agency_selected_count?: number;
  year_selected_count?: number;
  selected_count: number;
  page_rows: ReturnType<typeof titleRow>[] | null;
};

function group(g: Group) {
  return {
    match_count: g.selected_count,
    agency_selected_count: g.selected_count,
    year_selected_count: g.selected_count,
    ...g,
  };
}

const titleSql = (options: { query: string }) => options.query.includes("@titleNorm");

describe("warehouse title search routing", () => {
  beforeEach(() => {
    bqQuery.mockReset().mockResolvedValue([[]]);
    vi.resetModules();
    vi.stubEnv("JFK_DATA_SOURCE", "bigquery");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses one title query with self-excluding agency and year facets", async () => {
    const { fetchSearch } = await import("../warehouse");
    // agencies=[CIA], years 1963..1964. Groups by agency x year:
    //   CIA 1963 (in years) 2, CIA 1970 (outside years) 1,
    //   FBI 1964 (in years) 3, FBI 1970 (outside years) 4.
    bqQuery.mockResolvedValueOnce([[
      group({
        agency: "CIA",
        start_year: 1963,
        agency_selected_count: 2,
        year_selected_count: 2,
        selected_count: 2,
        page_rows: [
          titleRow("104-10338-10005", "CIA", "1963-12-01"),
          titleRow("104-10338-10006", "CIA", "1963-01-01"),
        ],
      }),
      group({
        agency: "CIA",
        start_year: 1970,
        agency_selected_count: 1,
        year_selected_count: 0,
        selected_count: 0,
        page_rows: null,
      }),
      group({
        agency: "FBI",
        start_year: 1964,
        agency_selected_count: 0,
        year_selected_count: 3,
        selected_count: 0,
        page_rows: null,
      }),
      group({
        agency: "FBI",
        start_year: 1970,
        agency_selected_count: 0,
        year_selected_count: 0,
        selected_count: 0,
        page_rows: null,
      }),
    ]]);

    const result = await fetchSearch({
      query: "  FBI   REPORT: MEXICO CITY  ",
      mode: "document",
      filters: {
        agencies: ["CIA"],
        yearFrom: 1963,
        yearTo: 1964,
        entities: ["oswald"],
        topics: ["cia"],
        confidence: ["high"],
      },
      limit: 3,
    });

    expect(bqQuery).toHaveBeenCalledTimes(1);
    const [{ query, params }] = bqQuery.mock.calls[0];
    expect(query).toContain("STRPOS(");
    expect(query).toContain("GROUP BY agency, start_year");
    expect(query).toContain("entity_id IN UNNEST(@entities)");
    expect(query).toMatch(/r\.document_id IN \(SELECT document_id FROM `[^`]+\.jfk_mvp\.cia_docs`\)/);
    expect(query).toContain("LIMIT 3");
    expect(query).not.toContain("FALSE");
    expect(sqlUsesOcrTokenTable(query)).toBe(false);
    expect(params).toEqual({
      titleNorm: "fbi report: mexico city",
      agencies: ["CIA"],
      yearFrom: 1963,
      yearTo: 1964,
      entities: ["oswald"],
    });
    expect(result).toMatchObject({ mode: "document", total: 2 });
    expect(result.results).toMatchObject([
      { kind: "document", document: { id: "104-10338-10005", agency: "CIA" }, confidence: "high" },
      { kind: "document", document: { id: "104-10338-10006", agency: "CIA" }, confidence: "high" },
    ]);
    // Agency facet ignores the agency selection but respects the years;
    // year facet ignores the year selection but respects the agency.
    expect(result.filters.agencyCounts).toEqual({ CIA: 2, FBI: 3 });
    expect(result.filters.agencies).toEqual(["FBI", "CIA"]);
    expect(result.filters.yearCounts).toEqual({ "1963": 2, "1970": 1 });
    // Topic and entity counts are not computed on this path; selections stay.
    expect(result.filters).toMatchObject({
      countScope: "query",
      topics: ["cia"],
      topicCounts: {},
      entities: ["oswald"],
      entityCounts: {},
      confidence: ["high"],
      confidenceCounts: { high: 2 },
    });
  });

  it("finds a document-type phrase mid-title and ranks it after prefix matches", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      group({
        agency: "Church Committee",
        start_year: 1976,
        selected_count: 2,
        page_rows: [
          titleRow(
            "ps-church-memo",
            "Church Committee",
            "1976-06-23",
            2,
            "Final Report of the Select Committee — MEMORANDUM: The Investigation of the Assassination",
          ),
          titleRow(
            "prefix-hit",
            "Church Committee",
            "1976-01-01",
            1,
            "MEMORANDUM: The Investigation of the Assassination, addendum",
          ),
        ],
      }),
    ]]);

    const result = await fetchSearch({
      query: "MEMORANDUM: THE INVESTIGATION",
      mode: "document",
    });

    expect(bqQuery).toHaveBeenCalledTimes(1);
    const [{ query, params }] = bqQuery.mock.calls[0];
    expect(query).toContain("STRPOS(");
    expect(query).not.toMatch(/WHERE \(?LOWER\(REGEXP_REPLACE\(TRIM\(r\.title\)[^)]*\)\)\) = @titleNorm OR STARTS_WITH/);
    expect(params.titleNorm).toBe("memorandum: the investigation");
    expect(result.total).toBe(2);
    expect(
      result.results.map((hit) => hit.kind === "document" ? hit.document.id : hit.kind),
    ).toEqual(["prefix-hit", "ps-church-memo"]);
  });

  it("sorts candidates across groups by rank, date and id before the offset and limit", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      group({
        agency: "CIA",
        start_year: 1964,
        selected_count: 3,
        page_rows: [
          titleRow("07", "CIA", "1965-01-01"),
          titleRow("03", "CIA", "1964-01-01"),
          titleRow("05", "CIA", "1970-01-01", 1),
        ],
      }),
      group({
        agency: "FBI",
        start_year: 1964,
        selected_count: 2,
        page_rows: [
          titleRow("02", "FBI", "1964-01-01"),
          titleRow("01", "FBI", null, 2),
        ],
      }),
      group({
        agency: null,
        start_year: null,
        selected_count: 1,
        page_rows: [titleRow("00", null, null)],
      }),
    ]]);

    const result = await fetchSearch({
      query: "FBI REPORT: MEXICO CITY",
      mode: "document",
      offset: 1,
      limit: 4,
    });

    expect(result.total).toBe(6);
    expect(result.filters.agencyCounts).toEqual({ CIA: 3, FBI: 2 });
    expect(
      result.results.map((hit) => hit.kind === "document" ? hit.document.id : hit.kind),
    ).toEqual(["02", "03", "00", "05"]);
    expect(bqQuery).toHaveBeenCalledTimes(1);
  });

  it("keeps totals and facets when the offset is past the last match", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      group({
        agency: "CIA",
        start_year: null,
        selected_count: 1,
        page_rows: [titleRow("01", "CIA", null)],
      }),
    ]]);

    const result = await fetchSearch({
      query: "FBI REPORT: MEXICO CITY",
      mode: "document",
      offset: 2,
    });

    expect(result).toMatchObject({
      total: 1,
      results: [],
      filters: { agencyCounts: { CIA: 1 }, confidenceCounts: { high: 1 } },
    });
    expect(bqQuery).toHaveBeenCalledTimes(1);
  });

  it("clamps the total to the title row cap so every offered page can be served", async () => {
    const { fetchSearch } = await import("../warehouse");
    const matchesPerAgency = TITLE_SEARCH_MAX_ROWS;
    const rowsFor = (agency: string) =>
      Array.from({ length: TITLE_SEARCH_MAX_ROWS }, (_, index) =>
        titleRow(`${agency}-${String(index).padStart(4, "0")}`, agency, null),
      );
    const groups = ["CIA", "FBI"].map((agency) =>
      group({
        agency,
        start_year: null,
        selected_count: matchesPerAgency,
        page_rows: rowsFor(agency),
      }),
    );

    bqQuery.mockResolvedValueOnce([groups]);
    const lastPage = await fetchSearch({
      query: "FBI REPORT: MEXICO CITY",
      mode: "document",
      offset: TITLE_SEARCH_MAX_ROWS - 1,
      limit: 50,
    });
    expect(lastPage.total).toBe(TITLE_SEARCH_MAX_ROWS);
    expect(lastPage.results).toHaveLength(1);
    expect(lastPage.filters.confidenceCounts).toEqual({ high: TITLE_SEARCH_MAX_ROWS });

    bqQuery.mockResolvedValueOnce([groups]);
    const pastCap = await fetchSearch({
      query: "FBI REPORT: MEXICO CITY",
      mode: "document",
      offset: TITLE_SEARCH_MAX_ROWS,
      limit: 1,
    });
    expect(pastCap).toMatchObject({ total: TITLE_SEARCH_MAX_ROWS, results: [] });
  });

  it("returns a title miss without falling back", async () => {
    const { fetchSearch } = await import("../warehouse");
    const result = await fetchSearch({
      query: "AIRGRAM: MISSING TITLE",
      mode: "document",
    });
    expect(result).toMatchObject({ total: 0, results: [] });
    expect(bqQuery).toHaveBeenCalledTimes(1);
    expect(bqQuery.mock.calls[0][0].query).toContain("@titleNorm");
  });

  it("hides title matches under a confidence filter without high but still counts them", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      group({
        agency: "CIA",
        start_year: 1964,
        selected_count: 2,
        page_rows: [titleRow("01", "CIA", "1964-01-01"), titleRow("02", "CIA", "1964-02-01")],
      }),
    ]]);
    const result = await fetchSearch({
      query: "MEMO: OSWALD",
      mode: "document",
      filters: { confidence: ["medium"] },
    });
    expect(result).toMatchObject({ total: 0, results: [] });
    expect(result.filters).toMatchObject({
      confidence: ["high"],
      confidenceCounts: { high: 2 },
      agencyCounts: {},
      yearCounts: {},
    });
    expect(bqQuery).toHaveBeenCalledTimes(1);
    expect(bqQuery.mock.calls[0][0].query).not.toContain("FALSE");
  });

  it.each([
    { query: "oswald", mode: "document" },
    { query: "memo: oswald", mode: "document" },
    { query: "WHO WAS OSWALD: a profile", mode: "document" },
    { query: "MEMO: OSWALD", mode: "mention" },
  ] as const)("keeps OCR lookup for $mode search with $query", async (input) => {
    const { fetchSearch } = await import("../warehouse");
    await fetchSearch(input);
    const sql = bqQuery.mock.calls.map(([options]) => options.query);
    expect(sql.some(sqlUsesOcrTokenTable)).toBe(true);
    expect(sql.every((query) => !query.includes("@titleNorm"))).toBe(true);
  });
});

describe("search cache with title routing", () => {
  beforeEach(() => {
    bqQuery.mockReset().mockResolvedValue([[]]);
    vi.resetModules();
    vi.stubEnv("JFK_DATA_SOURCE", "bigquery");
    vi.stubEnv("JFK_SEARCH_CACHE_DISABLED", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { first: "AIRGRAM: OSWALD", second: "AIRgram: OSWALD" },
    { first: "AIRgram: OSWALD", second: "AIRGRAM: OSWALD" },
  ])("does not serve $second from the cached $first result", async ({ first, second }) => {
    const { clearSearchCacheForTests } = await import("../search-cache");
    clearSearchCacheForTests();
    const { fetchSearch } = await import("../warehouse");
    const isTitle = (query: string) => query === "AIRGRAM: OSWALD";

    await fetchSearch({ query: first, mode: "document" });
    const firstCalls = bqQuery.mock.calls.length;
    expect(firstCalls).toBeGreaterThan(0);
    expect(bqQuery.mock.calls.some(([options]) => titleSql(options))).toBe(isTitle(first));

    // Same query again is a cache hit.
    await fetchSearch({ query: first, mode: "document" });
    expect(bqQuery.mock.calls.length).toBe(firstCalls);

    await fetchSearch({ query: second, mode: "document" });
    const secondCalls = bqQuery.mock.calls.slice(firstCalls);
    expect(secondCalls.length).toBeGreaterThan(0);
    if (isTitle(second)) {
      expect(secondCalls).toHaveLength(1);
      expect(titleSql(secondCalls[0][0])).toBe(true);
    } else {
      expect(secondCalls.some(([options]) => sqlUsesOcrTokenTable(options.query))).toBe(true);
      expect(secondCalls.every(([options]) => !titleSql(options))).toBe(true);
    }
  });
});
