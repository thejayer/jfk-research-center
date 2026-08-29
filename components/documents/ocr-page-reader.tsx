"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentDetail, DocumentOcrPageResponse, OcrPage } from "@/lib/api-types";
import { formatNumber, highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import styles from "./document-reader.module.css";

export function OcrPageReader({
  doc,
  initialPage,
  chunkCount,
  firstChunkOrder,
  lastChunkOrder,
  prevChunkOrder,
  nextChunkOrder,
  terms,
}: {
  doc: DocumentDetail;
  initialPage: OcrPage;
  chunkCount: number;
  firstChunkOrder: number | null;
  lastChunkOrder: number | null;
  prevChunkOrder: number | null;
  nextChunkOrder: number | null;
  terms: string[];
}) {
  const [page, setPage] = useState(initialPage);
  const [nav, setNav] = useState({
    chunkCount,
    firstChunkOrder,
    lastChunkOrder,
    prevChunkOrder,
    nextChunkOrder,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const loadChunk = useCallback(
    async (order: number, updateHash: boolean) => {
      if (page.chunkOrder === order) return;
      setStatus("loading");
      try {
        const res = await fetch(
          `/api/document/${encodeURIComponent(doc.id)}/ocr?chunk=${order}`,
        );
        if (!res.ok) throw new Error("ocr page unavailable");
        const data = (await res.json()) as DocumentOcrPageResponse;
        if (data.ocrBodyUnavailable || !data.page) {
          throw new Error("ocr page unavailable");
        }
        setPage(data.page);
        setNav({
          chunkCount: data.chunkCount,
          firstChunkOrder: data.firstChunkOrder,
          lastChunkOrder: data.lastChunkOrder,
          prevChunkOrder: data.prevChunkOrder,
          nextChunkOrder: data.nextChunkOrder,
        });
        if (updateHash && data.page.chunkOrder != null) {
          history.replaceState(null, "", `#chunk-${data.page.chunkOrder}`);
        }
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [doc.id, page.chunkOrder],
  );

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.slice(1);
      const match = /^chunk-(\d+)$/.exec(hash);
      if (!match) return;
      const order = Number(match[1]);
      if (order === page.chunkOrder) return;
      void loadChunk(order, false);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [loadChunk, page.chunkOrder]);

  const currentOrder = page.chunkOrder;
  const canPrev = nav.prevChunkOrder != null;
  const canNext = nav.nextChunkOrder != null;

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
          Previous page
        </button>
        <div className={`muted ${styles.ocrPagerStatus}`} aria-live="polite">
          {currentOrder != null
            ? `Chunk ${formatNumber(currentOrder)}`
            : "OCR page"}
          {nav.chunkCount > 0
            ? ` of ${formatNumber(nav.chunkCount)}`
            : ""}
          {page.pageLabel ? ` · ${page.pageLabel}` : ""}
          {status === "loading" ? " · loading" : ""}
        </div>
        <button
          type="button"
          className={styles.ocrPagerButton}
          disabled={!canNext || status === "loading"}
          onClick={() =>
            nav.nextChunkOrder != null && void loadChunk(nav.nextChunkOrder, true)
          }
        >
          Next page
        </button>
      </div>

      {status === "error" && (
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          That page could not be loaded. The first page above is still the
          full OCR for this chunk, not a search-card excerpt.
        </p>
      )}

      <article
        id={currentOrder != null ? `chunk-${currentOrder}` : "ocr-page"}
        className={`ocr-chunk ${styles.ocrFullPage}`}
      >
        <p
          className={styles.ocrFullPageText}
          dangerouslySetInnerHTML={{
            __html: highlightHTML(page.text, terms),
          }}
        />
        {currentOrder != null && (
          <div className={`muted ${styles.ocrChunkMeta}`}>
            <span>
              chunk {currentOrder}
              {page.pageLabel ? ` | ${page.pageLabel}` : ""}
              {" | source: ocr"}
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

      {nav.firstChunkOrder != null &&
        nav.lastChunkOrder != null &&
        nav.firstChunkOrder !== nav.lastChunkOrder && (
          <div className={styles.ocrPager} role="navigation" aria-label="OCR page ends">
            <button
              type="button"
              className={styles.ocrPagerButton}
              disabled={status === "loading" || currentOrder === nav.firstChunkOrder}
              onClick={() => void loadChunk(nav.firstChunkOrder!, true)}
            >
              First page
            </button>
            <button
              type="button"
              className={styles.ocrPagerButton}
              disabled={status === "loading" || currentOrder === nav.lastChunkOrder}
              onClick={() => void loadChunk(nav.lastChunkOrder!, true)}
            >
              Last page
            </button>
          </div>
        )}
    </div>
  );
}
