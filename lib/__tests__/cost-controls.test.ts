import { describe, expect, it } from "vitest";
import {
  isBlockedCrawlerUserAgent,
  isCostSensitivePath,
  isSemanticSearchDisabled,
  readBigQueryMaximumBytesBilled,
} from "../cost-controls";

describe("cost controls", () => {
  it("marks live search and document routes as cost-sensitive", () => {
    expect(isCostSensitivePath("/search")).toBe(true);
    expect(isCostSensitivePath("/api/search")).toBe(true);
    expect(isCostSensitivePath("/document/wc-report-1964")).toBe(true);
    expect(isCostSensitivePath("/api/document/wc-report-1964")).toBe(true);
    expect(isCostSensitivePath("/about")).toBe(false);
  });

  it("detects crawlers that should not trigger warehouse-backed routes", () => {
    expect(isBlockedCrawlerUserAgent("GPTBot/1.4")).toBe(true);
    expect(isBlockedCrawlerUserAgent("ClaudeBot/1.0")).toBe(true);
    expect(isBlockedCrawlerUserAgent("Mozilla/5.0 Bytespider")).toBe(true);
    expect(isBlockedCrawlerUserAgent("Mozilla/5.0 Safari/605.1.15")).toBe(false);
    expect(isBlockedCrawlerUserAgent(null)).toBe(false);
  });

  it("reads semantic kill switch state", () => {
    expect(isSemanticSearchDisabled({ JFK_API_DISABLE_SEMANTIC_SEARCH: "1" })).toBe(
      true,
    );
    expect(isSemanticSearchDisabled({ JFK_API_DISABLE_SEMANTIC_SEARCH: "0" })).toBe(
      false,
    );
  });

  it("defaults BigQuery jobs to a bounded maximum bytes billed value", () => {
    expect(readBigQueryMaximumBytesBilled({})).toBe(String(256 * 1024 * 1024));
    expect(readBigQueryMaximumBytesBilled({ JFK_BQ_MAX_BYTES_BILLED: "1048576" }))
      .toBe("1048576");
    expect(readBigQueryMaximumBytesBilled({ JFK_BQ_MAX_BYTES_BILLED: "0" })).toBe(
      String(256 * 1024 * 1024),
    );
    expect(readBigQueryMaximumBytesBilled({ JFK_BQ_MAX_BYTES_BILLED: "nope" }))
      .toBe(String(256 * 1024 * 1024));
  });
});
