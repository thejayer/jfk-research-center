import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResponse } from "../api-types";
import {
  clearSearchCacheForTests,
  searchCacheKey,
  withSearchCache,
} from "../search-cache";

const response = { query: "oswald" } as SearchResponse;

describe("search cache", () => {
  beforeEach(() => clearSearchCacheForTests());

  it("normalizes equivalent search inputs to one key", () => {
    const left = searchCacheKey({
      query: " Oswald ",
      mode: "document",
      filters: { agencies: ["CIA", "FBI", "CIA"], topics: ["cuba"] },
    });
    const right = searchCacheKey({
      query: "oswald",
      mode: "document",
      filters: { agencies: ["FBI", "CIA"], topics: ["cuba"] },
      limit: 50,
      offset: 0,
    });

    expect(right).toBe(left);
  });

  it("coalesces concurrent loads and reuses the result within the ttl", async () => {
    const load = vi.fn(async () => response);
    const options = {
      env: {
        JFK_SEARCH_CACHE_TTL_SECONDS: "30",
        JFK_SEARCH_CACHE_MAX_ENTRIES: "10",
      },
      now: () => 1_000,
    };

    const [first, second] = await Promise.all([
      withSearchCache("same", load, options),
      withSearchCache("same", load, options),
    ]);
    const third = await withSearchCache("same", load, options);

    expect(first).toBe(response);
    expect(second).toBe(response);
    expect(third).toBe(response);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads expired entries and never caches failures", async () => {
    let now = 1_000;
    const load = vi.fn(async () => response);
    const options = {
      env: {
        JFK_SEARCH_CACHE_TTL_SECONDS: "1",
        JFK_SEARCH_CACHE_MAX_ENTRIES: "10",
      },
      now: () => now,
    };

    await withSearchCache("expiring", load, options);
    now = 2_001;
    await withSearchCache("expiring", load, options);
    expect(load).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => {
      throw new Error("warehouse unavailable");
    });
    await expect(withSearchCache("failure", failing, options)).rejects.toThrow(
      "warehouse unavailable",
    );
    await expect(withSearchCache("failure", failing, options)).rejects.toThrow(
      "warehouse unavailable",
    );
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
