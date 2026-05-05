import type { Metadata } from "next";
import Link from "next/link";
import { fetchOpenQuestionsIndex } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { OpenQuestionsArticleBody } from "@/components/open-questions/article-body";
import { OpenQuestionsTopicCardLink } from "@/components/open-questions/topic-card";
import { TENSION_ORDER, tensionLabel } from "@/components/open-questions/tension-labels";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Open Questions",
  description:
    "Unresolved threads, contradictions, and redaction patterns in the JFK Assassination Records Collection, surfaced across every record the warehouse indexes.",
};

export const dynamic = "force-dynamic";

export default async function OpenQuestionsIndexPage() {
  const data = await fetchOpenQuestionsIndex();

  const totalThreads = data.topics.reduce((s, t) => s + t.questionCount, 0);
  const totalSources = data.topics.reduce((s, t) => s + t.sourceDocCount, 0);
  const tensionCounts = new Map<string, number>();
  for (const topic of data.topics) {
    for (const [type, count] of Object.entries(topic.tensionCounts)) {
      tensionCounts.set(type, (tensionCounts.get(type) ?? 0) + count);
    }
  }
  const topTensions = [
    ...TENSION_ORDER,
    ...Array.from(tensionCounts.keys()).filter(
      (key) => !TENSION_ORDER.includes(key as (typeof TENSION_ORDER)[number]),
    ),
  ]
    .map((type) => ({ type, count: tensionCounts.get(type) ?? 0 }))
    .filter((item) => item.count > 0);

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Open Questions</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 40,
          paddingBottom: 34,
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Cross-topic analysis
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Open Questions in the Records
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            The JFK Assassination Records Collection contains genuine tensions:
            contradictions between agency files, timing oddities, redactions
            that persisted for decades, and references that still lack context.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, margin: 0 }}
          >
            A map-reduce pipeline reads topic records, extracts candidate open
            questions, and synthesizes them into neutral archival prose. This
            surface highlights unresolved threads; it does not advocate a
            theory or defend an official account.
          </p>
        </div>

        <aside
          aria-label="Open questions profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Research profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              ["Topics", data.topics.length],
              ["Threads", totalThreads],
              ["Records", data.global?.sourceDocCount ?? totalSources],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div className="num" style={{ fontSize: "1.2rem" }}>
                  {formatNumber(Number(value))}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.66rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginTop: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            These are research leads, not conclusions. Established findings
            stay in <Link href="/established-facts">Established Facts</Link>.
          </p>
        </aside>
      </header>

      {topTensions.length > 0 && (
        <nav
          aria-label="Open question tension types"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 36,
          }}
        >
          {topTensions.map((item) => (
            <a
              key={item.type}
              href="#topic-open-questions"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--surface)",
                color: "var(--text)",
                textDecoration: "none",
                fontSize: "0.84rem",
              }}
            >
              <span>{tensionLabel(item.type)}</span>
              <span className="muted num">{item.count}</span>
            </a>
          ))}
        </nav>
      )}

      {data.global ? (
        <section
          aria-label="Cross-topic synthesis"
          style={{
            marginTop: 8,
            padding: "28px 0 34px",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <OpenQuestionsArticleBody
            article={data.global}
            label="Cross-topic synthesis"
          />
        </section>
      ) : (
        <section
          aria-label="Cross-topic synthesis pending"
          style={{
            marginTop: 8,
            padding: "24px 26px",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-strong)",
            color: "var(--text-muted)",
            background: "var(--surface)",
            maxWidth: "64ch",
            fontSize: "0.95rem",
            lineHeight: 1.6,
          }}
        >
          The cross-topic synthesis has not been generated yet. Rebuild the
          warehouse without <code>--skip-open-questions</code> to populate it.
        </section>
      )}

      {data.topics.length > 0 && (
        <section
          id="topic-open-questions"
          aria-label="Per-topic open questions"
          style={{ marginTop: 64 }}
        >
          <SectionHeading
            eyebrow="By topic"
            title="Open questions in each topic"
            description="Each topic has its own long-form piece drawn from the records the warehouse holds for that subject."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {data.topics.map((card) => (
              <OpenQuestionsTopicCardLink key={card.slug} card={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
