import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchOpenQuestionsTopic } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { OpenQuestionsArticleBody } from "@/components/open-questions/article-body";
import { OpenQuestionsThreadList } from "@/components/open-questions/thread-list";
import { EditorialFootnotes } from "@/components/open-questions/editorial-footnotes";
import { LinkButton } from "@/components/ui/button";
import { RelatedDocumentsRail } from "@/components/research/related-documents-rail";
import {
  TENSION_ORDER,
  tensionAnchorId,
  tensionLabel,
} from "@/components/open-questions/tension-labels";
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
  if (!data) return { title: "Open Questions not found" };
  return {
    title: `Open Questions: ${data.title}`,
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

  const openCount = data.threads.filter((t) => t.status === "open").length;
  const partialCount = data.threads.filter(
    (t) => t.status === "partially_resolved",
  ).length;
  const resolvedCount = data.threads.filter((t) => t.status === "resolved").length;
  const evidenceDocCount =
    data.article?.sourceDocCount ??
    new Set(data.threads.flatMap((thread) => thread.supportingDocIds)).size;
  const supportingDocumentIds = Array.from(
    new Set(data.threads.flatMap((thread) => thread.supportingDocIds)),
  ).slice(0, 4);
  const tensionCounts = new Map<string, number>();
  for (const thread of data.threads) {
    const key = thread.tensionType ?? "other";
    tensionCounts.set(key, (tensionCounts.get(key) ?? 0) + 1);
  }
  // Preserve canonical tension priority while keeping runtime-only warehouse labels reachable.
  const tensionNav = [
    ...TENSION_ORDER,
    ...Array.from(tensionCounts.keys()).filter(
      (key) => !TENSION_ORDER.includes(key as (typeof TENSION_ORDER)[number]),
    ),
  ]
    .map((type) => ({ type, count: tensionCounts.get(type) ?? 0 }))
    .filter((item) => item.count > 0);

  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          paddingTop: 20,
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
        <Link href="/open-questions" style={{ color: "var(--text-muted)" }}>
          Open Questions
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>{data.title}</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 44,
          paddingBottom: 34,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          {data.eyebrow && (
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {data.eyebrow}
            </div>
          )}
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 14,
            }}
          >
            Open Questions: {data.title}
          </h1>
          <p
            className="muted"
            style={{
              fontSize: "1rem",
              lineHeight: 1.65,
              marginBottom: 18,
            }}
          >
            Unresolved threads drawn from records the warehouse holds under
            this topic. The analysis surfaces tensions; it does not adjudicate
            them.
          </p>
          <LinkButton href={data.topicHref} variant="secondary">
            Back to topic overview
          </LinkButton>
        </div>

        <aside
          aria-label="Open question topic profile"
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
            Topic profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["Threads", data.questionCount],
              ["Open", openCount],
              ["Partial", partialCount],
              ["Docs", evidenceDocCount],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 6px",
                  textAlign: "center",
                }}
              >
                <div className="num" style={{ fontSize: "1.12rem" }}>
                  {formatNumber(Number(value))}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.62rem",
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
            {resolvedCount > 0
              ? `${resolvedCount} thread${resolvedCount === 1 ? " is" : "s are"} marked resolved.`
              : "No threads are marked fully resolved in this topic yet."}
          </p>
        </aside>
      </header>

      {tensionNav.length > 0 && (
        <nav
          aria-label="Question tension types"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginTop: 26,
          }}
        >
          {tensionNav.map((item) => (
            <a
              key={item.type}
              href={`#${tensionAnchorId(item.type)}`}
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

      <RelatedDocumentsRail
        references={supportingDocumentIds.map((documentId) => ({
          id: documentId,
          label: documentId,
          href: `/document/${encodeURIComponent(documentId)}`,
          meta: "Supporting record cited by an underlying thread",
        }))}
        title="Documents behind the questions"
        description="Open the supporting records before reading the synthesized tensions."
        searchHref={data.topicHref}
        searchLabel="Back to topic overview"
        emptyText="No supporting document IDs are attached to these question threads yet."
      />

      {(data.article || data.threads.length > 0) && (
        <section aria-label="Analysis and evidence" style={{ marginTop: 36 }}>
          <div className={layout.grid}>
            {data.article && (
              <div className={layout.main}>
                <OpenQuestionsArticleBody article={data.article} />
                <EditorialFootnotes notes={data.editorialFootnotes} />
              </div>
            )}
            {data.threads.length > 0 && (
              <aside className={layout.aside} id="underlying-threads">
                <SectionHeading
                  eyebrow="Evidence"
                  title="Underlying threads"
                  description="Batch-level candidate questions synthesized by the article. Each links to the documents that grounded it."
                />
                <OpenQuestionsThreadList
                  threads={data.threads}
                  cryptonyms={data.cryptonyms}
                />
              </aside>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
