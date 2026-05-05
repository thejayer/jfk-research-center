import type { TopicDetail } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export function TopicHero({
  topic,
  searchHref,
  documentsHref,
  entityCount,
  passageCount,
}: {
  topic: TopicDetail;
  searchHref: string;
  documentsHref: string;
  entityCount: number;
  passageCount: number;
}) {
  const summarySourceCount =
    topic.aiArticle?.sourceDocCount ?? topic.aiSummary?.sourceDocCount;

  return (
    <header
      style={{
        paddingTop: 48,
        paddingBottom: 38,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="topic-dossier-hero">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {topic.eyebrow && (
              <Badge tone="accent" size="sm">
                {topic.eyebrow}
              </Badge>
            )}
            <span className="muted num" style={{ fontSize: "0.86rem" }}>
              {formatNumber(topic.documentCount)} documents
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
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
              marginBottom: 22,
            }}
          >
            {topic.summary}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <LinkButton href={searchHref} variant="primary">
              Search this topic
              <ArrowRightIcon />
            </LinkButton>
            <LinkButton href={documentsHref} variant="secondary">
              Browse records
              <ArrowRightIcon />
            </LinkButton>
          </div>
        </div>

        <aside
          aria-label={`${topic.title} topic profile`}
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "18px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Topic profile
          </div>
          <dl style={{ display: "grid", gap: 14, margin: 0 }}>
            <Stat label="Documents" value={formatNumber(topic.documentCount)} />
            <Stat label="Entities" value={formatNumber(entityCount)} />
            <Stat label="Passages" value={formatNumber(passageCount)} />
            {summarySourceCount !== undefined && (
              <Stat
                label="Summary sources"
                value={formatNumber(summarySourceCount)}
              />
            )}
          </dl>
        </aside>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.7rem",
          lineHeight: 1.1,
          margin: 0,
          marginTop: 5,
          color: "var(--text)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
