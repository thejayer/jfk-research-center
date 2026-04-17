"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { SearchFilters as FacetData } from "@/lib/api-types";

type FilterKey = "agency" | "year" | "entity" | "topic" | "confidence";

export function SearchFilters({ filters }: { filters: FacetData }) {
  const router = useRouter();
  const params = useSearchParams();

  const [openGroups, setOpenGroups] = useState<Record<FilterKey, boolean>>({
    agency: true,
    year: true,
    entity: false,
    topic: false,
    confidence: false,
  });

  const toggleParam = useCallback(
    (key: FilterKey, value: string) => {
      const sp = new URLSearchParams(Array.from(params?.entries() ?? []));
      const existing = sp.getAll(key);
      const has = existing.includes(value);
      sp.delete(key);
      const next = has
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      for (const v of next) sp.append(key, v);
      router.push(`/search?${sp.toString()}`);
    },
    [params, router],
  );

  const clearKey = useCallback(
    (key: FilterKey) => {
      const sp = new URLSearchParams(Array.from(params?.entries() ?? []));
      sp.delete(key);
      router.push(`/search?${sp.toString()}`);
    },
    [params, router],
  );

  const isActive = useCallback(
    (key: FilterKey, value: string) => {
      const vs = params?.getAll(key) ?? [];
      return vs.includes(value);
    },
    [params],
  );

  const activeTotal = FILTER_GROUPS.reduce(
    (n, g) => n + (params?.getAll(g.key).length ?? 0),
    0,
  );

  return (
    <aside
      aria-label="Search filters"
      style={{
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          padding: "12px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="eyebrow"
          style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
        >
          Filters{activeTotal ? ` · ${activeTotal} active` : ""}
        </span>
        {activeTotal > 0 && (
          <Link
            href={buildClearUrl(params)}
            style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}
          >
            Clear all
          </Link>
        )}
      </div>

      {FILTER_GROUPS.map((g) => {
        const values = g.fromFilters(filters);
        const activeCount = params?.getAll(g.key).length ?? 0;
        return (
          <FilterGroup
            key={g.key}
            label={g.label}
            values={values}
            isActive={(v) => isActive(g.key, v)}
            onToggle={(v) => toggleParam(g.key, v)}
            activeCount={activeCount}
            onClear={() => clearKey(g.key)}
            open={openGroups[g.key]}
            onToggleOpen={() =>
              setOpenGroups((s) => ({ ...s, [g.key]: !s[g.key] }))
            }
          />
        );
      })}
    </aside>
  );
}

function buildClearUrl(params: URLSearchParams | null | ReturnType<typeof useSearchParams>) {
  const sp = new URLSearchParams();
  const q = params?.get("q") ?? "";
  const mode = params?.get("mode") ?? "";
  if (q) sp.set("q", q);
  if (mode) sp.set("mode", mode);
  const qs = sp.toString();
  return qs ? `/search?${qs}` : "/search";
}

type Group = {
  key: FilterKey;
  label: string;
  fromFilters: (f: FacetData) => string[];
};

const FILTER_GROUPS: Group[] = [
  { key: "agency", label: "Agency", fromFilters: (f) => f.agencies },
  { key: "year", label: "Year", fromFilters: (f) => f.years },
  { key: "entity", label: "Entity", fromFilters: (f) => f.entities },
  { key: "topic", label: "Topic", fromFilters: (f) => f.topics },
  {
    key: "confidence",
    label: "Confidence",
    fromFilters: (f) => f.confidence as string[],
  },
];

function FilterGroup({
  label,
  values,
  isActive,
  onToggle,
  activeCount,
  onClear,
  open,
  onToggleOpen,
}: {
  label: string;
  values: string[];
  isActive: (v: string) => boolean;
  onToggle: (v: string) => void;
  activeCount: number;
  onClear: () => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? values : values.slice(0, 8);

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 0",
          color: "var(--text)",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {label}
          {activeCount > 0 && (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              {activeCount}
            </span>
          )}
        </span>
        <span
          aria-hidden
          style={{
            color: "var(--text-muted)",
            transform: `rotate(${open ? 90 : 0}deg)`,
            transition: "transform var(--motion)",
            fontSize: "0.8rem",
          }}
        >
          ▸
        </span>
      </button>
      {open && (
        <div
          style={{
            paddingBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                alignSelf: "flex-start",
                fontSize: "0.74rem",
                color: "var(--text-muted)",
                padding: "2px 0",
              }}
            >
              Clear
            </button>
          )}
          {shown.map((v) => {
            const active = isActive(v);
            return (
              <label
                key={v}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.88rem",
                  color: active ? "var(--text)" : "var(--text-muted)",
                  cursor: "pointer",
                  padding: "2px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggle(v)}
                  style={{ accentColor: "var(--accent)" }}
                  aria-label={`${label}: ${v}`}
                />
                <span>{v}</span>
              </label>
            );
          })}
          {!showAll && values.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                alignSelf: "flex-start",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                padding: "2px 0",
              }}
            >
              Show {values.length - 8} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
