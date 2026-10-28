import { afterEach, describe, expect, it } from "vitest";
import {
  classifyCostTrafficUserAgent,
  readAutomatedTrafficBlockReason,
  shouldBlockUnknownDocumentTraffic,
} from "../cost-controls";
import {
  clearSearchBotVerifyCacheForTests,
  createDohResolver,
  hostnameMatchesSuffix,
  ipInCidr,
  ipMatchesPublishedCidrs,
  ptrNameForIp,
  searchBotVerifyCacheSizeForTests,
  verifyDeclaredSearchBot,
  type DnsResolver,
} from "../search-bot-verify";

const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT =
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const DUCKDUCK = "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)";
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0";

const GOOGLEBOT_IP = "66.249.66.1";
const BINGBOT_IP = "157.55.39.10";
const DUCKDUCK_IP = "20.191.45.212";
const SPOOF_IP = "198.51.100.20";

function dnsResolver(options: {
  reverse?: Record<string, string[]>;
  a?: Record<string, string[]>;
  aaaa?: Record<string, string[]>;
}): DnsResolver {
  return {
    async reverse(ip) {
      const hosts = options.reverse?.[ip];
      if (!hosts) throw new Error(`no ptr for ${ip}`);
      return hosts;
    },
    async resolve4(hostname) {
      const addrs = options.a?.[hostname];
      if (!addrs) throw new Error(`no a for ${hostname}`);
      return addrs;
    },
    async resolve6(hostname) {
      const addrs = options.aaaa?.[hostname];
      if (!addrs) throw new Error(`no aaaa for ${hostname}`);
      return addrs;
    },
  };
}

describe("search bot IP verification", () => {
  afterEach(() => {
    clearSearchBotVerifyCacheForTests();
  });

  it("matches published Google, Bing, and DuckDuckGo CIDRs", () => {
    expect(ipInCidr(GOOGLEBOT_IP, "66.249.66.0/27")).toBe(true);
    expect(ipMatchesPublishedCidrs(GOOGLEBOT_IP, ["66.249.66.0/27"])).toBe(true);
    expect(ipMatchesPublishedCidrs(BINGBOT_IP, ["157.55.39.0/24"])).toBe(true);
    expect(ipMatchesPublishedCidrs(DUCKDUCK_IP, ["20.191.45.212/32"])).toBe(true);
    expect(ipMatchesPublishedCidrs(SPOOF_IP, ["66.249.66.0/27"])).toBe(false);
    expect(ipInCidr("2001:4860:4801:10::1", "2001:4860:4801:10::/64")).toBe(
      true,
    );
    expect(ipInCidr("2001:4860:4801:99::1", "2001:4860:4801:10::/64")).toBe(
      false,
    );
  });

  it("accepts a verified Googlebot from a published crawler range", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: GOOGLEBOT_IP,
        resolver: null,
      }),
    ).resolves.toBe(true);
    expect(
      readAutomatedTrafficBlockReason(GOOGLEBOT, {}, "/document/104-10004-10143", {
        searchBotVerified: true,
      }),
    ).toBeNull();
    expect(classifyCostTrafficUserAgent(GOOGLEBOT, { searchBotVerified: true }))
      .toBe("browser");
  });

  it("rejects a spoofed Googlebot UA from an unlisted IP (unknown / 403)", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        resolver: dnsResolver({}),
      }),
    ).resolves.toBe(false);
    expect(
      readAutomatedTrafficBlockReason(GOOGLEBOT, {}, "/api/document/104-10004-10143", {
        searchBotVerified: false,
      }),
    ).toBe("unknown-user-agent");
    expect(
      classifyCostTrafficUserAgent(GOOGLEBOT, { searchBotVerified: false }),
    ).toBe("unknown");
  });

  it("does not treat a real browser as a search bot", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: BROWSER,
        clientIp: SPOOF_IP,
        resolver: null,
      }),
    ).resolves.toBe(false);
    expect(shouldBlockUnknownDocumentTraffic(BROWSER)).toBe(false);
    expect(
      readAutomatedTrafficBlockReason(BROWSER, {}, "/document/104-10004-10143", {
        searchBotVerified: false,
      }),
    ).toBeNull();
    expect(classifyCostTrafficUserAgent(BROWSER, { searchBotVerified: false }))
      .toBe("browser");
  });

  it("verifies Bingbot and DuckDuckBot from published ranges", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: BINGBOT,
        clientIp: BINGBOT_IP,
        resolver: null,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyDeclaredSearchBot({
        userAgent: DUCKDUCK,
        clientIp: DUCKDUCK_IP,
        resolver: null,
      }),
    ).resolves.toBe(true);
  });

  it("accepts reverse-then-forward DNS when the IP is outside the snapshot", async () => {
    const hostname = "crawl-198-51-100-20.googlebot.com";
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        resolver: dnsResolver({
          reverse: { [SPOOF_IP]: [hostname] },
          a: { [hostname]: [SPOOF_IP] },
        }),
      }),
    ).resolves.toBe(true);
  });

  it("rejects reverse DNS that does not forward back to the client IP", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        resolver: dnsResolver({
          reverse: { [SPOOF_IP]: ["crawl-198-51-100-20.googlebot.com"] },
          a: { "crawl-198-51-100-20.googlebot.com": ["66.249.66.1"] },
        }),
      }),
    ).resolves.toBe(false);
  });

  it("rejects a PTR hostname that is not a vendor suffix", async () => {
    expect(
      hostnameMatchesSuffix("crawl-66-249-66-1.googlebot.com", [
        ".googlebot.com",
        ".google.com",
      ]),
    ).toBe(true);
    expect(
      hostnameMatchesSuffix("notgoogle.com", [".google.com"]),
    ).toBe(false);
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        resolver: dnsResolver({
          reverse: { [SPOOF_IP]: ["spoof.example.net"] },
          a: { "spoof.example.net": [SPOOF_IP] },
        }),
      }),
    ).resolves.toBe(false);
  });

  it("builds PTR names and resolves reverse-then-forward over DoH JSON", async () => {
    expect(ptrNameForIp("66.249.66.1")).toBe("1.66.249.66.in-addr.arpa");
    expect(ptrNameForIp("2001:4860:4801:10::1")).toMatch(/\.ip6\.arpa$/);

    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const name = url.searchParams.get("name");
      const type = url.searchParams.get("type");
      if (type === "PTR" && name === "20.100.51.198.in-addr.arpa") {
        return Response.json({
          Answer: [
            {
              type: 12,
              data: "crawl-198-51-100-20.googlebot.com.",
            },
          ],
        });
      }
      if (type === "A" && name === "crawl-198-51-100-20.googlebot.com") {
        return Response.json({
          Answer: [{ type: 1, data: SPOOF_IP }],
        });
      }
      return Response.json({ Answer: [] });
    }) as typeof fetch;

    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        resolver: createDohResolver(fetchImpl, "https://dns.example.test/dns-query"),
      }),
    ).resolves.toBe(true);
  });

  it("fails closed when a search-bot UA has no trusted client IP", async () => {
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: "",
        resolver: null,
      }),
    ).resolves.toBe(false);
  });

  it("caches positive and negative results and evicts by TTL", async () => {
    const t0 = 1_000_000;
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: GOOGLEBOT_IP,
        now: t0,
        resolver: null,
      }),
    ).resolves.toBe(true);
    expect(searchBotVerifyCacheSizeForTests()).toBe(1);

    const resolver = dnsResolver({});
    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        now: t0,
        resolver,
      }),
    ).resolves.toBe(false);
    expect(searchBotVerifyCacheSizeForTests()).toBe(2);

    await expect(
      verifyDeclaredSearchBot({
        userAgent: GOOGLEBOT,
        clientIp: SPOOF_IP,
        now: t0 + 1000,
        resolver: dnsResolver({
          reverse: { [SPOOF_IP]: ["crawl-198-51-100-20.googlebot.com"] },
          a: { "crawl-198-51-100-20.googlebot.com": [SPOOF_IP] },
        }),
      }),
    ).resolves.toBe(false);

    await verifyDeclaredSearchBot({
      userAgent: GOOGLEBOT,
      clientIp: "66.249.66.2",
      now: t0,
      resolver: null,
      cacheMaxEntries: 2,
    });
    expect(searchBotVerifyCacheSizeForTests()).toBeLessThanOrEqual(2);

    clearSearchBotVerifyCacheForTests();
    await verifyDeclaredSearchBot({
      userAgent: GOOGLEBOT,
      clientIp: GOOGLEBOT_IP,
      now: t0,
      resolver: null,
      cacheTtlMs: 10,
    });
    await verifyDeclaredSearchBot({
      userAgent: GOOGLEBOT,
      clientIp: GOOGLEBOT_IP,
      now: t0 + 50,
      resolver: null,
    });
    expect(searchBotVerifyCacheSizeForTests()).toBe(1);
  });
});
