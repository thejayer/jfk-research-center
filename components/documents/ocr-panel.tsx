import type { DocumentDetail, MentionExcerpt } from "@/lib/api-types";
import { formatNumber, highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import { ChunkHashHandler } from "./chunk-hash-handler";
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
          linked digital object for visual inspection.
        </p>
      </section>
    );
  }

  const terms = Array.from(new Set(mentions.flatMap((m) => m.matchedTerms)));
  const chunksWithAnchors = mentions.filter((mention) => mention.chunkOrder != null);
  const firstOcrPage = doc.ocrPages?.[0] ??
    (doc.ocrExcerpt
      ? {
          pageLabel: "p. 1",
          text: doc.ocrExcerpt,
          chunkOrder: doc.ocrFirstChunkOrder ?? 1,
        }
      : null);

  return (
    <section
      className={`${styles.ocrPanel} ocr-panel-section`}
      id="ocr-text"
      aria-labelledby="ocr-text-title"
    >
      <div className={styles.ocrHeader}>
        <div>
          <div className="eyebrow">Document transcript</div>
          <h2 id="ocr-text-title" className={styles.ocrTitle}>
            OCR reader
          </h2>
          <div className="muted" style={{ fontSize: "0.84rem" }}>
            Machine-generated text; may contain transcription errors.
          </div>
        </div>
        {doc.chunkCount !== undefined && doc.chunkCount !== null && (
          <span className="muted num" style={{ fontSize: "0.84rem" }}>
            {formatNumber(doc.chunkCount)} chunks indexed
          </span>
        )}
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
            label: "Coverage",
            value: formatReaderCoverage(doc.pageCount, doc.chunkCount),
            tone: "neutral",
          },
          {
            label: "Matches",
            value:
              mentions.length > 0
                ? `${formatNumber(mentions.length)} passage anchors`
                : "No matched passages",
            tone: mentions.length > 0 ? "good" : "neutral",
          },
        ]}
        compact
      />

      {(terms.length > 0 || chunksWithAnchors.length > 0) && (
        <div
          aria-label="OCR reader map"
          className={styles.ocrMap}
        >
          {terms.length > 0 && (
            <div className={styles.ocrMapCard}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Matched terms
              </div>
              <div className={styles.tokenList}>
                {terms.slice(0, 8).map((term) => (
                  <span
                    key={term}
                    className={styles.token}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
          {chunksWithAnchors.length > 0 && (
            <nav
              aria-label="OCR chunk jump"
              className={styles.ocrMapCard}
            >
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Chunk map
              </div>
              <div className={styles.tokenList}>
                {chunksWithAnchors.slice(0, 12).map((mention) => (
                  <a
                    key={mention.id}
                    href={`#chunk-${mention.chunkOrder}`}
                    className={`num ${styles.token}`}
                  >
                    {mention.chunkOrder}
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>
      )}

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
          key={doc.id}
          doc={doc}
          initialPage={firstOcrPage}
          chunkCount={doc.chunkCount ?? 1}
          firstChunkOrder={doc.ocrFirstChunkOrder ?? firstOcrPage.chunkOrder ?? null}
          lastChunkOrder={doc.ocrLastChunkOrder ?? firstOcrPage.chunkOrder ?? null}
          prevChunkOrder={doc.ocrPrevChunkOrder ?? null}
          nextChunkOrder={doc.ocrNextChunkOrder ?? null}
          terms={terms}
        />
      )}

      {mentions.length > 0 && (
        <div>
          <ChunkHashHandler />
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Matched passages in this record
          </div>
          <div className={styles.chunkList}>
            {mentions.map((mention) => {
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
                  <div
                    className={`muted ${styles.ocrChunkMeta}`}
                  >
                    <span>
                      {formatPassageMeta(mention)}
                      {formatPassageMeta(mention) ? " | " : ""}
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

function formatReaderCoverage(
  pageCount?: number | null,
  chunkCount?: number | null,
): string {
  const parts = [];
  if (pageCount) parts.push(`${formatNumber(pageCount)} pages`);
  if (chunkCount) parts.push(`${formatNumber(chunkCount)} chunks`);
  return parts.length > 0 ? parts.join(" / ") : "Indexed record";
}

function formatPassageMeta(mention: MentionExcerpt): string {
  const parts = [];
  if (mention.chunkOrder != null) parts.push(`chunk ${mention.chunkOrder}`);
  if (mention.pageLabel) parts.push(mention.pageLabel);
  return parts.join(" | ");
}
