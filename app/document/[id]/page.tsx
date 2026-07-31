import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCaseTimeline, fetchDocument, fetchMediaIndex } from "@/lib/api-client";
import { DocumentHeader } from "@/components/documents/document-header";
import { MetadataPanel } from "@/components/documents/metadata-panel";
import { OcrPanel } from "@/components/documents/ocr-panel";
import { SourceLinks } from "@/components/documents/source-links";
import { ReleaseHistory } from "@/components/documents/release-history";
import { DocumentReadingGuide } from "@/components/documents/document-reading-guide";
import { DocumentAskPanel } from "@/components/documents/document-ask-panel";
import { DocumentResearchContext } from "@/components/documents/document-research-context";
import { DocumentTimelineBridge } from "@/components/documents/document-timeline-bridge";
import { RelatedEntities } from "@/components/entities/related-entities";
import { EntityDocumentList } from "@/components/entities/entity-document-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { TrustStatusStrip } from "@/components/research/trust-status-strip";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { RelatedMediaPanel } from "@/components/media/related-media-panel";
import { buildDocumentReadingGuide } from "@/lib/document-reading-guide";
import type { SavedResearchInput } from "@/lib/saved-research";
import { findTimelineEventsForDocument } from "@/lib/timeline-source-bridge";
import { findRelatedMediaAssets } from "@/lib/media-assets";
import styles from "@/components/documents/document-reader.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchDocument(id);
  if (!data) return { title: "Document not found" };
  return {
    title: data.document.title,
    description: data.document.description ?? undefined,
  };
}

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const [documentResult, timelineResult, mediaResult] = await Promise.allSettled([
    fetchDocument(id),
    fetchCaseTimeline(),
    fetchMediaIndex(),
  ]);
  const data = documentResult.status === "fulfilled" ? documentResult.value : null;
  const timeline = timelineResult.status === "fulfilled" ? timelineResult.value : null;
  const media = mediaResult.status === "fulfilled" ? mediaResult.value : null;
  if (!data) notFound();
  const timelineEvents = timeline
    ? findTimelineEventsForDocument(timeline.events, data.document)
    : [];
  const returnHref = parseReturnHref(resolvedSearchParams.from);
  const releaseHistory = data.document.releaseHistory ?? [];
  const hasReleaseHistory = releaseHistory.length > 0;
  const hasRelatedEntities = data.relatedEntities.length > 0;
  const hasRelatedDocuments = data.relatedDocuments.length > 0;
  const researchItem: SavedResearchInput = {
    type: "document",
    sourceId: data.document.id,
    title: data.document.title,
    href: data.document.href,
    context: `NAID ${data.document.naid}`,
  };
  const readingGuide = buildDocumentReadingGuide({
    mentions: data.mentions,
    topics: data.relatedTopics,
    entities: data.relatedEntities,
    timelineEvents,
    relatedDocuments: data.relatedDocuments,
  });
  const relatedMedia = media
    ? findRelatedMediaAssets(media.assets, {
        entities: data.relatedEntities.map((entity) => entity.slug),
        topics: data.relatedTopics.map((topic) => topic.slug),
        limit: 4,
      })
    : [];

  return (
    <div className={`container ${styles.page}`}>
      <ResearchHistoryTracker
        item={researchItem}
      />
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        {returnHref ? (
          <Link href={returnHref}>
            Back to results
          </Link>
        ) : (
          <Link href="/">Home</Link>
        )}
        <span aria-hidden>/</span>
        <Link href="/search">Records</Link>
        <span aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent}>
          NAID {data.document.naid}
        </span>
      </nav>

      <DocumentHeader doc={data.document} />

      <div className={styles.trustWrap}>
        <TrustStatusStrip doc={data.document} />
      </div>

      {hasReleaseHistory && (
        <div className={styles.supportStack}>
          <ReleaseHistory entries={releaseHistory} />
        </div>
      )}

      <div className={styles.workspaceGrid}>
        <div className={styles.readerStack}>
          <OcrPanel doc={data.document} mentions={data.mentions} />
        </div>

        <aside className={styles.readerAside}>
          <div id="source">
            <SourceLinks doc={data.document} />
          </div>
          <div id="metadata">
            <MetadataPanel doc={data.document} />
          </div>
          <DocumentReadingGuide guide={readingGuide} />
        </aside>
      </div>

      <div
        className={styles.secondaryStack}
        role="region"
        aria-label="Research beyond this record"
      >
        <div className={styles.secondaryIntro}>
          <div className="eyebrow">Research beyond this record</div>
          <p className="muted">
            These scoped tools and relationships follow the transcript so the
            archival text remains the primary reading task.
          </p>
        </div>

        <DocumentAskPanel doc={data.document} mentions={data.mentions} />

        <DocumentResearchContext
          doc={data.document}
          topics={data.relatedTopics}
          entities={data.relatedEntities}
          mentions={data.mentions}
          relatedDocuments={data.relatedDocuments}
        />

        <DocumentTimelineBridge doc={data.document} events={timelineEvents} />

        <RelatedMediaPanel
          assets={relatedMedia}
          title="Official media tied to this record"
          description="JFK Library media records connected through the same topic or entity relationships as this document."
        />

        {hasRelatedEntities && (
          <section id="related-entities" aria-label="Related entities">
            <SectionHeading
              eyebrow="Entities"
              title="Mentioned in this record"
            />
            <RelatedEntities entities={data.relatedEntities} />
          </section>
        )}

        {hasRelatedDocuments && (
          <section id="related-records" aria-label="Related documents">
            <SectionHeading
              eyebrow="Related records"
              title="Appear in the same topics or entities"
            />
            <EntityDocumentList documents={data.relatedDocuments} />
          </section>
        )}
      </div>
    </div>
  );
}

function parseReturnHref(
  from: string | string[] | undefined,
): string | null {
  const value = Array.isArray(from) ? from[0] : from;
  // Navigation-safety guard: only canonical internal search paths can
  // become document-page return links.
  if (!value || !/^\/search(?:[?#]|$)/.test(value)) return null;
  if (value.startsWith("//") || value.includes("://")) return null;
  return value;
}
