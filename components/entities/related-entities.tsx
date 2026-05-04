import Link from "next/link";
import type { EntityCard } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

const TYPE_LABEL: Record<EntityCard["type"], string> = {
  person: "Person",
  org: "Organization",
  place: "Place",
  concept: "Concept",
};

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
      {entities.map((entity) => (
        <Link
          key={entity.slug}
          href={entity.href}
          style={{
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--text)",
            textDecoration: "none",
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
                letterSpacing: 0,
              }}
            >
              {entity.name}
            </span>
            <Badge tone="muted" size="sm">
              {TYPE_LABEL[entity.type] ?? entity.type}
            </Badge>
          </div>
          <span
            className="muted"
            style={{ fontSize: "0.86rem", lineHeight: 1.45 }}
          >
            {entity.summary.length > 110
              ? `${entity.summary.slice(0, 110).trim()}...`
              : entity.summary}
          </span>
          {entity.mentionCount !== undefined && (
            <span className="muted num" style={{ fontSize: "0.78rem" }}>
              {formatNumber(entity.mentionCount)} mentions
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
