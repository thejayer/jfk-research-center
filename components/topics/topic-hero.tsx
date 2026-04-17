import type { TopicDetail } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

export function TopicHero({ topic }: { topic: TopicDetail }) {
  return (
    <header
      style={{
        paddingTop: 48,
        paddingBottom: 40,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {topic.eyebrow && (
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {topic.eyebrow}
        </div>
      )}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          letterSpacing: "-0.02em",
          fontWeight: 500,
          marginBottom: 16,
        }}
      >
        {topic.title}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.08rem, 0.9rem + 0.5vw, 1.3rem)",
          maxWidth: "62ch",
          lineHeight: 1.45,
          color: "var(--text)",
          marginBottom: 16,
        }}
      >
        {topic.summary}
      </p>
      <p
        className="muted"
        style={{ maxWidth: "68ch", fontSize: "1rem", lineHeight: 1.65 }}
      >
        {topic.description}
      </p>
      <div
        className="num muted"
        style={{
          marginTop: 22,
          fontSize: "0.88rem",
          letterSpacing: "0.02em",
        }}
      >
        {formatNumber(topic.documentCount)} documents in this topic
      </div>
    </header>
  );
}
