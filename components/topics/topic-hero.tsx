import type { TopicDetail } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

export function TopicHero({ topic }: { topic: TopicDetail }) {
  const ai = topic.aiSummary;
  return (
    <header
      style={{
        paddingTop: 48,
        paddingBottom: 36,
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
          marginBottom: 18,
        }}
      >
        {topic.summary}
      </p>

      {ai ? (
        <AiSummary ai={ai} />
      ) : (
        <p
          className="muted"
          style={{ maxWidth: "68ch", fontSize: "1rem", lineHeight: 1.65 }}
        >
          {topic.description}
        </p>
      )}

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

function AiSummary({ ai }: { ai: NonNullable<TopicDetail["aiSummary"]> }) {
  const paragraphs = ai.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const generated = new Date(ai.generatedAt).toISOString().slice(0, 10);
  return (
    <div style={{ maxWidth: "68ch", marginTop: 4 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          padding: "3px 9px",
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          marginBottom: 14,
        }}
        title={`Generated ${generated} by ${ai.model} from ${ai.sourceDocCount} records`}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text-muted)",
          }}
        />
        AI-generated summary
      </div>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: "1rem",
            lineHeight: 1.65,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          {p}
        </p>
      ))}
      <div
        className="muted"
        style={{
          fontSize: "0.78rem",
          marginTop: 10,
          letterSpacing: "0.01em",
        }}
      >
        Synthesized by {ai.model} from {formatNumber(ai.sourceDocCount)} records
        on {generated}. May contain inaccuracies — cross-check with the primary
        documents below.
      </div>
    </div>
  );
}
