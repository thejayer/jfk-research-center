import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTopic } from "@/lib/api-client";
import { TopicHero } from "@/components/topics/topic-hero";
import { TopicDocumentGrid } from "@/components/topics/topic-document-grid";
import { RelatedEntities } from "@/components/entities/related-entities";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { SectionHeading } from "@/components/ui/section-heading";
import { LinkButton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
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
        <Link href="/search" style={{ color: "var(--text-muted)" }}>Topics</Link>
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
          href={`/search?q=${encodeURIComponent(data.topic.title)}&mode=document`}
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

      {data.mentionExcerpts.length > 0 && (
        <section
          aria-label="Relevant mentions"
          style={{ marginTop: 72 }}
        >
          <SectionHeading
            eyebrow="Excerpts"
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
            Search only within the {data.topic.title} topic
          </div>
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            This MVP uses a single global index; topic-scoped search is the
            next warehouse layer on the roadmap.
          </p>
        </div>
        <LinkButton
          href={`/search?q=${encodeURIComponent(data.topic.title)}&mode=document`}
          variant="primary"
        >
          Search across archive →
        </LinkButton>
      </section>
    </div>
  );
}
