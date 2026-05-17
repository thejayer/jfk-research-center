import { describe, expect, it } from "vitest";
import { findPublicApiEndpointPolicy } from "../public-api-access";
import {
  enforcePublicApiAccess,
  InMemoryPublicApiEnforcementStore,
  readApiKey,
  type PublicApiEnforcementStore,
} from "../public-api-enforcement";

const NOW = Date.UTC(2026, 0, 1, 12);

describe("public API enforcement", () => {
  it("reads API keys from bearer auth and script-friendly headers", () => {
    expect(
      readApiKey(
        new Request("https://example.test/api/v1/search/semantic", {
          headers: { authorization: "Bearer test-key" },
        }),
      ),
    ).toBe("test-key");

    expect(
      readApiKey(
        new Request("https://example.test/api/v1/search/semantic", {
          headers: { "x-jfkrc-api-key": " header-key " },
        }),
      ),
    ).toBe("header-key");
  });

  it("requires a key before semantic search work can run", async () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );
    expect(policy).not.toBeNull();

    const result = await enforcePublicApiAccess(
      new Request("https://example.test/api/v1/search/semantic?q=oswald"),
      policy!,
      { now: NOW, store: throwingStore() },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: "api key required",
      });
    }
  });

  it("rejects unknown and inactive API keys", async () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );
    expect(policy).not.toBeNull();

    const store = new InMemoryPublicApiEnforcementStore({
      paused: { keyId: "paused", status: "paused", tier: "researcher" },
    });

    const unknown = await enforcePublicApiAccess(
      keyedRequest("missing"),
      policy!,
      { now: NOW, store },
    );
    const paused = await enforcePublicApiAccess(keyedRequest("paused"), policy!, {
      now: NOW,
      store,
    });

    expect(unknown.ok).toBe(false);
    expect(paused.ok).toBe(false);
    if (!unknown.ok) expect(unknown.response.status).toBe(403);
    if (!paused.ok) expect(paused.response.status).toBe(403);
  });

  it("allows active keys on keyed semantic policies", async () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );
    expect(policy).not.toBeNull();

    const result = await enforcePublicApiAccess(keyedRequest("active"), policy!, {
      now: NOW,
      store: new InMemoryPublicApiEnforcementStore({
        active: { keyId: "active", status: "active", tier: "researcher" },
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      keyRecord: { keyId: "active", status: "active" },
      rateLimit: { count: 1 },
    });
  });

  it("short-circuits kill switches before key lookup or counters", async () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );
    expect(policy).not.toBeNull();

    const result = await enforcePublicApiAccess(keyedRequest("active"), policy!, {
      now: NOW,
      env: { JFK_API_DISABLE_SEMANTIC_SEARCH: "1" },
      store: throwingStore(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
  });

  it("meters anonymous document search and returns Retry-After on overflow", async () => {
    const policy = findPublicApiEndpointPolicy("GET", "/api/v1/documents");
    expect(policy).not.toBeNull();

    const store = new InMemoryPublicApiEnforcementStore();
    const first = await enforcePublicApiAccess(
      new Request("https://example.test/api/v1/documents?q=oswald"),
      { ...policy!, anonymousLimit: { requests: 1, windowSeconds: 60 } },
      { now: NOW, clientIp: "203.0.113.10", store },
    );
    const second = await enforcePublicApiAccess(
      new Request("https://example.test/api/v1/documents?q=oswald"),
      { ...policy!, anonymousLimit: { requests: 1, windowSeconds: 60 } },
      { now: NOW + 10_000, clientIp: "203.0.113.10", store },
    );

    expect(first).toMatchObject({ ok: true, rateLimit: { count: 1 } });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.response.status).toBe(429);
      expect(second.response.headers.get("retry-after")).toBe("50");
    }
  });

  it("ignores spoofable proxy IP headers unless explicitly trusted", async () => {
    const policy = findPublicApiEndpointPolicy("GET", "/api/v1/documents");
    expect(policy).not.toBeNull();

    const limitedPolicy = {
      ...policy!,
      anonymousLimit: { requests: 1, windowSeconds: 60 },
    };
    const store = new InMemoryPublicApiEnforcementStore();
    const first = await enforcePublicApiAccess(
      forwardedRequest("198.51.100.10"),
      limitedPolicy,
      { now: NOW, store },
    );
    const second = await enforcePublicApiAccess(
      forwardedRequest("198.51.100.11"),
      limitedPolicy,
      { now: NOW + 10_000, store },
    );

    expect(first).toMatchObject({ ok: true, rateLimit: { count: 1 } });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.response.status).toBe(429);
  });

  it("uses proxy IP headers only when the deployment opts in", async () => {
    const policy = findPublicApiEndpointPolicy("GET", "/api/v1/documents");
    expect(policy).not.toBeNull();

    const limitedPolicy = {
      ...policy!,
      anonymousLimit: { requests: 1, windowSeconds: 60 },
    };
    const store = new InMemoryPublicApiEnforcementStore();
    const first = await enforcePublicApiAccess(
      forwardedRequest("198.51.100.10"),
      limitedPolicy,
      {
        now: NOW,
        env: { JFK_API_TRUST_PROXY_HEADERS: "1" },
        store,
      },
    );
    const second = await enforcePublicApiAccess(
      forwardedRequest("198.51.100.11"),
      limitedPolicy,
      {
        now: NOW + 10_000,
        env: { JFK_API_TRUST_PROXY_HEADERS: "1" },
        store,
      },
    );

    expect(first).toMatchObject({ ok: true, rateLimit: { count: 1 } });
    expect(second).toMatchObject({ ok: true, rateLimit: { count: 1 } });
  });
});

function keyedRequest(key: string): Request {
  return new Request("https://example.test/api/v1/search/semantic?q=oswald", {
    headers: { authorization: `Bearer ${key}` },
  });
}

function forwardedRequest(ip: string): Request {
  return new Request("https://example.test/api/v1/documents?q=oswald", {
    headers: { "x-forwarded-for": `${ip}, 203.0.113.1` },
  });
}

function throwingStore(): PublicApiEnforcementStore {
  return {
    async lookupApiKey() {
      throw new Error("lookup should not run");
    },
    async incrementCounter() {
      throw new Error("counter should not run");
    },
  };
}
