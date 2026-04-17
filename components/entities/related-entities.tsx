import Link from "next/link";
import type { EntityCard } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export function RelatedEntities({ entities }: { entities: EntityCard[] }) {
  if (entities.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {entities.map((e) => (
        <Link
          key={e.slug}
          href={e.href}
          style={{
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--text)",
            transition: "border-color var(--motion), background var(--motion)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.05rem",
                letterSpacing: "-0.005em",
              }}
            >
              {e.name}
            </span>
            <Badge tone="muted" size="sm">
              {e.type}
            </Badge>
          </div>
          <span
            className="muted"
            style={{ fontSize: "0.86rem", lineHeight: 1.45 }}
          >
            {e.summary.length > 110
              ? `${e.summary.slice(0, 110).trim()}…`
              : e.summary}
          </span>
          {e.mentionCount !== undefined && (
            <span
              className="muted num"
              style={{ fontSize: "0.78rem" }}
            >
              {formatNumber(e.mentionCount)} mentions
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
