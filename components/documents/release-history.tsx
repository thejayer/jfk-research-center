import type { ReleaseHistoryEntry } from "@/lib/api-types";
import { formatDate } from "@/lib/format";

/**
 * Renders the per-record release history as a compact left-to-right strip.
 * Earliest appearance on the left, latest on the right. The 2025 OCR-source
 * node is highlighted so readers see where the indexed text actually came
 * from — key disclosure when an older "released 2018" tag sits next to
 * content that only became readable after the March 2025 unredaction.
 */
export function ReleaseHistory({
  entries,
}: {
  entries: ReleaseHistoryEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="Release history"
      style={{
        marginTop: 32,
        padding: "16px 18px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md, 8px)",
        background: "var(--surface)",
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        Release history
      </div>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {entries.map((e, i) => (
          <li
            key={`${e.releaseSet}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "6px 12px",
                border: e.isOcrSource
                  ? "1px solid var(--text)"
                  : "1px solid var(--border-strong)",
                borderRadius: 999,
                background: e.isOcrSource
                  ? "var(--text)"
                  : "transparent",
                color: e.isOcrSource ? "var(--bg)" : "var(--text)",
                minWidth: 0,
              }}
              title={
                e.isOcrSource
                  ? `OCR text on this page was sourced from the ${e.releaseSet} release`
                  : `Record appeared in the ${e.releaseSet} release`
              }
            >
              <span
                className="num"
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                }}
              >
                {e.releaseSet}
              </span>
              {e.releaseDate && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.85,
                  }}
                >
                  {formatDate(e.releaseDate)}
                </span>
              )}
            </div>
            {i < entries.length - 1 && (
              <span
                aria-hidden
                className="muted"
                style={{ fontSize: "0.85rem" }}
              >
                &rarr;
              </span>
            )}
          </li>
        ))}
      </ol>
      {entries.some((e) => e.isOcrSource) && (
        <p
          className="muted"
          style={{
            fontSize: "0.8rem",
            lineHeight: 1.5,
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          The highlighted release is where the OCR text on this page was
          sourced. Earlier releases are the record&rsquo;s prior
          appearances (typically with heavier redaction).
        </p>
      )}
    </section>
  );
}
