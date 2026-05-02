import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { TopicDetail } from "@/lib/api-types";
import { fetchTopic } from "@/lib/api-client";
import { TopicHero } from "@/components/topics/topic-hero";
import { TopicBody } from "@/components/topics/topic-body";
import { ReleaseAddendum } from "@/components/topics/release-addendum";
import { TopicDocumentGrid } from "@/components/topics/topic-document-grid";
import { RelatedEntities } from "@/components/entities/related-entities";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { SectionHeading } from "@/components/ui/section-heading";
import { LinkButton } from "@/components/ui/button";
import { ReportErrorLink } from "@/components/corrections/report-error-link";
import layout from "@/components/ui/two-column.module.css";

export const dynamic = "force-dynamic";

function hasTopicBody(topic: TopicDetail): boolean {
  return Boolean(topic.aiSummary || topic.aiArticle || topic.description);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "physical-evidence") {
    return {
      title: "Physical Evidence",
      description:
        "Curated catalog of physical evidence in the JFK assassination case — see /evidence.",
    };
  }
  const data = await fetchTopic(slug);
  if (!data) return { title: "Topic not found" };
  return {
    title: data.topic.title,
    description: data.topic.summary,
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The physical-evidence topic is a special-case: its dedicated UI lives
  // at /evidence. Redirect so the /topics index entry still points somewhere
  // useful, without duplicating the grid.
  if (slug === "physical-evidence") {
    redirect("/evidence");
  }
  const data = await fetchTopic(slug);
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
        <Link href="/" style={{ color: "var(--text-muted)" }}>Home</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <Link href="/topics" style={{ color: "var(--text-muted)" }}>Topics</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>{data.topic.title}</span>
      </nav>

      <TopicHero topic={data.topic} />

      <section
        aria-label="Topic actions"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 28,
        }}
      >
        <LinkButton
          href={`/search?topic=${encodeURIComponent(data.topic.slug)}`}
          variant="primary"
        >
          Search within topic →
        </LinkButton>
        <LinkButton href="#documents" variant="secondary">
          Browse documents
        </LinkButton>
        {data.relatedEntities.length > 0 && (
          <LinkButton href="#entities" variant="secondary">
            Related entities
          </LinkButton>
        )}
      </section>

      {data.topDocuments.length > 0 && (
        <section
          id="documents"
          aria-label="Top documents"
          style={{ marginTop: 56, scrollMarginTop: 24 }}
        >
          <SectionHeading
            eyebrow="Documents"
            title="Important records in this topic"
            description="A selection drawn from the curated collection; ordered by editorial relevance rather than ingest date."
          />
          <TopicDocumentGrid documents={data.topDocuments} />
        </section>
      )}

      {data.relatedEntities.length > 0 && (
        <section
          id="entities"
          aria-label="Related entities"
          style={{ marginTop: 72, scrollMarginTop: 24 }}
        >
          <SectionHeading
            eyebrow="Entities"
            title="People and organizations in this topic"
          />
          <RelatedEntities entities={data.relatedEntities} />
        </section>
      )}

      {(hasTopicBody(data.topic) || data.mentionExcerpts.length > 0) && (
        <section
          aria-label="Analysis and evidence"
          style={{ marginTop: 72 }}
        >
          <div className={layout.grid}>
            {hasTopicBody(data.topic) && (
              <div className={layout.main}>
                <SectionHeading
                  eyebrow="Analysis"
                  title="AI-generated reading"
                  description="A synthesized view of this topic, with inline citations to the underlying records."
                />
                <TopicBody topic={data.topic} />
                {data.releaseAddenda.map((a) => (
                  <ReleaseAddendum key={a.releaseSet} addendum={a} />
                ))}
              </div>
            )}
            {data.mentionExcerpts.length > 0 && (
              <aside className={layout.aside}>
                <SectionHeading
                  eyebrow="Evidence"
                  title="Relevant passages"
                  description="Short passages from OCR text and descriptions that characterize this topic."
                />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 22 }}
                >
                  {data.mentionExcerpts.map((m) => (
                    <MentionSnippet key={m.id} mention={m} />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>
      )}

      <section
        style={{
          marginTop: 72,
          padding: "28px 30px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, maxWidth: "60ch" }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.25rem",
              letterSpacing: "-0.005em",
              marginBottom: 6,
            }}
          >
            Search across the full archive
          </div>
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            Drop the topic filter and search the entire collection by
            keyword. To stay scoped to {data.topic.title}, use “Search
            within topic →” at the top of this page.
          </p>
        </div>
        <LinkButton
          href={`/search?q=${encodeURIComponent(data.topic.title)}&mode=document`}
          variant="primary"
        >
          Search across archive →
        </LinkButton>
      </section>

      <div style={{ marginTop: 28, textAlign: "right" }}>
        <ReportErrorLink surface="topic_summary" targetId={data.topic.slug} />
      </div>
    </div>
  );
}
