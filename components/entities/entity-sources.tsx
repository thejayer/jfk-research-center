import type { EntitySource } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";

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
        padding: 0,
        listStyle: "none",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
      }}
    >
      {sources.map((source, index) => (
        <li
          key={index}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "15px 16px",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span
              className="num"
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.76rem",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 8 }}>
                <Badge tone="muted" size="sm">
                  {source.kind}
                </Badge>
              </div>
              <div
                style={{
                  fontSize: "0.94rem",
                  lineHeight: 1.45,
                  color: "var(--text)",
                }}
              >
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>
                ) : (
                  <span>{source.label}</span>
                )}
              </div>
              {source.note && (
                <p
                  className="muted"
                  style={{ fontSize: "0.84rem", lineHeight: 1.5, marginTop: 7 }}
                >
                  {source.note}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
