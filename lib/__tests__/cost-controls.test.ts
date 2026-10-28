import { describe, expect, it } from "vitest";
import {
  classifyCostTrafficUserAgent,
  isAllowedSearchBotUserAgent,
  isArchiveIdentifierQuery,
  isBlockedCrawlerUserAgent,
  isCostSensitivePath,
  isDocumentWarehousePath,
  isPubliclyCacheableCostApi,
  isLegacyMobileAutomationUserAgent,
  readAutomatedTrafficBlockReason,
  isSemanticSearchDisabled,
  readBigQueryMaximumBytesBilled,
  readCostRateLimitRule,
  shouldBlockUnknownDocumentTraffic,
} from "../cost-controls";

describe("cost controls", () => {
  it("marks live search and document routes as cost-sensitive", () => {
    expect(isCostSensitivePath("/search")).toBe(true);
    expect(isCostSensitivePath("/api/search")).toBe(true);
    expect(isCostSensitivePath("/document/wc-report-1964")).toBe(true);
    expect(isCostSensitivePath("/api/document/wc-report-1964")).toBe(true);
    expect(isCostSensitivePath("/api/document/104-10086-10152/ocr")).toBe(true);
    expect(isCostSensitivePath("/api/v1/documents")).toBe(true);
    expect(isCostSensitivePath("/api/v1/search/semantic")).toBe(true);
    expect(isCostSensitivePath("/api/entity/oswald")).toBe(true);
    expect(isCostSensitivePath("/entity/oswald")).toBe(true);
    expect(isCostSensitivePath("/about")).toBe(false);
    expect(isDocumentWarehousePath("/document/104-10004-10143")).toBe(true);
    expect(isDocumentWarehousePath("/api/document/104-10004-10143/ocr")).toBe(
      true,
    );
    expect(isDocumentWarehousePath("/api/entity/oswald")).toBe(false);
  });

  it("lets public document JSON share a CDN cache without touching admin routes", () => {
    expect(isPubliclyCacheableCostApi("/api/search")).toBe(true);
    expect(isPubliclyCacheableCostApi("/api/document/124-10190-10075")).toBe(
      true,
    );
    expect(isPubliclyCacheableCostApi("/api/document/124-10190-10075/ocr")).toBe(
      true,
    );
    expect(isPubliclyCacheableCostApi("/document/124-10190-10075")).toBe(true);
    expect(isPubliclyCacheableCostApi("/api/entity/oswald")).toBe(true);
    expect(isPubliclyCacheableCostApi("/entity/oswald")).toBe(true);
    expect(isPubliclyCacheableCostApi("/api/v1/documents/124-10190-10075")).toBe(
      true,
    );
    expect(isPubliclyCacheableCostApi("/api/admin/redactions")).toBe(false);
    expect(isPubliclyCacheableCostApi("/admin/redactions")).toBe(false);
  });

  it("detects crawlers that should not trigger warehouse-backed routes", () => {
    expect(isBlockedCrawlerUserAgent("GPTBot/1.4")).toBe(true);
    expect(isBlockedCrawlerUserAgent("ClaudeBot/1.0")).toBe(true);
    expect(isBlockedCrawlerUserAgent("Mozilla/5.0 Bytespider")).toBe(true);
    expect(isBlockedCrawlerUserAgent("Mozilla/5.0 Safari/605.1.15")).toBe(false);
    expect(isBlockedCrawlerUserAgent(null)).toBe(false);
  });

  it("blocks unknown and non-browser agents on document warehouse paths", () => {
    expect(classifyCostTrafficUserAgent("msh-pdfmin/1")).toBe("unknown");
    expect(shouldBlockUnknownDocumentTraffic("msh-pdfmin/1")).toBe(true);
    expect(shouldBlockUnknownDocumentTraffic(null)).toBe(true);
    expect(shouldBlockUnknownDocumentTraffic("node")).toBe(true);
    expect(shouldBlockUnknownDocumentTraffic("undici/6.0")).toBe(true);
    expect(
      shouldBlockUnknownDocumentTraffic(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0",
      ),
    ).toBe(false);
    expect(
      readAutomatedTrafficBlockReason(
        "msh-pdfmin/1",
        {},
        "/document/104-10004-10143",
      ),
    ).toBe("unknown-user-agent");
    expect(
      readAutomatedTrafficBlockReason(
        "msh-pdfmin/1",
        {},
        "/api/document/104-10004-10143",
      ),
    ).toBe("unknown-user-agent");
    expect(readAutomatedTrafficBlockReason("msh-pdfmin/1", {}, "/search")).toBeNull();
    expect(
      readAutomatedTrafficBlockReason(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0",
        {},
        "/document/104-10004-10143",
      ),
    ).toBeNull();
  });

  it("keeps declared search bots allowed on document pages", () => {
    const googlebot =
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const bingbot =
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
    const duckduck = "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)";

    expect(isAllowedSearchBotUserAgent(googlebot)).toBe(true);
    expect(isAllowedSearchBotUserAgent(bingbot)).toBe(true);
    expect(isAllowedSearchBotUserAgent(duckduck)).toBe(true);
    expect(isAllowedSearchBotUserAgent("Google-Extended")).toBe(false);
    expect(isAllowedSearchBotUserAgent("Applebot-Extended/1.0")).toBe(false);
    expect(classifyCostTrafficUserAgent(duckduck)).toBe("browser");
    expect(shouldBlockUnknownDocumentTraffic(duckduck)).toBe(false);
    expect(
      readAutomatedTrafficBlockReason(googlebot, {}, "/document/104-10004-10143"),
    ).toBeNull();
    expect(
      readAutomatedTrafficBlockReason(duckduck, {}, "/api/document/104-10004-10143"),
    ).toBeNull();
    expect(isBlockedCrawlerUserAgent("Google-Extended")).toBe(true);
    expect(
      readAutomatedTrafficBlockReason(
        "Google-Extended",
        {},
        "/document/104-10004-10143",
      ),
    ).toBe("known-crawler");
  });

  it("narrowly detects and blocks the July legacy-mobile campaign", () => {
    const campaignUserAgent =
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5 Build/MRA58N) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 " +
      "Mobile Safari/537.36";

    expect(isLegacyMobileAutomationUserAgent(campaignUserAgent)).toBe(true);
    expect(classifyCostTrafficUserAgent(campaignUserAgent)).toBe(
      "legacy_mobile_automation",
    );
    expect(readAutomatedTrafficBlockReason(campaignUserAgent)).toBe(
      "legacy-mobile-fingerprint",
    );
    expect(
      readAutomatedTrafficBlockReason(campaignUserAgent, {
        JFK_LEGACY_MOBILE_BLOCK_DISABLED: "1",
      }),
    ).toBeNull();
    expect(
      readAutomatedTrafficBlockReason("GPTBot/1.4", {
        JFK_LEGACY_MOBILE_BLOCK_DISABLED: "1",
      }),
    ).toBe("known-crawler");
    expect(classifyCostTrafficUserAgent(campaignUserAgent)).toBe(
      "legacy_mobile_automation",
    );
    expect(
      isLegacyMobileAutomationUserAgent(
        campaignUserAgent.replace("Nexus 5", "Pixel 8"),
      ),
    ).toBe(false);
    expect(
      isLegacyMobileAutomationUserAgent(
        campaignUserAgent.replace("Chrome/65", "Chrome/126"),
      ),
    ).toBe(false);
  });

  it("recognizes archive ids that can use the equality fast path", () => {
    expect(isArchiveIdentifierQuery("104-10338-10005")).toBe(true);
    expect(isArchiveIdentifierQuery("123456789")).toBe(true);
    expect(isArchiveIdentifierQuery("Oswald 104-10338-10005")).toBe(false);
    expect(isArchiveIdentifierQuery("123456")).toBe(false);
  });

  it("reads semantic kill switch state", () => {
    expect(isSemanticSearchDisabled({ JFK_API_DISABLE_SEMANTIC_SEARCH: "1" })).toBe(
      true,
    );
    expect(isSemanticSearchDisabled({ JFK_API_DISABLE_SEMANTIC_SEARCH: "0" })).toBe(
      false,
    );
  });

  it("reads route-level rate limit rules for cost-sensitive paths", () => {
    expect(readCostRateLimitRule("/api/search")).toEqual({
      key: "api-search",
      maxRequests: 20,
      windowMs: 60000,
    });
    expect(readCostRateLimitRule("/document/104-10338-10005")).toEqual({
      key: "document",
      maxRequests: 60,
      windowMs: 60000,
    });
    expect(readCostRateLimitRule("/api/entity/oswald")).toEqual({
      key: "api-entity",
      maxRequests: 60,
      windowMs: 60000,
    });
    expect(readCostRateLimitRule("/api/v1/documents")).toEqual({
      key: "api-v1-documents",
      maxRequests: 20,
      windowMs: 60000,
    });
    expect(readCostRateLimitRule("/about")).toBeNull();
  });

  it("allows cost rate limits to be tuned or disabled with environment values", () => {
    expect(
      readCostRateLimitRule("/search", {
        JFK_COST_RATE_LIMIT_MAX_REQUESTS: "5",
        JFK_COST_RATE_LIMIT_WINDOW_SECONDS: "30",
      }),
    ).toEqual({
      key: "search",
      maxRequests: 5,
      windowMs: 30000,
    });

    expect(
      readCostRateLimitRule("/search", {
        JFK_COST_RATE_LIMIT_DISABLED: "1",
      }),
    ).toBeNull();

    expect(
      readCostRateLimitRule("/search", {
        JFK_COST_RATE_LIMIT_MAX_REQUESTS: "0",
        JFK_COST_RATE_LIMIT_WINDOW_SECONDS: "nope",
      }),
    ).toEqual({
      key: "search",
      maxRequests: 30,
      windowMs: 60000,
    });
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
