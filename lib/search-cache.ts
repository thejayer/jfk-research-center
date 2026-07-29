import type { SearchFilterInput, SearchResponse } from "./api-types";

type SearchMode = "document" | "mention" | "semantic";

type CacheEntry = {
  expiresAt: number;
  promise: Promise<SearchResponse>;
};

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

export type SearchCacheOptions = {
  env?: Record<string, string | undefined>;
  now?: () => number;
};

export function searchCacheKey(input: {
  query: string;
  mode: SearchMode;
  filters?: SearchFilterInput;
  limit?: number;
  offset?: number;
}): string {
  const filters = input.filters ?? {};
  return JSON.stringify({
    query: input.query.trim().toLowerCase(),
    mode: input.mode,
    filters: {
      agencies: normalizeList(filters.agencies),
      yearFrom: filters.yearFrom ?? null,
      yearTo: filters.yearTo ?? null,
      entities: normalizeList(filters.entities),
      topics: normalizeList(filters.topics),
      confidence: normalizeList(filters.confidence),
    },
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  });
}

export async function withSearchCache(
  key: string,
  load: () => Promise<SearchResponse>,
  options: SearchCacheOptions = {},
): Promise<SearchResponse> {
  const env = options.env ?? readProcessEnv();
  if (env.JFK_SEARCH_CACHE_DISABLED === "1") return load();

  const now = options.now ?? Date.now;
  const ttlSeconds =
    readPositiveInt(env.JFK_SEARCH_CACHE_TTL_SECONDS) ?? DEFAULT_TTL_SECONDS;
  const maxEntries =
    readPositiveInt(env.JFK_SEARCH_CACHE_MAX_ENTRIES) ?? DEFAULT_MAX_ENTRIES;
  const currentTime = now();
  const existing = cache.get(key);

  if (existing && existing.expiresAt > currentTime) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.promise;
  }
  if (existing) cache.delete(key);

  pruneSearchCache(currentTime, maxEntries);
  const promise = load();
  const entry = {
    expiresAt: currentTime + ttlSeconds * 1000,
    promise,
  };
  cache.set(key, entry);

  try {
    return await promise;
  } catch (error) {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  }
}

export function clearSearchCacheForTests(): void {
  cache.clear();
}

function pruneSearchCache(now: number, maxEntries: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") return;
    cache.delete(oldestKey);
  }
}

function normalizeList(values: readonly string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ).sort();
}

function readPositiveInt(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
