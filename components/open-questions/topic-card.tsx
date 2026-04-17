import Link from "next/link";
import type { OpenQuestionsTopicCard } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";
import { TENSION_ORDER, tensionLabel } from "./tension-labels";

export function OpenQuestionsTopicCardLink({
  card,
}: {
  card: OpenQuestionsTopicCard;
}) {
  const topTensions = TENSION_ORDER.map((t) => ({
    type: t,
    count: card.tensionCounts[t] ?? 0,
  }))
    .filter((t) => t.count > 0)
    .slice(0, 3);

  return (
    <Link
      href={card.href}
      style={{
        padding: "22px 24px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color var(--motion), background var(--motion)",
      }}
    >
      {card.eyebrow && <span className="eyebrow">{card.eyebrow}</span>}
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.22rem",
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
        }}
      >
        Open Questions — {card.title}
      </span>
      <span
        className="muted"
        style={{ fontSize: "0.92rem", lineHeight: 1.55 }}
      >
        {card.summary}
      </span>

      {topTensions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 2,
          }}
        >
          {topTensions.map((t) => (
            <span
              key={t.type}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                fontSize: "0.72rem",
                letterSpacing: "0.02em",
                color: "var(--text-muted)",
                background: "var(--bg)",
              }}
            >
              {tensionLabel(t.type)} · <span className="num">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      <span
        className="muted num"
        style={{
          fontSize: "0.78rem",
          marginTop: "auto",
          paddingTop: 4,
        }}
      >
        {formatNumber(card.questionCount)} threads ·{" "}
        {formatNumber(card.sourceDocCount)} cited documents
      </span>
    </Link>
  );
}
