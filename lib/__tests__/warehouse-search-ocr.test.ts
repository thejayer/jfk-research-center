import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sqlUsesOcrTokenTable } from "../warehouse-search-sql";

const bqQuery = vi.fn(async (_options: {
  query: string;
  params: Record<string, unknown>;
}) => [[]]);
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    return { query: bqQuery };
  }),
}));

describe("warehouse OCR search", () => {
  beforeEach(() => {
    bqQuery.mockClear();
    vi.resetModules();
    vi.stubEnv("JFK_DATA_SOURCE", "bigquery");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips the OCR token query when only stopwords and short tokens remain", async () => {
    const { fetchSearch } = await import("../warehouse");
    await expect(fetchSearch({ query: "The and to", mode: "mention" }))
      .resolves.toMatchObject({ results: [], total: 0 });

    expect(bqQuery).toHaveBeenCalled();
    expect(
      bqQuery.mock.calls.some(([{ query }]) => sqlUsesOcrTokenTable(query)),
    ).toBe(false);
  });

  it("queries the OCR token table with only the filtered exact token parameters", async () => {
    const { fetchSearch } = await import("../warehouse");
    await fetchSearch({ query: "The Oswal and 1963", mode: "mention" });

    const lookups = bqQuery.mock.calls.filter(([{ query }]) =>
      sqlUsesOcrTokenTable(query),
    );
    expect(lookups).toHaveLength(1);
    const [[lookup]] = lookups;
    expect(lookup.query).toContain("token = @ocrTok0");
    expect(lookup.query).toContain("token = @ocrTok1");
    expect(lookup.params).toEqual({ ocrTok0: "oswal", ocrTok1: "1963" });
  });
});
