import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPhysicalEvidenceItem } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { RelatedEntities } from "@/components/entities/related-entities";
import { RelatedDocumentsRail } from "@/components/research/related-documents-rail";
import { ResearchContextPanel } from "@/components/research/research-context-panel";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { formatDate } from "@/lib/format";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  ballistic: "Ballistic",
  firearm: "Firearms",
  photographic: "Photographic",
  medical: "Medical",
  documentary: "Documentary",
  clothing: "Clothing",
  environmental: "Environmental",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchPhysicalEvidenceItem(id);
  if (!data) return { title: "Evidence item not found" };
  return {
    title: data.shortName,
    description: data.shortDescription,
  };
}

export default async function EvidenceItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchPhysicalEvidenceItem(id);
  if (!data) notFound();

  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category;
  const referenceCount =
    data.referencedNaids.length + data.referencedWcTestimony.length;
  const referencedRecords = data.referencedNaids.map((naid) => ({
    id: naid,
    label: `NAID ${naid}`,
    href: `https://catalog.archives.gov/id/${encodeURIComponent(naid)}`,
    meta: "National Archives Catalog record",
    external: true,
  }));

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "evidence",
          sourceId: data.id,
          title: data.shortName,
          href: data.href,
          context: categoryLabel,
        }}
      />
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          marginBottom: 24,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href="/evidence" style={{ color: "var(--text-muted)" }}>
          Evidence
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>{data.id}</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          marginBottom: 42,
        }}
      >
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 22,
          }}
        >
          <Badge tone="muted" size="sm" style={{ alignSelf: "start" }}>
            {categoryLabel}
          </Badge>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.15rem",
              letterSpacing: 0,
              marginTop: 12,
              marginBottom: 14,
              lineHeight: 1.12,
            }}
          >
            {data.shortName}
          </h1>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.65,
              color: "var(--text)",
              marginBottom: 18,
            }}
          >
            {data.shortDescription}
          </p>
          <p
            className="muted num"
            style={{ fontSize: "0.82rem", letterSpacing: "0.02em", margin: 0 }}
          >
            Evidence ID: {data.id}
          </p>
          <div style={{ marginTop: 18 }}>
            <SaveResearchButton
              item={{
                type: "evidence",
                sourceId: data.id,
                title: data.shortName,
                href: data.href,
                context: categoryLabel,
              }}
            />
          </div>
        </div>

        <aside
          aria-label="Evidence item profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
            alignContent: "start",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Item profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              ["Custody", data.chainOfCustody.length],
              ["Records", data.referencedNaids.length],
              ["Refs", referenceCount],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  className="num"
                  style={{ fontSize: "1.2rem", color: "var(--text)" }}
                >
                  {value}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.66rem",
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
          {data.canonicalCopyUrl && data.canonicalCopyHost && (
            <a
              href={data.canonicalCopyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text)",
                textDecoration: "none",
                lineHeight: 1.45,
              }}
            >
              View canonical copy at {data.canonicalCopyHost}
            </a>
          )}
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Detail pages connect object evidence back to custody movement,
            official testimony, archival records, and related research paths.
          </p>
        </aside>
      </header>

      {data.imageUrl && (
        <figure
          style={{
            margin: "0 0 36px 0",
            padding: 0,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt={data.imageAlt ?? data.shortName}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {data.imageCredit && (
            <figcaption
              className="muted"
              style={{
                fontSize: "0.78rem",
                padding: "8px 14px",
                background: "var(--surface)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {data.imageCredit}
            </figcaption>
          )}
        </figure>
      )}

      <ResearchContextPanel
        title={`How ${data.shortName} is grounded`}
        description="Move from the physical item into custody steps, archival records, testimony references, and connected people or organizations."
        sections={[
          {
            title: "Archival records",
            emptyText: "No NARA record references are attached yet.",
            links: data.referencedNaids.slice(0, 4).map((naid) => ({
              href: `https://catalog.archives.gov/id/${encodeURIComponent(naid)}`,
              label: `NAID ${naid}`,
              meta: "National Archives Catalog",
              external: true,
            })),
          },
          {
            title: "Testimony",
            emptyText: "No Warren Commission testimony references are attached yet.",
            links: data.referencedWcTestimony.slice(0, 4).map((testimony) => ({
              href: "#testimony",
              label: testimony.witness,
              meta: `Vol. ${testimony.volume}, p. ${testimony.page}`,
            })),
          },
          {
            title: "Related entities",
            emptyText: "No related entities are indexed for this evidence item yet.",
            links: data.relatedEntities.slice(0, 4).map((entity) => ({
              href: entity.href,
              label: entity.name,
              meta: entity.type,
            })),
          },
        ]}
        actions={[
          {
            href: `/search?q=${encodeURIComponent(data.shortName)}&mode=document`,
            label: "Search this evidence item",
            detail: categoryLabel,
          },
          ...(data.canonicalCopyUrl && data.canonicalCopyHost
            ? [
                {
                  href: data.canonicalCopyUrl,
                  label: "Open canonical copy",
                  detail: data.canonicalCopyHost,
                  external: true,
                },
              ]
            : []),
          ...(data.chainOfCustody.length > 0
            ? [
                {
                  href: "#chain-of-custody",
                  label: "Review custody trail",
                  detail: `${data.chainOfCustody.length} steps`,
                },
              ]
            : []),
        ]}
      />

      <RelatedDocumentsRail
        references={referencedRecords}
        title="Records to read next"
        description={`Follow the archival records and testimony references that ground ${data.shortName}.`}
        searchHref={`/search?q=${encodeURIComponent(data.shortName)}&mode=document`}
        searchLabel="Search this evidence item"
        emptyText="No archival record references are attached to this evidence item yet."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 34,
          alignItems: "start",
        }}
      >
        <main style={{ display: "grid", gap: 40 }}>
          <section aria-label="Description">
            <SectionHeading
              eyebrow="Description"
              title="What this item anchors"
            />
            <p
              style={{
                fontSize: "1.02rem",
                lineHeight: 1.7,
                color: "var(--text)",
                margin: 0,
              }}
            >
              {data.longDescription}
            </p>
          </section>

          {data.chainOfCustody.length > 0 && (
            <section id="chain-of-custody" aria-label="Chain of custody" style={{ scrollMarginTop: 24 }}>
              <SectionHeading
                eyebrow="Provenance"
                title="Chain of custody"
                description="Ordered transfers of the item through the investigative record, where the archival sources agree."
              />
              <ol
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 12,
                }}
              >
                {data.chainOfCustody.map((s) => (
                  <li
                    key={`${s.stepOrder}-${s.custodian}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px minmax(0, 1fr)",
                      gap: 12,
                      padding: "14px 16px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)",
                    }}
                  >
                    <div
                      className="num"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        border: "1px solid var(--border-strong)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text)",
                      }}
                    >
                      {s.stepOrder}
                    </div>
                    <div>
                      <div
                        className="muted num"
                        style={{
                          fontSize: "0.78rem",
                          letterSpacing: "0.04em",
                          marginBottom: 4,
                        }}
                      >
                        {s.date ? formatDate(s.date) : "Date unknown"}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "1rem",
                          marginBottom: 4,
                        }}
                      >
                        {s.custodian}
                      </div>
                      <p
                        style={{
                          fontSize: "0.92rem",
                          lineHeight: 1.55,
                          color: "var(--text)",
                          margin: 0,
                        }}
                      >
                        {s.action}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>

        <aside style={{ display: "grid", gap: 28 }}>
          {data.referencedWcTestimony.length > 0 && (
            <section id="testimony" aria-label="Warren Commission testimony references" style={{ scrollMarginTop: 24 }}>
              <SectionHeading
                eyebrow="Testimony"
                title="Warren Commission hearings"
              />
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                {data.referencedWcTestimony.map((t) => (
                  <li
                    key={`${t.volume}-${t.witness}-${t.page}`}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--surface)",
                      padding: "12px 14px",
                      lineHeight: 1.5,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.94rem",
                        color: "var(--text)",
                        marginBottom: 3,
                      }}
                    >
                      {t.witness}
                    </div>
                    <div className="muted num" style={{ fontSize: "0.78rem" }}>
                      Volume {t.volume}, page {t.page}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.referencedNaids.length > 0 && (
            <section aria-label="NARA record references">
              <SectionHeading eyebrow="Records" title="NARA references" />
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                {data.referencedNaids.map((naid) => (
                  <li key={naid}>
                    <a
                      href={`https://catalog.archives.gov/id/${encodeURIComponent(naid)}`}
                      className="num"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        padding: "11px 14px",
                        fontSize: "0.86rem",
                        color: "var(--text)",
                        textDecoration: "none",
                      }}
                    >
                      NAID {naid}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.relatedEntities.length > 0 && (
            <section aria-label="Related entities">
              <SectionHeading
                eyebrow="Related"
                title="Connected people and organizations"
              />
              <RelatedEntities entities={data.relatedEntities} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
