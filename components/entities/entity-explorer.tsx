"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EntityCard } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

const TYPE_LABEL: Record<EntityCard["type"], string> = {
  person: "Person",
  org: "Organization",
  place: "Place",
  concept: "Concept",
};

const TYPE_ORDER: EntityCard["type"][] = ["person", "org", "place", "concept"];

export function EntityExplorer({ entities }: { entities: EntityCard[] }) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntityCard["type"] | "all">("all");

  const typeCounts = useMemo(() => {
    const counts: Record<EntityCard["type"], number> = {
      person: 0,
      org: 0,
      place: 0,
      concept: 0,
    };
    for (const entity of entities) counts[entity.type] += 1;
    return counts;
  }, [entities]);

  const visibleEntities = useMemo(() => {
    const normalizedQuery = normalize(query);
    return entities
      .filter((entity) => activeType === "all" || entity.type === activeType)
      .filter((entity) => {
        if (!normalizedQuery) return true;
        const haystack = normalize(
          [
            entity.name,
            entity.summary,
            entity.type,
            ...(entity.aliases ?? []),
          ].join(" "),
        );
        return haystack.includes(normalizedQuery);
      })
      .toSorted((a, b) => {
        const mentionDelta = (b.mentionCount ?? 0) - (a.mentionCount ?? 0);
        if (mentionDelta !== 0) return mentionDelta;
        return a.name.localeCompare(b.name);
      });
  }, [entities, activeType, query]);

  const hasFilters = query.trim() || activeType !== "all";

  return (
    <section aria-label="Entity explorer">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "0 14px",
            height: 48,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, alias, agency, or summary"
            aria-label="Filter entities"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text)",
              font: "inherit",
              fontSize: "0.96rem",
            }}
          />
          {query && (
            <button
              type="button"
              className="entity-clear-button"
              onClick={() => setQuery("")}
              aria-label="Clear entity filter"
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              <span aria-hidden="true">x</span>
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Filter by entity type"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <TypeFilter
            label="All"
            count={entities.length}
            active={activeType === "all"}
            onClick={() => setActiveType("all")}
          />
          {TYPE_ORDER.filter((type) => typeCounts[type] > 0).map((type) => (
            <TypeFilter
              key={type}
              label={TYPE_LABEL[type]}
              count={typeCounts[type]}
              active={activeType === type}
              onClick={() => setActiveType(type)}
            />
          ))}
          {hasFilters && (
            <button
              type="button"
              className="entity-reset-button"
              onClick={() => {
                setQuery("");
                setActiveType("all");
              }}
              style={{
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                padding: "6px 2px",
                background: "transparent",
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div
          className="muted"
          aria-live="polite"
          style={{ fontSize: "0.86rem" }}
        >
          Showing {formatNumber(visibleEntities.length)} of{" "}
          {formatNumber(entities.length)} entities.
        </div>
      </div>

      {visibleEntities.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "28px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.25rem",
              marginBottom: 6,
            }}
          >
            No matching entities.
          </div>
          <p className="muted" style={{ fontSize: "0.94rem", lineHeight: 1.55 }}>
            Try a shorter name, an alias, or switch back to all entity types.
          </p>
        </div>
      ) : (
        <EntityGrid entities={visibleEntities} />
      )}
    </section>
  );
}

function EntityGrid({ entities }: { entities: EntityCard[] }) {
  return (
    <ul
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14,
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {entities.map((entity) => (
        <li key={entity.slug}>
          <EntityCardLink entity={entity} />
        </li>
      ))}
    </ul>
  );
}

function EntityCardLink({ entity }: { entity: EntityCard }) {
  return (
    <Link
      href={entity.href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "18px 20px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        color: "var(--text)",
        textDecoration: "none",
        height: "100%",
        minHeight: 148,
        transition: "border-color var(--motion), box-shadow var(--motion)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Badge tone="muted" size="sm">
          {TYPE_LABEL[entity.type] ?? entity.type}
        </Badge>
        {entity.mentionCount !== undefined && entity.mentionCount > 0 && (
          <span className="muted num" style={{ fontSize: "0.8rem" }}>
            {formatNumber(entity.mentionCount)} mentions
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.15rem",
          letterSpacing: 0,
          lineHeight: 1.25,
        }}
      >
        {entity.name}
      </div>
      <p
        className="muted"
        style={{
          fontSize: "0.88rem",
          lineHeight: 1.55,
          flex: 1,
          margin: 0,
        }}
      >
        {entity.summary.length > 190
          ? `${entity.summary.slice(0, 190).trim()}...`
          : entity.summary}
      </p>
    </Link>
  );
}

function TypeFilter({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 11px",
        border: "1px solid",
        borderColor: active ? "var(--text)" : "var(--border)",
        borderRadius: "var(--radius-sm)",
        background: active ? "var(--text)" : "var(--surface)",
        color: active ? "var(--bg)" : "var(--text)",
        fontSize: "0.86rem",
      }}
    >
      <span>{label}</span>
      <span className="num" style={{ opacity: 0.72 }}>
        {formatNumber(count)}
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M13.5 13.5 L10.5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
