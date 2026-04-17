import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEntity } from "@/lib/api-client";
import { EntityHero } from "@/components/entities/entity-hero";
import { EntityTimeline } from "@/components/entities/entity-timeline";
import { EntityDocumentList } from "@/components/entities/entity-document-list";
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
  const data = await fetchEntity(slug);
  if (!data) notFound();

  const searchHref = `/search?q=${encodeURIComponent(data.entity.name)}&mode=mention`;

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
        <Link href="/search" style={{ color: "var(--text-muted)" }}>Entities</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>{data.entity.name}</span>
      </nav>

      <EntityHero entity={data.entity} />

      {data.timeline.length > 0 && (
        <section
          aria-label="Timeline"
          style={{ marginTop: 56 }}
        >
          <SectionHeading
            eyebrow="Timeline"
            title="Chronology"
            description="Principal events drawn from the surviving record."
          />
          <EntityTimeline events={data.timeline} />
        </section>
      )}

      {data.relatedTopics.length > 0 && (
        <section
          aria-label="Related topics"
          style={{ marginTop: 72 }}
        >
          <SectionHeading
            eyebrow="Topics"
            title="Where this entity appears"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {data.relatedTopics.map((t) => (
              <Link
                key={t.slug}
                href={t.href}
                style={{
                  padding: "14px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.05rem",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {t.title}
                </span>
                <span
                  className="muted num"
                  style={{ fontSize: "0.8rem" }}
                >
                  {t.documentCount.toLocaleString()} documents
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.topDocuments.length > 0 && (
        <section
          aria-label="Top documents"
          style={{ marginTop: 72 }}
        >
          <SectionHeading
            eyebrow="Documents"
            title="Top documents"
            description="A curated selection of the records that most directly discuss this entity."
          />
          <EntityDocumentList documents={data.topDocuments} />
        </section>
      )}

      {data.mentionExcerpts.length > 0 && (
        <section
          aria-label="Mention excerpts"
          style={{ marginTop: 72 }}
        >
          <SectionHeading
            eyebrow="Excerpts"
            title="Matched passages"
            description="Short OCR passages drawn directly from the source documents."
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

      {data.relatedEntities.length > 0 && (
        <section
          aria-label="Related entities"
          style={{ marginTop: 72 }}
        >
          <SectionHeading
            eyebrow="Related"
            title="Connected people & organizations"
          />
          <RelatedEntities entities={data.relatedEntities} />
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
            Search every mention of {data.entity.name}
          </div>
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            Jump to the mention-mode search across the full OCR and description
            index for the archive.
          </p>
        </div>
        <LinkButton href={searchHref} variant="primary">
          Open mention search →
        </LinkButton>
      </section>
    </div>
  );
}
