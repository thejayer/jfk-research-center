import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEntity, fetchMediaIndex } from "@/lib/api-client";
import { EntityDocumentList } from "@/components/entities/entity-document-list";
import { EntityEvidenceTrail } from "@/components/entities/entity-evidence-trail";
import { EntityHero } from "@/components/entities/entity-hero";
import { EntityQuickFacts } from "@/components/entities/entity-quick-facts";
import { EntityRelationshipPaths } from "@/components/entities/entity-relationship-paths";
import { EntitySources } from "@/components/entities/entity-sources";
import { EntityTimeline } from "@/components/entities/entity-timeline";
import { RelatedEntities } from "@/components/entities/related-entities";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { ReportErrorLink } from "@/components/corrections/report-error-link";
import { RelatedDocumentsRail } from "@/components/research/related-documents-rail";
import { ResearchContextPanel } from "@/components/research/research-context-panel";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { RelatedMediaPanel } from "@/components/media/related-media-panel";
import { buildEntityRelationshipPaths } from "@/lib/entity-relationship-paths";
import { findRelatedMediaAssets } from "@/lib/media-assets";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchEntity(slug);
  if (!data) return { title: "Entity not found" };
  return {
    title: data.entity.name,
    description: data.entity.summary,
  };
}

export default async function EntityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [entityResult, mediaResult] = await Promise.allSettled([
    fetchEntity(slug),
    fetchMediaIndex(),
  ]);
  if (entityResult.status === "rejected") throw entityResult.reason;
  const data = entityResult.value;
  const media = mediaResult.status === "fulfilled" ? mediaResult.value : null;
  if (!data) notFound();

  const searchHref = `/search?q=${encodeURIComponent(data.entity.name)}&mode=mention`;
  const documentsHref = `/search?entity=${encodeURIComponent(data.entity.slug)}`;
  const hasDocuments = (data.entity.documentCount ?? 0) > 0;
  const relationshipPaths = buildEntityRelationshipPaths(data);
  const relatedMedia = media
    ? findRelatedMediaAssets(media.assets, {
        entities: [data.entity.slug],
        topics: data.relatedTopics.map((topic) => topic.slug),
        limit: 4,
      })
    : [];

  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "entity",
          sourceId: data.entity.slug,
          title: data.entity.name,
          href: data.entity.href,
          context: data.entity.type,
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
        <Link href="/entities" style={{ color: "var(--text-muted)" }}>
          Entities
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{data.entity.name}</span>
      </nav>

      <EntityHero
        entity={data.entity}
        searchHref={searchHref}
        documentsHref={hasDocuments ? documentsHref : undefined}
      />

      {data.facts.length > 0 && <EntityQuickFacts facts={data.facts} />}

      <EntityEvidenceTrail
        events={data.timeline}
        documents={data.topDocuments}
        documentsHref={hasDocuments ? documentsHref : undefined}
        entityName={data.entity.name}
      />

      <EntityRelationshipPaths
        entityName={data.entity.name}
        paths={relationshipPaths}
      />

      <RelatedMediaPanel
        assets={relatedMedia}
        title={`Official media connected to ${data.entity.name}`}
        description="JFK Library media records connected through this entity or the same topic lanes."
      />

      <ResearchContextPanel
        title={`Where ${data.entity.name} connects`}
        description="Move from this profile into the strongest records, topic lanes, related people or organizations, and chronology entries already tied to the entity."
        sections={[
          {
            title: "Records",
            emptyText: "No record links are indexed for this entity yet.",
            links: data.topDocuments.slice(0, 4).map((doc) => ({
              href: doc.href,
              label: doc.title,
              meta: doc.agency ?? doc.dateLabel ?? "Document",
            })),
          },
          {
            title: "Topics",
            emptyText: "No topic lanes are indexed for this entity yet.",
            links: data.relatedTopics.slice(0, 4).map((topic) => ({
              href: topic.href,
              label: topic.title,
              meta: `${topic.documentCount.toLocaleString()} documents`,
            })),
          },
          {
            title: "Related entities",
            emptyText: "No related entities are indexed yet.",
            links: data.relatedEntities.slice(0, 4).map((entity) => ({
              href: entity.href,
              label: entity.name,
              meta: entity.type,
            })),
          },
        ]}
        actions={[
          {
            href: searchHref,
            label: "Open mention search",
            detail: data.entity.name,
          },
          ...(hasDocuments
            ? [
                {
                  href: documentsHref,
                  label: "View document set",
                  detail: `${(data.entity.documentCount ?? 0).toLocaleString()} records`,
                },
              ]
            : []),
          ...(data.timeline[0]
            ? [
                {
                  href: "#timeline",
                  label: "Read chronology",
                  detail: data.timeline[0].dateLabel,
                },
              ]
            : []),
        ]}
      />

      <RelatedDocumentsRail
        documents={data.topDocuments}
        title="Documents to read next"
        description={`Open the records that most directly mention ${data.entity.name}, then continue into the full mention index.`}
        searchHref={hasDocuments ? documentsHref : searchHref}
        searchLabel={
          hasDocuments
            ? `View all documents mentioning ${data.entity.name}`
            : "Open mention search"
        }
      />

      {data.timeline.length > 0 && (
        <section id="timeline" aria-label="Timeline" style={{ marginTop: 56, scrollMarginTop: 24 }}>
          <SectionHeading
            eyebrow="Timeline"
            title="Chronology"
            description="Principal events drawn from the surviving record."
          />
          <EntityTimeline events={data.timeline} />
        </section>
      )}

      {data.relatedTopics.length > 0 && (
        <section aria-label="Related topics" style={{ marginTop: 72 }}>
          <SectionHeading
            eyebrow="Research lanes"
            title="Topics connected to this profile"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {data.relatedTopics.map((topic) => (
              <Link
                key={topic.slug}
                href={topic.href}
                style={{
                  padding: "14px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.05rem",
                    letterSpacing: 0,
                  }}
                >
                  {topic.title}
                </span>
                <span className="muted num" style={{ fontSize: "0.8rem" }}>
                  {topic.documentCount.toLocaleString()} documents
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.topDocuments.length > 0 && (
        <section aria-label="Top documents" style={{ marginTop: 72 }}>
          <SectionHeading
            eyebrow="Documents"
            title="Top documents"
            description="A curated selection of the records that most directly discuss this entity."
          />
          <EntityDocumentList documents={data.topDocuments} />
          {(data.entity.documentCount ?? 0) > data.topDocuments.length && (
            <div style={{ marginTop: 18 }}>
              <Link
                href={documentsHref}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                View all {(data.entity.documentCount ?? 0).toLocaleString()}{" "}
                documents mentioning {data.entity.name}
                <ArrowRightIcon />
              </Link>
            </div>
          )}
        </section>
      )}

      {data.mentionExcerpts.length > 0 && (
        <section aria-label="Mention excerpts" style={{ marginTop: 72 }}>
          <SectionHeading
            eyebrow="Excerpts"
            title="Matched passages"
            description="Short OCR passages drawn directly from the source documents."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {data.mentionExcerpts.map((mention) => (
              <MentionSnippet key={mention.id} mention={mention} />
            ))}
          </div>
        </section>
      )}

      {data.relatedEntities.length > 0 && (
        <section aria-label="Related entities" style={{ marginTop: 72 }}>
          <SectionHeading
            eyebrow="Related"
            title="Connected people & organizations"
          />
          <RelatedEntities entities={data.relatedEntities} />
        </section>
      )}

      {data.sources.length > 0 && (
        <section aria-label="Sources" style={{ marginTop: 72 }}>
          <SectionHeading
            eyebrow="Sources"
            title="Primary documents and references"
            description="Curated archival materials and allowlisted secondary references that ground this entity's biography and timeline."
          />
          <EntitySources sources={data.sources} />
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
            Search every mention of {data.entity.name}
          </div>
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            Jump to the mention-mode search across the full OCR and description
            index for the archive.
          </p>
        </div>
        <LinkButton href={searchHref} variant="primary">
          Open mention search
          <ArrowRightIcon />
        </LinkButton>
      </section>

      <div style={{ marginTop: 28, textAlign: "right" }}>
        <ReportErrorLink surface="entity_bio" targetId={data.entity.slug} />
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
