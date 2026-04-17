import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchOpenQuestionsTopic } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { OpenQuestionsArticleBody } from "@/components/open-questions/article-body";
import { OpenQuestionsThreadList } from "@/components/open-questions/thread-list";
import { LinkButton } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import layout from "@/components/ui/two-column.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchOpenQuestionsTopic(slug);
  if (!data) return { title: "Open Questions — not found" };
  return {
    title: `Open Questions — ${data.title}`,
    description: `Unresolved threads and contradictions in the ${data.title} records of the JFK Assassination Records Collection.`,
  };
}

export default async function OpenQuestionsTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchOpenQuestionsTopic(slug);
  if (!data) notFound();

  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          paddingTop: 20,
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden style={{ margin: "0 6px" }}>
          /
        </span>
        <Link
          href="/open-questions"
          style={{ color: "var(--text-muted)" }}
        >
          Open Questions
        </Link>
        <span aria-hidden style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{data.title}</span>
      </nav>

      <header
        style={{
          paddingTop: 44,
          paddingBottom: 32,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {data.eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {data.eyebrow}
          </div>
        )}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            marginBottom: 14,
          }}
        >
          Open Questions — {data.title}
        </h1>
        <p
          className="muted"
          style={{
            maxWidth: "62ch",
            fontSize: "1rem",
            lineHeight: 1.65,
            marginBottom: 18,
          }}
        >
          Unresolved threads drawn from every record the warehouse holds
          under this topic. The analysis surfaces tensions; it does not
          adjudicate them.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <LinkButton href={data.topicHref} variant="secondary">
            ← Back to topic overview
          </LinkButton>
          <span
            className="num muted"
            style={{ fontSize: "0.85rem", letterSpacing: "0.02em" }}
          >
            {formatNumber(data.questionCount)} threads
          </span>
        </div>
      </header>

      {(data.article || data.threads.length > 0) && (
        <section
          aria-label="Analysis and evidence"
          style={{ marginTop: 36 }}
        >
          <div className={layout.grid}>
            {data.article && (
              <div className={layout.main}>
                <OpenQuestionsArticleBody article={data.article} />
              </div>
            )}
            {data.threads.length > 0 && (
              <aside className={layout.aside}>
                <SectionHeading
                  eyebrow="Evidence"
                  title="Underlying threads"
                  description="The batch-level candidate questions that the article synthesizes. Each links to the documents that grounded it."
                />
                <OpenQuestionsThreadList threads={data.threads} />
              </aside>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
