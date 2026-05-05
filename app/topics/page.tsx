import type { Metadata } from "next";
import Link from "next/link";
import { fetchTopics } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Cross-cutting subjects for browsing the JFK Assassination Records Collection: investigations, agencies, and pivotal locations.",
};

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = await fetchTopics();
  const documentCount = topics.reduce(
    (total, topic) => total + topic.documentCount,
    0,
  );
  const largestTopic = topics.toSorted(
    (a, b) => b.documentCount - a.documentCount,
  )[0];

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>Topics</span>
      </nav>

      <header style={{ paddingTop: 40, paddingBottom: 30 }}>
        <div className="topic-index-hero">
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                letterSpacing: 0,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Subjects &amp; investigations
            </h1>
            <p
              className="muted"
              style={{
                maxWidth: "68ch",
                fontSize: "1rem",
                lineHeight: 1.65,
              }}
            >
              Curated subject collections pulled from the warehouse. Each topic
              gathers primary records, people, organizations, matched passages,
              and AI-assisted reading notes into one research lane.
            </p>
          </div>
          <aside
            aria-label="Topic index summary"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              padding: "18px 20px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Research map
            </div>
            <dl style={{ display: "grid", gap: 14, margin: 0 }}>
              <TopicStat label="Topics" value={formatNumber(topics.length)} />
              <TopicStat label="Documents" value={formatNumber(documentCount)} />
              {largestTopic && (
                <TopicStat
                  label="Largest lane"
                  value={largestTopic.title}
                  compact
                />
              )}
            </dl>
          </aside>
        </div>
      </header>

      <SectionHeading
        eyebrow={`${formatNumber(topics.length)} topics`}
        title="Browse the research lanes"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {topics
          .toSorted((a, b) => b.documentCount - a.documentCount)
          .map((topic) => (
            <Link
              key={topic.slug}
              href={topic.href}
              style={{
                padding: "20px 22px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                color: "var(--text)",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition:
                  "border-color var(--motion), background var(--motion)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {topic.eyebrow && <span className="eyebrow">{topic.eyebrow}</span>}
                <span
                  className="muted num"
                  style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}
                >
                  {formatNumber(topic.documentCount)}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.22rem",
                  letterSpacing: 0,
                  lineHeight: 1.2,
                }}
              >
                {topic.title}
              </span>
              <span
                className="muted"
                style={{ fontSize: "0.9rem", lineHeight: 1.5 }}
              >
                {topic.summary}
              </span>
              <span
                style={{
                  marginTop: "auto",
                  paddingTop: 4,
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Open dossier
                <ArrowRightIcon />
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}

function TopicStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className={compact ? undefined : "num"}
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: compact ? "1.05rem" : "1.7rem",
          lineHeight: 1.15,
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
      width="14"
      height="14"
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
