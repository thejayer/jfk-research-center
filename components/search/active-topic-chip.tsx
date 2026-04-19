"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Renders a removable chip above the search results when one or more
 * topic filters are active. Backs the topic-scoped search flow that
 * lands here from "Search within topic →" on each topic page.
 *
 * Other filter facets (agency, entity, confidence) are still managed
 * via the sidebar; topic gets the surfaced chip because the topic-scoped
 * entry point is the most common path that lands users on /search with
 * a non-empty filter and an empty query.
 */
export function ActiveTopicChip({
  topicLabels,
}: {
  topicLabels: Record<string, string>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const topics = params?.getAll("topic") ?? [];
  if (topics.length === 0) return null;

  const remove = (slug: string) => {
    const sp = new URLSearchParams(Array.from(params?.entries() ?? []));
    sp.delete("topic");
    for (const t of topics.filter((x) => x !== slug)) sp.append("topic", t);
    const qs = sp.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  return (
    <div
      role="region"
      aria-label="Active topic filters"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      <span
        className="eyebrow"
        style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
      >
        Filtered to topic
      </span>
      {topics.map((slug) => {
        const label = topicLabels[slug] ?? slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => remove(slug)}
            aria-label={`Remove topic filter: ${label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-strong)",
              background: "var(--accent-soft, color-mix(in srgb, var(--accent) 12%, transparent))",
              color: "var(--text)",
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            <span>{label}</span>
            <span aria-hidden style={{ color: "var(--text-muted)" }}>
              ✕
            </span>
          </button>
        );
      })}
    </div>
  );
}
