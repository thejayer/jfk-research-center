import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { TopicDetail } from "@/lib/api-types";
import { fetchMediaIndex, fetchTopic } from "@/lib/api-client";
import { TopicHero } from "@/components/topics/topic-hero";
import { TopicEvidenceTrail } from "@/components/topics/topic-evidence-trail";
import { TopicBody } from "@/components/topics/topic-body";
import { ReleaseAddendum } from "@/components/topics/release-addendum";
import { TopicDocumentGrid } from "@/components/topics/topic-document-grid";
import { RelatedEntities } from "@/components/entities/related-entities";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { SectionHeading } from "@/components/ui/section-heading";
import { LinkButton } from "@/components/ui/button";
import { ReportErrorLink } from "@/components/corrections/report-error-link";
import { RelatedDocumentsRail } from "@/components/research/related-documents-rail";
import { ResearchContextPanel } from "@/components/research/research-context-panel";
import layout from "@/components/ui/two-column.module.css";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { RelatedMediaPanel } from "@/components/media/related-media-panel";
import { findRelatedMediaAssets } from "@/lib/media-assets";

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
        "Curated catalog of physical evidence in the JFK assassination case; see /evidence.",
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
  if (slug === "physical-evidence") redirect("/evidence");

  const [data, media] = await Promise.all([
    fetchTopic(slug),
    fetchMediaIndex().catch(() => null),
  ]);
  if (!data) notFound();

  const topicSearchHref = `/search?topic=${encodeURIComponent(data.topic.slug)}`;
  const archiveSearchHref = `/search?q=${encodeURIComponent(data.topic.title)}&mode=document`;
  const relatedMedia = media
    ? findRelatedMediaAssets(media.assets, {
        topics: [data.topic.slug],
        entities: data.relatedEntities.map((entity) => entity.slug),
        limit: 4,
      })
    : [];

  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "topic",
          sourceId: data.topic.slug,
          title: data.topic.title,
          href: data.topic.href,
          context: `${data.topic.documentCount.toLocaleString()} documents`,
        }}
      />
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
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <Link href="/topics" style={{ color: "var(--text-muted)" }}>
          Topics
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{data.topic.title}</span>
      </nav>

      <TopicHero
        topic={data.topic}
        searchHref={topicSearchHref}
        documentsHref="#documents"
        entityCount={data.relatedEntities.length}
        passageCount={data.mentionExcerpts.length}
      />

      <TopicEvidenceTrail
        documents={data.topDocuments}
        mentions={data.mentionExcerpts}
        documentsHref="#documents"
      />

      <RelatedMediaPanel
        assets={relatedMedia}
        title={`Official media for ${data.topic.title}`}
        description="JFK Library media records connected by this topic or its strongest related entities."
      />

      <ResearchContextPanel
        title={`How ${data.topic.title} branches`}
        description="Use this topic as a hub for its strongest records, connected entities, and passage evidence before widening back into search."
        sections={[
          {
            title: "Records",
            emptyText: "No records are attached to this topic yet.",
            links: data.topDocuments.slice(0, 4).map((doc) => ({
              href: doc.href,
              label: doc.title,
              meta: doc.agency ?? doc.dateLabel ?? "Document",
            })),
          },
          {
            title: "Entities",
            emptyText: "No related entities are indexed for this topic yet.",
            links: data.relatedEntities.slice(0, 4).map((entity) => ({
              href: entity.href,
              label: entity.name,
              meta: entity.type,
            })),
          },
          {
            title: "Passages",
            emptyText: "No passage evidence is indexed for this topic yet.",
            links: data.mentionExcerpts.slice(0, 3).map((mention) => ({
              href: mention.documentHref,
              label: mention.documentTitle,
              meta: mention.pageLabel ?? mention.source,
            })),
          },
        ]}
        actions={[
          {
            href: topicSearchHref,
            label: "Search inside topic",
            detail: data.topic.title,
          },
          {
            href: archiveSearchHref,
            label: "Search whole archive",
            detail: "Drop topic filter",
          },
          ...(data.topDocuments[0]
            ? [
                {
                  href: data.topDocuments[0].href,
                  label: "Start with top record",
                  detail: data.topDocuments[0].title,
                },
              ]
            : []),
        ]}
      />

      <RelatedDocumentsRail
        documents={data.topDocuments}
        title="Documents to read next"
        description={`Start with the records that most directly frame ${data.topic.title}, then move into the full topic search.`}
        searchHref={topicSearchHref}
        searchLabel="Open scoped document search"
      />

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
        <section aria-label="Analysis and evidence" style={{ marginTop: 72 }}>
          <div className={layout.grid}>
            {hasTopicBody(data.topic) && (
              <div className={layout.main}>
                <SectionHeading
                  eyebrow="Analysis"
                  title="AI-generated reading"
                  description="A synthesized view of this topic, with inline citations to the underlying records."
                />
                <TopicBody topic={data.topic} />
                {data.releaseAddenda.map((addendum) => (
                  <ReleaseAddendum key={addendum.releaseSet} addendum={addendum} />
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
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {data.mentionExcerpts.map((mention) => (
                    <MentionSnippet key={mention.id} mention={mention} />
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
              letterSpacing: 0,
              marginBottom: 6,
            }}
          >
            Search across the full archive
          </div>
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            Drop the topic filter and search the entire collection by keyword.
            To stay scoped to {data.topic.title}, use the topic search at the
            top of this page.
          </p>
        </div>
        <LinkButton href={archiveSearchHref} variant="primary">
          Search across archive
          <ArrowRightIcon />
        </LinkButton>
      </section>

      <div style={{ marginTop: 28, textAlign: "right" }}>
        <ReportErrorLink surface="topic_summary" targetId={data.topic.slug} />
      </div>
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
