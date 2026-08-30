import type { DocumentDetail, MentionExcerpt } from "@/lib/api-types";
import { archivalPageCount, formatOcrReaderStatus } from "@/lib/document-reader";
import { formatNumber, highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import { OcrPageReader } from "./ocr-page-reader";
import { TrustStatusStrip } from "@/components/research/trust-status-strip";
import styles from "./document-reader.module.css";

export function OcrPanel({
  doc,
  mentions,
}: {
  doc: DocumentDetail;
  mentions: MentionExcerpt[];
}) {
  if (!doc.hasOcr) {
    return (
      <section
        className={`${styles.ocrPanel} ${styles.ocrEmpty}`}
        id="ocr-text"
        aria-labelledby="ocr-text-title"
      >
        <div className="eyebrow">Document transcript</div>
        <h2 id="ocr-text-title" className={styles.ocrTitle}>
          OCR / Extracted text
        </h2>
        <p className="muted" style={{ fontSize: "0.95rem", maxWidth: "56ch" }}>
          This record does not have OCR text available. It may be a
          photograph, still image, or unprocessed holding; consult the
          linked digital object for visual inspection. Machine text covers
          only a fraction of the indexed collection.
        </p>
      </section>
    );
  }

  const ocrMentions = mentions.filter(
    (mention) => mention.source === "ocr" && mention.chunkOrder != null,
  );
  const terms = Array.from(new Set(ocrMentions.flatMap((m) => m.matchedTerms)));
  const firstFromWarehouse = doc.ocrPages?.[0];
  const firstOcrPage = firstFromWarehouse ??
    (doc.ocrExcerpt
      ? {
          pageLabel: "p. 1",
          text: doc.ocrExcerpt,
          chunkOrder: doc.ocrFirstChunkOrder ?? 0,
        }
      : null);
  const readerChunkCount = firstFromWarehouse ? (doc.chunkCount ?? 1) : 1;
  const lastPageLabel = doc.ocrLastPageLabel ?? null;
  const pages = archivalPageCount({
    pageCount: doc.pageCount,
    lastPageLabel,
  });

  return (
    <section
      className={`${styles.ocrPanel} ocr-panel-section`}
      id="ocr-text"
      aria-labelledby="ocr-text-title"
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var h=location.hash;var q=location.search;if(/^#chunk--?\\d+$/.test(h)&&!/[?&]chunk=/.test(q)){document.documentElement.setAttribute("data-ocr-deeplink","1");}}catch(e){}})();`,
        }}
      />
      <div className={styles.ocrHeader}>
        <div>
          <div className="eyebrow">Document transcript</div>
          <h2 id="ocr-text-title" className={styles.ocrTitle}>
            OCR reader
          </h2>
          <div className="muted" style={{ fontSize: "0.84rem" }}>
            Page-at-a-time machine text. The first page is often a cover
            sheet, not the whole file.
          </div>
        </div>
        <span className={`muted num ${styles.ocrHeaderCount}`}>
          {formatOcrReaderStatus({
            pageLabel: firstOcrPage?.pageLabel,
            lastPageLabel,
            chunkCount: doc.chunkCount,
          })}
        </span>
      </div>

      <TrustStatusStrip
        doc={doc}
        statuses={[
          {
            label: "OCR",
            value: doc.hasOcr ? "Machine text available" : "Metadata only",
            tone: doc.hasOcr ? "good" : "warn",
          },
          {
            label: "This file",
            value: pages
              ? `${pages.estimated ? "~" : ""}${formatNumber(pages.count)} archival pages`
              : "Page count unknown",
            tone: "neutral",
          },
          {
            label: "On this page",
            value:
              ocrMentions.length > 0
                ? `${formatNumber(ocrMentions.length)} loaded-page anchors`
                : "No entity anchors on this page",
            tone: ocrMentions.length > 0 ? "good" : "neutral",
          },
        ]}
        compact
      />

      {doc.ocrBodyUnavailable && !firstOcrPage && (
        <p className="muted" style={{ fontSize: "0.95rem", maxWidth: "62ch" }}>
          This record has machine-generated OCR, but the page-at-a-time
          transcript table is not available yet. The reader will not
          substitute a short search-card excerpt. Apply{" "}
          <code>sql/35_search_ocr_pages.sql</code> and reload.
        </p>
      )}

      {firstOcrPage && (
        <OcrPageReader
          key={`${doc.id}-${firstOcrPage.chunkOrder ?? "first"}`}
          doc={doc}
          initialPage={firstOcrPage}
          chunkCount={readerChunkCount}
          firstChunkOrder={doc.ocrFirstChunkOrder ?? firstOcrPage.chunkOrder ?? null}
          lastChunkOrder={
            firstFromWarehouse
              ? (doc.ocrLastChunkOrder ?? firstOcrPage.chunkOrder ?? null)
              : (firstOcrPage.chunkOrder ?? null)
          }
          prevChunkOrder={doc.ocrPrevChunkOrder ?? null}
          nextChunkOrder={doc.ocrNextChunkOrder ?? null}
          lastPageLabel={lastPageLabel}
          terms={terms}
        />
      )}

      {ocrMentions.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Entity anchors on this loaded page
          </div>
          <p className="muted" style={{ fontSize: "0.84rem", marginBottom: 12 }}>
            These names appear on the page currently loaded. This is not a
            search of every page in the file.
          </p>
          <div className={styles.chunkList}>
            {ocrMentions.map((mention) => {
              const anchorId =
                mention.chunkOrder != null
                  ? `mention-chunk-${mention.chunkOrder}`
                  : `chunk-${mention.id}`;
              return (
                <div
                  key={mention.id}
                  id={anchorId}
                  className={`ocr-chunk ${styles.ocrChunk}`}
                >
                  <p
                    className={styles.ocrChunkText}
                    dangerouslySetInnerHTML={{
                      __html: `"${highlightHTML(mention.excerpt, mention.matchedTerms)}"`,
                    }}
                  />
                  <div className={`muted ${styles.ocrChunkMeta}`}>
                    <span>
                      {formatPassageMeta(mention)}
                      {formatPassageMeta(mention) ? " · " : ""}
                      source: {mention.source}
                    </span>
                    {mention.chunkOrder != null && (
                      <ChunkActions
                        naid={doc.naid}
                        chunkOrder={mention.chunkOrder}
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function formatPassageMeta(mention: MentionExcerpt): string {
  const parts = [];
  if (mention.chunkOrder != null) parts.push(`chunk ${mention.chunkOrder}`);
  if (mention.pageLabel) parts.push(mention.pageLabel);
  return parts.join(" · ");
}
