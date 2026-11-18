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
  exactTitle = true,
) {
  return {
    document_id: documentId,
    naid: documentId,
    title: exactTitle ? "FBI REPORT: MEXICO CITY" : "FBI REPORT: MEXICO CITY ADDENDUM",
    agency,
    start_date: startDate === null ? null : { value: startDate },
    exact_title: exactTitle,
  };
}

describe("warehouse title search routing", () => {
  beforeEach(() => {
    bqQuery.mockReset().mockResolvedValue([[]]);
    vi.resetModules();
    vi.stubEnv("JFK_DATA_SOURCE", "bigquery");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses one title query and counts all agencies while returning only the selected agency", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      {
        agency: "CIA",
        agency_count: 2,
        selected_count: 2,
        page_rows: [
          titleRow("104-10338-10005", "CIA", "1964-01-01"),
          titleRow("104-10338-10006", "CIA", "1963-01-01"),
        ],
      },
      { agency: "FBI", agency_count: 3, selected_count: 0, page_rows: null },
    ]]);

    const result = await fetchSearch({
      query: "  FBI   REPORT: MEXICO CITY  ",
      mode: "document",
      filters: {
        agencies: ["CIA"],
        yearFrom: 1963,
        yearTo: 1965,
        entities: ["oswald"],
        topics: ["cia"],
        confidence: ["high"],
      },
      limit: 3,
    });

    expect(bqQuery).toHaveBeenCalledTimes(1);
    const [{ query, params }] = bqQuery.mock.calls[0];
    expect(query).toContain("COUNTIF(r.agency IN UNNEST(@agencies)) AS selected_count");
    expect(query).toContain("EXTRACT(YEAR FROM r.start_date) >= @yearFrom");
    expect(query).toContain("EXTRACT(YEAR FROM r.start_date) <= @yearTo");
    expect(query).toContain("entity_id IN UNNEST(@entities)");
    expect(query).toMatch(/r\.document_id IN \(SELECT document_id FROM `[^`]+\.jfk_mvp\.cia_docs`\)/);
    expect(query).toContain("LIMIT 3");
    expect(sqlUsesOcrTokenTable(query)).toBe(false);
    expect(params).toEqual({
      titleNorm: "fbi report: mexico city",
      agencies: ["CIA"],
      yearFrom: 1963,
      yearTo: 1965,
      entities: ["oswald"],
    });
    expect(result).toMatchObject({ mode: "document", total: 2 });
    expect(result.results).toMatchObject([
      { kind: "document", document: { id: "104-10338-10005", agency: "CIA" }, confidence: "high" },
      { kind: "document", document: { id: "104-10338-10006", agency: "CIA" }, confidence: "high" },
    ]);
    expect(result.filters).toMatchObject({
      countScope: "query",
      agencies: ["CIA", "FBI"],
      agencyCounts: { CIA: 2, FBI: 3 },
      yearCounts: {},
      entityCounts: { oswald: 2 },
      topicCounts: { cia: 2 },
      confidenceCounts: { high: 2 },
    });
  });

  it("sorts candidates across agencies before applying the offset and limit", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      {
        agency: "CIA",
        agency_count: 3,
        selected_count: 3,
        page_rows: [
          titleRow("07", "CIA", "1965-01-01"),
          titleRow("03", "CIA", "1964-01-01"),
          titleRow("05", "CIA", "1970-01-01", false),
        ],
      },
      {
        agency: "FBI",
        agency_count: 2,
        selected_count: 2,
        page_rows: [
          titleRow("02", "FBI", "1964-01-01"),
          titleRow("01", "FBI", null, false),
        ],
      },
      {
        agency: null,
        agency_count: 1,
        selected_count: 1,
        page_rows: [titleRow("00", null, null)],
      },
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
      {
        agency: "CIA",
        agency_count: 1,
        selected_count: 1,
        page_rows: [titleRow("01", "CIA", null)],
      },
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

  it("keeps the total when pagination reaches the title row cap", async () => {
    const { fetchSearch } = await import("../warehouse");
    const rowsPerAgency = Math.ceil((TITLE_SEARCH_MAX_ROWS + 1) / 2);
    bqQuery.mockResolvedValueOnce([["CIA", "FBI"].map((agency) => ({
      agency,
      agency_count: rowsPerAgency,
      selected_count: rowsPerAgency,
      page_rows: Array.from({ length: rowsPerAgency }, (_, index) =>
        titleRow(`${agency}-${String(index).padStart(4, "0")}`, agency, null),
      ),
    }))]);

    const result = await fetchSearch({
      query: "FBI REPORT: MEXICO CITY",
      mode: "document",
      offset: TITLE_SEARCH_MAX_ROWS,
      limit: 1,
    });

    expect(result).toMatchObject({ total: rowsPerAgency * 2, results: [] });
    expect(bqQuery).toHaveBeenCalledTimes(1);
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

  it("excludes title matches when the confidence filter omits high", async () => {
    const { fetchSearch } = await import("../warehouse");
    const result = await fetchSearch({
      query: "MEMO: OSWALD",
      mode: "document",
      filters: { confidence: ["medium"] },
    });
    expect(result).toMatchObject({ total: 0, results: [] });
    expect(bqQuery).toHaveBeenCalledTimes(1);
    expect(bqQuery.mock.calls[0][0].query).toContain("AND FALSE");
  });

  it.each([
    { query: "oswald", mode: "document" },
    { query: "MEMO: OSWALD", mode: "mention" },
  ] as const)("keeps OCR lookup for $mode search with $query", async (input) => {
    const { fetchSearch } = await import("../warehouse");
    await fetchSearch(input);
    const sql = bqQuery.mock.calls.map(([options]) => options.query);
    expect(sql.some(sqlUsesOcrTokenTable)).toBe(true);
    expect(sql.every((query) => !query.includes("@titleNorm"))).toBe(true);
  });
});
