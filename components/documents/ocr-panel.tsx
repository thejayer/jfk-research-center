import type { DocumentDetail, MentionExcerpt } from "@/lib/api-types";
import { formatNumber, highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import { ChunkHashHandler } from "./chunk-hash-handler";
import { TrustStatusStrip } from "@/components/research/trust-status-strip";

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
        className="ocr-panel-empty"
        id="ocr-text"
        style={{
          padding: "28px 28px",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          OCR / Extracted Text
        </div>
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

  return (
    <section
      className="ocr-panel-section"
      id="ocr-text"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "24px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            OCR reader
          </div>
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
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 12,
            marginTop: 18,
            marginBottom: 24,
          }}
        >
          {terms.length > 0 && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "11px 12px",
                background: "color-mix(in srgb, var(--surface) 88%, var(--bg))",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Matched terms
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {terms.slice(0, 8).map((term) => (
                  <span
                    key={term}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "3px 8px",
                      fontSize: "0.76rem",
                    }}
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
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "11px 12px",
                background: "color-mix(in srgb, var(--surface) 88%, var(--bg))",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Chunk map
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chunksWithAnchors.slice(0, 12).map((mention) => (
                  <a
                    key={mention.id}
                    href={`#chunk-${mention.chunkOrder}`}
                    className="num"
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: "var(--text)",
                      textDecoration: "none",
                      fontSize: "0.76rem",
                    }}
                  >
                    {mention.chunkOrder}
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>
      )}

      {doc.ocrExcerpt && (
        <blockquote
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.12rem",
            lineHeight: 1.65,
            color: "var(--text)",
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 18,
            margin: 0,
            marginBottom: 26,
            maxWidth: "68ch",
          }}
          dangerouslySetInnerHTML={{
            __html: `"${highlightHTML(doc.ocrExcerpt, terms)}"`,
          }}
        />
      )}

      {mentions.length > 0 && (
        <div>
          <ChunkHashHandler />
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Matched passages in this record
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mentions.map((mention) => {
              const anchorId =
                mention.chunkOrder != null
                  ? `chunk-${mention.chunkOrder}`
                  : `chunk-${mention.id}`;
              return (
                <div
                  key={mention.id}
                  id={anchorId}
                  className="ocr-chunk"
                  style={{
                    paddingLeft: 14,
                    paddingRight: 8,
                    paddingTop: 4,
                    paddingBottom: 8,
                    borderLeft: "1px solid var(--border)",
                    scrollMarginTop: 80,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1rem",
                      lineHeight: 1.55,
                      color: "var(--text)",
                      maxWidth: "66ch",
                      margin: 0,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `"${highlightHTML(mention.excerpt, mention.matchedTerms)}"`,
                    }}
                  />
                  <div
                    className="muted"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      fontSize: "0.78rem",
                      marginTop: 6,
                    }}
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
