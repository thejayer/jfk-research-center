import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sqlUsesOcrTokenTable } from "../warehouse-search-sql";

const bqQuery = vi.fn<
  (options: { query: string; params: Record<string, unknown> }) =>
    Promise<[Record<string, unknown>[]]>
>();
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    return { query: bqQuery };
  }),
}));

describe("warehouse title search routing", () => {
  beforeEach(() => {
    bqQuery.mockReset().mockResolvedValue([[]]);
    vi.resetModules();
    vi.stubEnv("JFK_DATA_SOURCE", "bigquery");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a single title query with metadata filters and builds facets from the result", async () => {
    const { fetchSearch } = await import("../warehouse");
    bqQuery.mockResolvedValueOnce([[
      {
        document_id: "104-10338-10005",
        naid: "123456789",
        title: "FBI REPORT: MEXICO CITY",
        agency: "FBI",
        total_count: 4,
      },
    ]]);

    const result = await fetchSearch({
      query: "  FBI   REPORT: MEXICO CITY  ",
      mode: "document",
      filters: {
        agencies: ["FBI"],
        yearFrom: 1963,
        yearTo: 1965,
        entities: ["oswald"],
        topics: ["cia"],
        confidence: ["high"],
      },
      limit: 3,
      offset: 3,
    });

    expect(bqQuery).toHaveBeenCalledTimes(1);
    const [{ query, params }] = bqQuery.mock.calls[0];
    expect(query).toContain("STARTS_WITH(LOWER(r.title), @titleNorm)");
    expect(query).toContain("r.agency IN UNNEST(@agencies)");
    expect(query).toContain("EXTRACT(YEAR FROM r.start_date) >= @yearFrom");
    expect(query).toContain("EXTRACT(YEAR FROM r.start_date) <= @yearTo");
    expect(query).toContain("entity_id IN UNNEST(@entities)");
    expect(query).toMatch(/r\.document_id IN \(SELECT document_id FROM `[^`]+\.jfk_mvp\.cia_docs`\)/);
    expect(query).toContain("LIMIT 3 OFFSET 3");
    expect(sqlUsesOcrTokenTable(query)).toBe(false);
    expect(params).toEqual({
      titleNorm: "fbi report: mexico city",
      agencies: ["FBI"],
      yearFrom: 1963,
      yearTo: 1965,
      entities: ["oswald"],
    });
    expect(result.total).toBe(4);
    expect(result.results).toMatchObject([
      { kind: "document", document: { id: "104-10338-10005" }, confidence: "high" },
    ]);
    expect(result.filters).toMatchObject({
      countScope: "query",
      agencyCounts: { FBI: 1 },
      entityCounts: { oswald: 4 },
      topicCounts: { cia: 4 },
      confidenceCounts: { high: 4 },
    });
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
