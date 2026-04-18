import type { EntitySource } from "@/lib/api-types";

/**
 * Renders the curated primary-source and reference list that grounds an
 * entity's bio and timeline. Phase 0 precursor to per-sentence citations
 * (Phase 1, BQ-1H). Data comes from `jfk_curated.jfk_entity_sources`.
 */
export function EntitySources({ sources }: { sources: EntitySource[] }) {
  if (sources.length === 0) return null;

  return (
    <ol
      style={{
        margin: 0,
        paddingLeft: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {sources.map((s, i) => (
        <li
          key={i}
          style={{
            fontSize: "0.92rem",
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          <div>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ) : (
              <span>{s.label}</span>
            )}
            <span
              className="muted"
              style={{
                marginLeft: 8,
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {s.kind}
            </span>
          </div>
          {s.note && (
            <div
              className="muted"
              style={{ fontSize: "0.85rem", lineHeight: 1.5, marginTop: 2 }}
            >
              {s.note}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
