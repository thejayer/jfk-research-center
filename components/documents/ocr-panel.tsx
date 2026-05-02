import type { DocumentDetail, MentionExcerpt } from "@/lib/api-types";
import { highlightHTML } from "@/lib/format";
import { ChunkActions } from "./chunk-actions";
import { ChunkHashHandler } from "./chunk-hash-handler";

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

  const terms = Array.from(
    new Set(mentions.flatMap((m) => m.matchedTerms)),
  );

  return (
    <section
      className="ocr-panel-section"
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
            OCR Excerpt
          </div>
          <div
            className="muted"
            style={{ fontSize: "0.84rem" }}
          >
            Machine-generated — may contain transcription errors.
          </div>
        </div>
        {doc.chunkCount !== undefined && doc.chunkCount !== null && (
          <span
            className="muted num"
            style={{ fontSize: "0.84rem" }}
          >
            {doc.chunkCount} chunks indexed
          </span>
        )}
      </div>

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
            __html: `“${highlightHTML(doc.ocrExcerpt, terms)}”`,
          }}
        />
      )}

      {mentions.length > 0 && (
        <div>
          <ChunkHashHandler />
          <div
            className="eyebrow"
            style={{ marginBottom: 12 }}
          >
            Matched passages in this record
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mentions.map((m) => {
              const anchorId =
                m.chunkOrder != null ? `chunk-${m.chunkOrder}` : `chunk-${m.id}`;
              return (
                <div
                  key={m.id}
                  id={anchorId}
                  className="ocr-chunk"
                  style={{
                    paddingLeft: 14,
                    paddingRight: 8,
                    paddingTop: 4,
                    paddingBottom: 4,
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
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `“${highlightHTML(m.excerpt, m.matchedTerms)}”`,
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
                      {m.chunkOrder != null ? `chunk ${m.chunkOrder} · ` : ""}
                      {m.pageLabel ? `${m.pageLabel} · ` : ""}source:{" "}
                      {m.source}
                    </span>
                    {m.chunkOrder != null && (
                      <ChunkActions
                        naid={doc.naid}
                        chunkOrder={m.chunkOrder}
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
