"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { DocumentDetail, DocumentOcrPageResponse, OcrPage } from "@/lib/api-types";
import {
  formatOcrReaderStatus,
  isLatestReaderLoad,
  parseOcrJumpInput,
  replaceDocumentReaderUrl,
  requestedReaderChunk,
  shouldHideOcrForHashDeepLink,
} from "@/lib/document-reader";
import { highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import { useDocumentReaderState } from "./document-reader-state";
import styles from "./document-reader.module.css";

export function OcrPageReader({
  doc,
  initialPage,
  chunkCount,
  firstChunkOrder,
  lastChunkOrder,
  prevChunkOrder,
  nextChunkOrder,
  lastPageLabel,
  terms,
}: {
  doc: DocumentDetail;
  initialPage: OcrPage;
  chunkCount: number;
  firstChunkOrder: number | null;
  lastChunkOrder: number | null;
  prevChunkOrder: number | null;
  nextChunkOrder: number | null;
  lastPageLabel: string | null;
  terms: string[];
}) {
  const readerState = useDocumentReaderState();
  const setCurrentPage = readerState?.setCurrentPage;
  const [page, setPage] = useState(initialPage);
  const [nav, setNav] = useState({
    chunkCount,
    firstChunkOrder,
    lastChunkOrder,
    prevChunkOrder,
    nextChunkOrder,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [hashPending, setHashPending] = useState(false);
  const cacheRef = useRef(new Map<number, DocumentOcrPageResponse>());
  const pageOrderRef = useRef(initialPage.chunkOrder);
  const loadGenRef = useRef(0);

  const applyPage = useCallback(
    (data: DocumentOcrPageResponse, updateUrl: boolean) => {
      if (!data.page) return;
      setPage(data.page);
      pageOrderRef.current = data.page.chunkOrder;
      setNav({
        chunkCount: data.chunkCount,
        firstChunkOrder: data.firstChunkOrder,
        lastChunkOrder: data.lastChunkOrder,
        prevChunkOrder: data.prevChunkOrder,
        nextChunkOrder: data.nextChunkOrder,
      });
      setCurrentPage?.(data.page);
      if (updateUrl && data.page.chunkOrder != null) {
        replaceDocumentReaderUrl(data.page.chunkOrder);
      }
      setStatus("idle");
      setHashPending(false);
      setJumpError(null);
    },
    [setCurrentPage],
  );

  const prefetch = useCallback((order: number | null) => {
    if (order == null || cacheRef.current.has(order)) return;
    void fetch(`/api/document/${encodeURIComponent(doc.id)}/ocr?chunk=${order}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DocumentOcrPageResponse | null) => {
        if (data?.page) cacheRef.current.set(order, data);
      })
      .catch(() => {
        // Prefetch is best-effort; a later click still fetches.
      });
  }, [doc.id]);

  const statusRef = useRef(status);
  statusRef.current = status;

  const loadChunk = useCallback(
    async (order: number, updateUrl: boolean) => {
      if (pageOrderRef.current === order && statusRef.current !== "error") return;
      const generation = ++loadGenRef.current;
      const cached = cacheRef.current.get(order);
      if (cached?.page) {
        if (!isLatestReaderLoad(generation, loadGenRef.current)) return;
        applyPage(cached, updateUrl);
        prefetch(cached.prevChunkOrder);
        prefetch(cached.nextChunkOrder);
        return;
      }
      setStatus("loading");
      try {
        const res = await fetch(
          `/api/document/${encodeURIComponent(doc.id)}/ocr?chunk=${order}`,
        );
        if (!isLatestReaderLoad(generation, loadGenRef.current)) return;
        if (!res.ok) throw new Error("ocr page unavailable");
        const data = (await res.json()) as DocumentOcrPageResponse;
        if (!isLatestReaderLoad(generation, loadGenRef.current)) return;
        if (data.ocrBodyUnavailable || !data.page) {
          throw new Error("ocr page unavailable");
        }
        cacheRef.current.set(order, data);
        applyPage(data, updateUrl);
        prefetch(data.prevChunkOrder);
        prefetch(data.nextChunkOrder);
      } catch {
        if (!isLatestReaderLoad(generation, loadGenRef.current)) return;
        setStatus("error");
        setHashPending(false);
      }
    },
    [applyPage, doc.id, prefetch],
  );

  useEffect(() => {
    setCurrentPage?.(initialPage);
    cacheRef.current.set(initialPage.chunkOrder ?? -1, {
      documentId: doc.id,
      page: initialPage,
      prevChunkOrder,
      nextChunkOrder,
      chunkCount,
      firstChunkOrder,
      lastChunkOrder,
    });
    prefetch(prevChunkOrder);
    prefetch(nextChunkOrder);
  }, [
    chunkCount,
    doc.id,
    firstChunkOrder,
    initialPage,
    lastChunkOrder,
    nextChunkOrder,
    prefetch,
    prevChunkOrder,
    setCurrentPage,
  ]);

  useEffect(() => {
    const applyLocation = () => {
      const { chunk: requested, hashOnly } = requestedReaderChunk(
        window.location.search,
        window.location.hash,
      );
      document.documentElement.removeAttribute("data-ocr-deeplink");
      if (requested == null || requested === pageOrderRef.current) {
        setHashPending(false);
        return;
      }
      setHashPending(hashOnly);
      void loadChunk(requested, true);
    };
    applyLocation();
    window.addEventListener("hashchange", applyLocation);
    window.addEventListener("popstate", applyLocation);
    return () => {
      window.removeEventListener("hashchange", applyLocation);
      window.removeEventListener("popstate", applyLocation);
    };
  }, [loadChunk]);

  useEffect(() => {
    function isTyping(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    }
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (statusRef.current === "loading") return;
      if (event.key === "ArrowLeft" || event.key === "k" || event.key === "K") {
        if (nav.prevChunkOrder != null) {
          event.preventDefault();
          void loadChunk(nav.prevChunkOrder, true);
        }
      }
      if (event.key === "ArrowRight" || event.key === "j" || event.key === "J") {
        if (nav.nextChunkOrder != null) {
          event.preventDefault();
          void loadChunk(nav.nextChunkOrder, true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadChunk, nav.nextChunkOrder, nav.prevChunkOrder]);

  const currentOrder = page.chunkOrder;
  const canPrev = nav.prevChunkOrder != null;
  const canNext = nav.nextChunkOrder != null;
  const hideForHashDeepLink = shouldHideOcrForHashDeepLink({
    hideUntilLoad: hashPending,
    settled: status !== "loading",
  });
  const statusLabel = formatOcrReaderStatus({
    pageLabel: page.pageLabel,
    lastPageLabel,
    chunkCount: nav.chunkCount,
    loading: status === "loading" || hideForHashDeepLink,
  });

  function onJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseOcrJumpInput(jumpValue);
    if (parsed.kind === "invalid") {
      setJumpError("Enter an OCR chunk number, such as 0 or 500.");
      return;
    }
    if (parsed.kind === "page-label") {
      setJumpError(
        `Archival labels like ${parsed.label} are not indexed — several OCR pages can share one label. Jump by chunk number instead${
          nav.firstChunkOrder != null && nav.lastChunkOrder != null
            ? ` (${nav.firstChunkOrder}–${nav.lastChunkOrder})`
            : ""
        }.`,
      );
      return;
    }
    void loadChunk(parsed.order, true);
  }

  return (
    <div className={styles.ocrReader}>
      <div className={styles.ocrPager} role="navigation" aria-label="OCR pages">
        <button
          type="button"
          className={styles.ocrPagerButton}
          disabled={!canPrev || status === "loading"}
          onClick={() =>
            nav.prevChunkOrder != null && void loadChunk(nav.prevChunkOrder, true)
          }
        >
          Previous
        </button>
        <div className={`muted ${styles.ocrPagerStatus}`} aria-live="polite">
          {statusLabel}
        </div>
        <button
          type="button"
          className={styles.ocrPagerButton}
          disabled={!canNext || status === "loading"}
          onClick={() =>
            nav.nextChunkOrder != null && void loadChunk(nav.nextChunkOrder, true)
          }
        >
          Next
        </button>
      </div>

      <form className={styles.ocrJump} onSubmit={onJump}>
        <label htmlFor="ocr-jump" className="eyebrow">
          Jump to chunk
        </label>
        <input
          id="ocr-jump"
          type="text"
          inputMode="numeric"
          value={jumpValue}
          onChange={(event) => {
            setJumpValue(event.target.value);
            setJumpError(null);
          }}
          placeholder={
            nav.firstChunkOrder != null && nav.lastChunkOrder != null
              ? `${nav.firstChunkOrder}–${nav.lastChunkOrder}`
              : "Chunk number"
          }
          className={styles.ocrJumpInput}
        />
        <button
          type="submit"
          className={styles.ocrPagerButton}
          disabled={status === "loading"}
        >
          Go
        </button>
        {nav.firstChunkOrder != null &&
          nav.lastChunkOrder != null &&
          nav.firstChunkOrder !== nav.lastChunkOrder && (
            <>
              <button
                type="button"
                className={styles.ocrPagerButton}
                disabled={status === "loading" || currentOrder === nav.firstChunkOrder}
                onClick={() => void loadChunk(nav.firstChunkOrder!, true)}
              >
                First
              </button>
              <button
                type="button"
                className={styles.ocrPagerButton}
                disabled={status === "loading" || currentOrder === nav.lastChunkOrder}
                onClick={() => void loadChunk(nav.lastChunkOrder!, true)}
              >
                Last
              </button>
            </>
          )}
      </form>
      <p className={`muted ${styles.ocrJumpHint}`}>
        Arrow keys or J/K turn pages. Archival “p.” labels can span several OCR
        pages, so the jump box uses chunk numbers.
      </p>
      {jumpError && (
        <p className={`muted ${styles.ocrJumpError}`} role="status">
          {jumpError}
        </p>
      )}

      {status === "error" && (
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          That page could not be loaded. The text above is still the full OCR
          for the current chunk, not a search-card excerpt.
        </p>
      )}

      <article
        id={currentOrder != null ? `chunk-${currentOrder}` : "ocr-page"}
        className={`ocr-chunk ocr-pending-deeplink ${styles.ocrFullPage}`}
      >
        {hideForHashDeepLink ? (
          <p className={styles.ocrFullPageText}>Opening the linked page…</p>
        ) : (
          <p
            className={styles.ocrFullPageText}
            dangerouslySetInnerHTML={{
              __html: highlightHTML(page.text, terms),
            }}
          />
        )}
        {currentOrder != null && (
          <div className={`muted ${styles.ocrChunkMeta}`}>
            <span>
              chunk {currentOrder}
              {page.pageLabel ? ` · ${page.pageLabel}` : ""}
              {" · source: ocr"}
            </span>
            <ChunkActions
              naid={doc.naid}
              chunkOrder={currentOrder}
              citationInput={{
                title: doc.title,
                naid: doc.naid,
                agency: doc.agency,
                recordGroup: doc.recordGroup,
                collectionName: doc.collectionName,
                startDate: doc.startDate,
                endDate: doc.endDate,
                sourceUrl: doc.sourceUrl,
              }}
            />
          </div>
        )}
      </article>
    </div>
  );
}
