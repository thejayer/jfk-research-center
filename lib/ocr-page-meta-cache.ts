/**
 * In-process cache for search_ocr_page_meta hits.
 *
 * GET /api/document/:id/ocr is public. Do not cache misses or
 * "table unavailable" per id — those keys are attacker-controlled.
 * Positive hits only, LRU, hard cap.
 */

export const OCR_PAGE_META_CACHE_MAX = 2000;
export const OCR_PAGE_META_TTL_MS = 5 * 60 * 1000;

export type OcrPageMetaRecord = {
  document_id: string;
  chunk_count: number;
  first_chunk_order: number;
  last_chunk_order: number;
  doc_shard: number;
};

type CacheEntry = {
  expiresAt: number;
  meta: OcrPageMetaRecord;
};

export class OcrPageMetaCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly maxEntries = OCR_PAGE_META_CACHE_MAX,
    private readonly ttlMs = OCR_PAGE_META_TTL_MS,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(documentId: string, now = Date.now()): OcrPageMetaRecord | undefined {
    const entry = this.entries.get(documentId);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(documentId);
      return undefined;
    }
    this.entries.delete(documentId);
    this.entries.set(documentId, entry);
    return entry.meta;
  }

  /** Cache a confirmed meta row. Does not accept null / miss / unavailable. */
  setPositive(documentId: string, meta: OcrPageMetaRecord, now = Date.now()): void {
    this.entries.delete(documentId);
    this.entries.set(documentId, {
      expiresAt: now + this.ttlMs,
      meta,
    });
    this.evictOldest();
  }

  clear(): void {
    this.entries.clear();
  }

  private evictOldest(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

export const ocrPageMetaCache = new OcrPageMetaCache();

let tableUnavailableUntil = 0;

export function isOcrPageMetaTableUnavailable(now = Date.now()): boolean {
  return now < tableUnavailableUntil;
}

export function markOcrPageMetaTableUnavailable(now = Date.now()): void {
  tableUnavailableUntil = now + OCR_PAGE_META_TTL_MS;
}

export function resetOcrPageMetaCacheForTests(): void {
  ocrPageMetaCache.clear();
  tableUnavailableUntil = 0;
}
