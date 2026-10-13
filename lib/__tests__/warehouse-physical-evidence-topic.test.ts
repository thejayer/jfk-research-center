import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bqQuery = vi.fn(async () => [[]]);
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    return { query: bqQuery };
  }),
}));

describe("physical-evidence topic (redirect-only)", () => {
  beforeEach(() => {
    bqQuery.mockClear();
    vi.resetModules();
    process.env.JFK_DATA_SOURCE = "bigquery";
  });

  it("fetchTopic returns null without querying BigQuery", async () => {
    const wh = await import("../warehouse");
    expect(wh.isMvpQueryableTopicSlug("physical-evidence")).toBe(false);
    await expect(wh.fetchTopic("physical-evidence")).resolves.toBeNull();
    const sql = bqQuery.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(sql).not.toMatch(/jfk_mvp[^"]*physical_evidence/);
    expect(bqQuery).not.toHaveBeenCalled();
  });

  it("fetchTopic guards on MVP_QUERYABLE_TOPIC_SLUGS before any query", () => {
    const src = readFileSync(new URL("../warehouse.ts", import.meta.url), "utf8");
    const start = src.indexOf("export async function fetchTopic(");
    const body = src.slice(start, src.indexOf("query<", start));
    expect(body).toContain("isMvpQueryableTopicSlug(slug)");
  });

  it("/topics skips detail fetch for non-queryable slugs", () => {
    const src = readFileSync(
      new URL("../../app/topics/page.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/isRedirectOnlyTopicSlug\(topic\.slug\)/);
  });
});
