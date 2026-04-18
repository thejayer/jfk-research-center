import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchDocument } from "@/lib/api-client";
import { DocumentHeader } from "@/components/documents/document-header";
import { MetadataPanel } from "@/components/documents/metadata-panel";
import { OcrPanel } from "@/components/documents/ocr-panel";
import { SourceLinks } from "@/components/documents/source-links";
import { ReleaseHistory } from "@/components/documents/release-history";
import { RelatedEntities } from "@/components/entities/related-entities";
import { EntityDocumentList } from "@/components/entities/entity-document-list";
import { SectionHeading } from "@/components/ui/section-heading";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchDocument(id);
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
        <Link href="/search" style={{ color: "var(--text-muted)" }}>Records</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>
          NAID {data.document.naid}
        </span>
      </nav>

      <DocumentHeader doc={data.document} />

      {data.document.releaseHistory && data.document.releaseHistory.length > 0 && (
        <ReleaseHistory entries={data.document.releaseHistory} />
      )}

      <div
        className="document-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 32,
          marginTop: 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <OcrPanel doc={data.document} mentions={data.mentions} />

          {data.relatedEntities.length > 0 && (
            <section aria-label="Related entities">
              <SectionHeading
                eyebrow="Entities"
                title="Mentioned in this record"
              />
              <RelatedEntities entities={data.relatedEntities} />
            </section>
          )}

          {data.relatedDocuments.length > 0 && (
            <section aria-label="Related documents">
              <SectionHeading
                eyebrow="Related records"
                title="Appear in the same topics or entities"
              />
              <EntityDocumentList documents={data.relatedDocuments} />
            </section>
          )}
        </div>

        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <MetadataPanel doc={data.document} />
          <SourceLinks doc={data.document} />
        </aside>
      </div>

      <style>{`
        @media (min-width: 980px) {
          .document-grid {
            grid-template-columns: minmax(0, 1fr) 320px !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </div>
  );
}
