import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentResponse } from "../api-types";
import {
  clearDocumentCacheForTests,
  documentCacheKey,
  withDocumentCache,
} from "../document-cache";

const response = {
  document: { id: "124-10190-10075", naid: "124-10190-10075", title: "Test" },
  mentions: [],
  relatedTopics: [],
  relatedEntities: [],
  relatedDocuments: [],
} as unknown as DocumentResponse;

describe("document cache", () => {
  beforeEach(() => clearDocumentCacheForTests());

  it("keys the loaded OCR page separately from the first-page read", () => {
    expect(documentCacheKey("124-10190-10075")).toBe("124-10190-10075::first");
    expect(documentCacheKey(" 124-10190-10075 ", 40)).toBe(
      "124-10190-10075::40",
    );
    expect(documentCacheKey("124-10190-10075", 0)).toBe("124-10190-10075::0");
    expect(documentCacheKey("124-10190-10075")).not.toBe(
      documentCacheKey("124-10190-10075", 40),
    );
  });

  it("coalesces concurrent loads and reuses the result within the ttl", async () => {
    const load = vi.fn(async () => response);
    const options = {
      env: {
        JFK_DOCUMENT_CACHE_TTL_SECONDS: "30",
        JFK_DOCUMENT_CACHE_MAX_ENTRIES: "10",
      },
      now: () => 1_000,
    };

    const [first, second] = await Promise.all([
      withDocumentCache("same", load, options),
      withDocumentCache("same", load, options),
    ]);
    const third = await withDocumentCache("same", load, options);

    expect(first).toBe(response);
    expect(second).toBe(response);
    expect(third).toBe(response);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("aliases a canonical document_id so a NAID hit is reused", async () => {
    const load = vi.fn(async () => response);
    const options = {
      env: {
        JFK_DOCUMENT_CACHE_TTL_SECONDS: "30",
        JFK_DOCUMENT_CACHE_MAX_ENTRIES: "10",
      },
      now: () => 1_000,
      aliasKeys: (result: DocumentResponse) => [
        documentCacheKey(result.document.id),
      ],
    };

    await withDocumentCache("naid-only", load, options);
    const reused = await withDocumentCache(
      documentCacheKey("124-10190-10075"),
      load,
      options,
    );

    expect(reused).toBe(response);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache misses, failures, or expired hits", async () => {
    let now = 1_000;
    const options = {
      env: {
        JFK_DOCUMENT_CACHE_TTL_SECONDS: "1",
        JFK_DOCUMENT_CACHE_MAX_ENTRIES: "10",
      },
      now: () => now,
    };

    const missing = vi.fn(async () => null);
    expect(await withDocumentCache("missing", missing, options)).toBeNull();
    expect(await withDocumentCache("missing", missing, options)).toBeNull();
    expect(missing).toHaveBeenCalledTimes(2);

    const load = vi.fn(async () => response);
    await withDocumentCache("expiring", load, options);
    now = 2_001;
    await withDocumentCache("expiring", load, options);
    expect(load).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => {
      throw new Error("warehouse unavailable");
    });
    await expect(withDocumentCache("failure", failing, options)).rejects.toThrow(
      "warehouse unavailable",
    );
    await expect(withDocumentCache("failure", failing, options)).rejects.toThrow(
      "warehouse unavailable",
    );
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache when disabled", async () => {
    const load = vi.fn(async () => response);
    const options = {
      env: { JFK_DOCUMENT_CACHE_DISABLED: "1" },
    };
    await withDocumentCache("disabled", load, options);
    await withDocumentCache("disabled", load, options);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
