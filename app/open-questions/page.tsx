import type { Metadata } from "next";
import Link from "next/link";
import { fetchOpenQuestionsIndex } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { OpenQuestionsArticleBody } from "@/components/open-questions/article-body";
import { OpenQuestionsTopicCardLink } from "@/components/open-questions/topic-card";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Open Questions",
  description:
    "Unresolved threads, contradictions, and redaction patterns in the JFK Assassination Records Collection — surfaced across every record the warehouse indexes.",
};

export const dynamic = "force-dynamic";

export default async function OpenQuestionsIndexPage() {
  const data = await fetchOpenQuestionsIndex();

  const totalThreads = data.topics.reduce((s, t) => s + t.questionCount, 0);

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>Open Questions</span>
      </nav>

      <header style={{ paddingTop: 40, paddingBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Cross-topic analysis
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            letterSpacing: "-0.02em",
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
            maxWidth: "64ch",
            lineHeight: 1.5,
            color: "var(--text)",
            marginBottom: 16,
          }}
        >
          The JFK Assassination Records Collection contains genuine tensions
          — contradictions between agency files, timing oddities, redactions
          that persisted for decades, and references that still lack
          context. This page is a corpus-wide reading of those tensions.
        </p>
        <p
          className="muted"
          style={{ maxWidth: "64ch", fontSize: "0.95rem", lineHeight: 1.65 }}
        >
          A map-reduce pipeline reads every record in each topic, extracts
          candidate open questions, and synthesizes them into neutral
          archival prose. The analysis surfaces unresolved threads; it does
          not advocate any particular theory of the assassination, and it
          does not defend any official account either.
        </p>
        {totalThreads > 0 && (
          <div
            className="num muted"
            style={{
              marginTop: 18,
              fontSize: "0.85rem",
              letterSpacing: "0.02em",
            }}
          >
            {formatNumber(totalThreads)} threads across{" "}
            {formatNumber(data.topics.length)} topics
          </div>
        )}
      </header>

      {data.global ? (
        <section
          aria-label="Cross-topic synthesis"
          style={{
            marginTop: 8,
            paddingTop: 28,
            paddingBottom: 32,
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
          The cross-topic synthesis has not been generated yet. Rebuild
          the warehouse (without <code>--skip-open-questions</code>) to
          populate it.
        </section>
      )}

      {data.topics.length > 0 && (
        <section aria-label="Per-topic open questions" style={{ marginTop: 64 }}>
          <SectionHeading
            eyebrow="By topic"
            title="Open questions in each topic"
            description="Each topic has its own long-form piece drawn from every record the warehouse holds for that subject."
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
