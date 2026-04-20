"use client";

import { useState } from "react";
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
}: {
  counts: Record<CaseTimelineCategory, number>;
}) {
  const [active, setActive] = useState<Set<CaseTimelineCategory>>(
    () => new Set(CATEGORIES.map((c) => c.value)),
  );

  const toggle = (c: CaseTimelineCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const hiddenCss = CATEGORIES.filter((c) => !active.has(c.value))
    .map(
      (c) =>
        `[data-timeline-event][data-category="${c.value}"]{display:none !important;}`,
    )
    .join("");

  return (
    <div
      role="group"
      aria-label="Filter timeline events by category"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 24,
      }}
    >
      {CATEGORIES.map((c) => {
        const on = active.has(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => toggle(c.value)}
            aria-pressed={on}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              fontSize: "0.78rem",
              fontFamily: "inherit",
              cursor: "pointer",
              background: on ? "var(--text)" : "transparent",
              color: on ? "var(--bg)" : "var(--text-muted)",
              letterSpacing: "0.04em",
              transition: "background 120ms, color 120ms",
            }}
          >
            {c.label} · {counts[c.value] ?? 0}
          </button>
        );
      })}
      {hiddenCss && <style>{hiddenCss}</style>}
    </div>
  );
}
