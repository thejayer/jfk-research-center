import type { EditorialFootnote } from "@/lib/api-types";

/**
 * Renders standing editorial footnotes attached to an analysis surface —
 * e.g. the NAS/Ramsey Panel rebuttal that must accompany any reference to
 * the HSCA's 1979 acoustic finding. Data comes from
 * `jfk_curated.editorial_footnotes`, filtered server-side.
 */
export function EditorialFootnotes({
  notes,
}: {
  notes: EditorialFootnote[];
}) {
  if (notes.length === 0) return null;

  return (
    <aside
      aria-label="Editorial notes"
      style={{
        marginTop: 28,
        padding: "18px 20px",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--border-strong)",
        borderRadius: "var(--radius-sm, 6px)",
        background: "color-mix(in srgb, var(--surface) 60%, transparent)",
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        Editorial notes
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {notes.map((n) => (
          <li key={n.id} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.02rem",
                letterSpacing: "-0.005em",
                marginBottom: 4,
              }}
            >
              {n.title}
            </div>
            <p
              style={{
                fontSize: "0.92rem",
                lineHeight: 1.6,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              {n.body}
            </p>
            <p
              className="muted"
              style={{
                fontSize: "0.8rem",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              {n.sourceCitation}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
