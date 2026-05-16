import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchDocument } from "@/lib/api-client";
import { DocumentHeader } from "@/components/documents/document-header";
import { MetadataPanel } from "@/components/documents/metadata-panel";
import { OcrPanel } from "@/components/documents/ocr-panel";
import { SourceLinks } from "@/components/documents/source-links";
import { ReleaseHistory } from "@/components/documents/release-history";
import { DocumentResearchContext } from "@/components/documents/document-research-context";
import { RelatedEntities } from "@/components/entities/related-entities";
import { EntityDocumentList } from "@/components/entities/entity-document-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { TrustStatusStrip } from "@/components/research/trust-status-strip";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";

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
  const data = await fetchDocument(id);
  if (!data) notFound();
  const returnHref = parseReturnHref(resolvedSearchParams.from);
  const releaseHistory = data.document.releaseHistory ?? [];
  const hasReleaseHistory = releaseHistory.length > 0;
  const hasResearchContext =
    data.relatedTopics.length > 0 ||
    data.relatedEntities.length > 0 ||
    data.mentions.length > 0 ||
    data.relatedDocuments.length > 0;
  const hasRelatedEntities = data.relatedEntities.length > 0;
  const hasRelatedDocuments = data.relatedDocuments.length > 0;

  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "document",
          sourceId: data.document.id,
          title: data.document.title,
          href: data.document.href,
          context: `NAID ${data.document.naid}`,
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
        {returnHref ? (
          <Link href={returnHref} style={{ color: "var(--link)", fontWeight: 500 }}>
            Back to results
          </Link>
        ) : (
          <Link href="/" style={{ color: "var(--text-muted)" }}>Home</Link>
        )}
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <Link href="/search" style={{ color: "var(--text-muted)" }}>Records</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>
          NAID {data.document.naid}
        </span>
      </nav>

      <DocumentHeader doc={data.document} />

      <div style={{ marginTop: 18 }}>
        <TrustStatusStrip doc={data.document} />
      </div>

      {hasReleaseHistory && (
        <ReleaseHistory entries={releaseHistory} />
      )}

      <DocumentResearchContext
        doc={data.document}
        topics={data.relatedTopics}
        entities={data.relatedEntities}
        mentions={data.mentions}
        relatedDocuments={data.relatedDocuments}
      />

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

        <aside
          className="document-aside"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <DocumentJumpNav
            returnHref={returnHref}
            hasResearchContext={hasResearchContext}
            hasReleaseHistory={hasReleaseHistory}
            hasRelatedEntities={hasRelatedEntities}
            hasRelatedDocuments={hasRelatedDocuments}
          />
          <DocumentReaderActions
            naid={data.document.naid}
            title={data.document.title}
            pageCount={data.document.pageCount}
            chunkCount={data.document.chunkCount}
            hasOcr={data.document.hasOcr}
            citation={data.document.citation}
          />
          <div id="metadata">
            <MetadataPanel doc={data.document} />
          </div>
          <div id="source">
            <SourceLinks doc={data.document} />
          </div>
        </aside>
      </div>

      <style>{`
        @media (min-width: 980px) {
          .document-grid {
            grid-template-columns: minmax(0, 1fr) 320px !important;
            gap: 48px !important;
          }
          .document-aside {
            position: sticky;
            top: calc(var(--header-height) + 24px);
            align-self: start;
          }
        }
      `}</style>
    </div>
  );
}

function DocumentJumpNav({
  returnHref,
  hasResearchContext,
  hasReleaseHistory,
  hasRelatedEntities,
  hasRelatedDocuments,
}: {
  returnHref: string | null;
  hasResearchContext: boolean;
  hasReleaseHistory: boolean;
  hasRelatedEntities: boolean;
  hasRelatedDocuments: boolean;
}) {
  const links = [
    hasReleaseHistory ? { href: "#release-history", label: "Release history" } : null,
    hasResearchContext ? { href: "#research-context", label: "Research context" } : null,
    { href: "#ocr-text", label: "OCR text" },
    hasRelatedEntities ? { href: "#related-entities", label: "Entities" } : null,
    hasRelatedDocuments ? { href: "#related-records", label: "Related records" } : null,
    { href: "#metadata", label: "Metadata" },
    { href: "#source", label: "Source" },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <nav
      aria-label="Document sections"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "16px 18px",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        On this record
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "7px 0",
                color: "var(--text)",
                fontSize: "0.88rem",
              }}
            >
              <span>{link.label}</span>
              <ArrowDownIcon />
            </a>
          </li>
        ))}
      </ul>
      {returnHref && (
        <Link
          href={returnHref}
          style={{
            display: "inline-flex",
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            width: "100%",
            color: "var(--link)",
            fontSize: "0.86rem",
            fontWeight: 500,
          }}
        >
          Back to results
        </Link>
      )}
    </nav>
  );
}

function DocumentReaderActions({
  naid,
  title,
  pageCount,
  chunkCount,
  hasOcr,
  citation,
}: {
  naid: string;
  title: string;
  pageCount?: number | null;
  chunkCount?: number | null;
  hasOcr?: boolean;
  citation?: string | null;
}) {
  const encodedTitle = encodeURIComponent(title);
  const actions = [
    {
      href: `/search?q=${encodedTitle}&mode=document`,
      label: "Search title",
      detail: "Find matching records",
    },
    {
      href: `/search?q=${encodeURIComponent(naid)}&mode=document`,
      label: "Search NAID",
      detail: naid,
    },
    hasOcr
      ? {
          href: "#ocr-text",
          label: "Read OCR",
          detail: formatDocumentMeasure(pageCount, chunkCount),
        }
      : null,
    citation
      ? {
          href: "#source",
          label: "Copy citation",
          detail: "Available in source tools",
        }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; detail: string }>;

  return (
    <section
      aria-label="Reader actions"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "16px 18px",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Reader actions
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 11px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600 }}>
                {action.label}
              </span>
              <span className="muted" style={{ display: "block", fontSize: "0.76rem" }}>
                {action.detail}
              </span>
            </span>
            <ArrowRightIcon />
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatDocumentMeasure(
  pageCount?: number | null,
  chunkCount?: number | null,
): string {
  const parts = [];
  if (pageCount) parts.push(`${pageCount.toLocaleString()} pages`);
  if (chunkCount) parts.push(`${chunkCount.toLocaleString()} chunks`);
  return parts.length > 0 ? parts.join(" / ") : "OCR text";
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
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

function ArrowDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <path
        d="M8 3.5v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.75 8.75 8 12l3.25-3.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
