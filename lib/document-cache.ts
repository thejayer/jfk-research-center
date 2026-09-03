import type { DocumentResponse } from "./api-types";

type CacheEntry = {
  expiresAt: number;
  promise: Promise<DocumentResponse | null>;
};

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_MAX_ENTRIES = 2000;
const cache = new Map<string, CacheEntry>();

export type DocumentCacheOptions = {
  env?: Record<string, string | undefined>;
  now?: () => number;
  /** Extra keys that should resolve to the same in-flight / cached payload. */
  aliasKeys?: (result: DocumentResponse) => readonly string[];
};

/**
 * Cache key for one public document read.
 *
 * Chunk is part of the key because ?chunk=N changes the loaded OCR page
 * and the mention excerpts derived from that page. Misses are not stored
 * — document ids are caller-controlled.
 */
export function documentCacheKey(
  id: string,
  chunkOrder?: number | null,
): string {
  const normalized = id.trim();
  const chunk =
    chunkOrder != null && Number.isFinite(chunkOrder)
      ? String(Math.trunc(chunkOrder))
      : "first";
  return `${normalized}::${chunk}`;
}

export async function withDocumentCache(
  key: string,
  load: () => Promise<DocumentResponse | null>,
  options: DocumentCacheOptions = {},
): Promise<DocumentResponse | null> {
  const env = options.env ?? readProcessEnv();
  if (env.JFK_DOCUMENT_CACHE_DISABLED === "1") return load();

  const now = options.now ?? Date.now;
  const ttlSeconds =
    readPositiveInt(env.JFK_DOCUMENT_CACHE_TTL_SECONDS) ?? DEFAULT_TTL_SECONDS;
  const maxEntries =
    readPositiveInt(env.JFK_DOCUMENT_CACHE_MAX_ENTRIES) ?? DEFAULT_MAX_ENTRIES;
  const currentTime = now();
  const existing = cache.get(key);

  if (existing && existing.expiresAt > currentTime) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.promise;
  }
  if (existing) cache.delete(key);

  pruneDocumentCache(currentTime, maxEntries);
  const promise = load();
  const entry = {
    expiresAt: currentTime + ttlSeconds * 1000,
    promise,
  };
  cache.set(key, entry);

  try {
    const result = await promise;
    if (result == null) {
      if (cache.get(key) === entry) cache.delete(key);
      return null;
    }
    for (const alias of options.aliasKeys?.(result) ?? []) {
      if (!alias || alias === key) continue;
      cache.delete(alias);
      cache.set(alias, entry);
    }
    return result;
  } catch (error) {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  }
}

export function clearDocumentCacheForTests(): void {
  cache.clear();
}

function pruneDocumentCache(now: number, maxEntries: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") return;
    cache.delete(oldestKey);
  }
}

function readPositiveInt(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
