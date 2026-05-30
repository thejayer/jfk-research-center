"use client";

import { useEffect, useState } from "react";
import type { CaseTimelineCategory } from "@/lib/api-types";

const CATEGORIES: ReadonlyArray<{
  value: CaseTimelineCategory;
  label: string;
}> = [
  { value: "biographical", label: "Biographical" },
  { value: "operational", label: "Operational" },
  { value: "investigation", label: "Investigation" },
  { value: "release", label: "Release" },
  { value: "death", label: "Death" },
];

export function CategoryFilterChips({
  counts,
  initialCategory,
}: {
  counts: Record<CaseTimelineCategory, number>;
  initialCategory?: CaseTimelineCategory;
}) {
  const [active, setActive] = useState<Set<CaseTimelineCategory>>(
    () => getInitialActive(initialCategory),
  );
  const allValues = CATEGORIES.map((category) => category.value);
  const allActive = active.size === CATEGORIES.length;
  const totalEvents = CATEGORIES.reduce(
    (total, category) => total + (counts[category.value] ?? 0),
    0,
  );

  useEffect(() => {
    setActive(getInitialActive(initialCategory));
  }, [initialCategory]);

  const toggle = (category: CaseTimelineCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next.size > 0 ? next : new Set(allValues);
    });
  };

  const showAll = () => {
    setActive(new Set(allValues));
  };

  const hiddenCss = CATEGORIES.filter((category) => !active.has(category.value))
    .map(
      (category) =>
        `[data-timeline-event][data-category="${category.value}"]{display:none !important;}`,
    )
    .join("");

  return (
    <div
      role="group"
      aria-label="Filter timeline events by category"
      style={{
        display: "grid",
        gap: 8,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="eyebrow" style={{ letterSpacing: "0.1em" }}>
          Category focus
        </div>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          Select one or more lanes
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={showAll}
          aria-pressed={allActive}
          style={chipStyle(allActive)}
        >
          All categories / {totalEvents.toLocaleString()}
        </button>
        {CATEGORIES.map((category) => {
          const on = active.has(category.value);
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => toggle(category.value)}
              aria-pressed={on}
              style={chipStyle(on)}
            >
              {category.label} /{" "}
              {(counts[category.value] ?? 0).toLocaleString()}
            </button>
          );
        })}
      </div>
      {hiddenCss && <style>{hiddenCss}</style>}
    </div>
  );
}

function getInitialActive(initialCategory: CaseTimelineCategory | undefined) {
  if (initialCategory) {
    return new Set<CaseTimelineCategory>([initialCategory]);
  }
  return new Set(CATEGORIES.map((category) => category.value));
}

function chipStyle(active: boolean) {
  return {
    padding: "6px 12px",
    border: "1px solid var(--border-strong)",
    borderRadius: 999,
    fontSize: "0.78rem",
    fontFamily: "inherit",
    cursor: "pointer",
    background: active ? "var(--text)" : "transparent",
    color: active ? "var(--bg)" : "var(--text-muted)",
    letterSpacing: "0.04em",
    transition: "background 120ms, color 120ms",
  } as const;
}
