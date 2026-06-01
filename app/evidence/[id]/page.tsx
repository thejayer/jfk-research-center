import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPhysicalEvidenceItem } from "@/lib/api-client";
import type { PhysicalEvidenceCategory } from "@/lib/api-types";
import { RelatedDocumentsRail } from "@/components/research/related-documents-rail";
import { ResearchContextPanel } from "@/components/research/research-context-panel";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { formatDate, formatNumber } from "@/lib/format";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import styles from "@/components/evidence/evidence-workspace.module.css";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<PhysicalEvidenceCategory, string> = {
  ballistic: "Ballistic",
  firearm: "Firearms",
  photographic: "Photographic",
  medical: "Medical",
  documentary: "Documentary",
  clothing: "Clothing",
  environmental: "Environmental",
};

const ENTITY_TYPE_LABEL = {
  person: "Person",
  org: "Org",
  place: "Place",
  concept: "Concept",
} as const;

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
  const categoryClassName = categoryClass(data.category);
  const referenceCount =
    data.referencedNaids.length + data.referencedWcTestimony.length;
  const researchItem = {
    type: "evidence" as const,
    sourceId: data.id,
    title: data.shortName,
    href: data.href,
    context: categoryLabel,
  };
  const referencedRecords = data.referencedNaids.map((naid) => ({
    id: naid,
    label: `NAID ${naid}`,
    href: `https://catalog.archives.gov/id/${encodeURIComponent(naid)}`,
    meta: "National Archives Catalog record",
    reliability: "primary_source" as const,
    external: true,
  }));

  return (
    <div className={`container ${styles.detailPage}`}>
      <ResearchHistoryTracker item={researchItem} />

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/evidence">Evidence</Link>
        <span aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent}>{data.id}</span>
      </nav>

      <header className={styles.itemHeader}>
        <div className={`${styles.itemMainCard} ${categoryClassName}`}>
          <span className={styles.categoryBadge}>
            <span className={styles.swatch} aria-hidden />
            {categoryLabel}
          </span>
          <h1 className={styles.itemTitle}>{data.shortName}</h1>
          <p className={styles.itemDescription}>{data.shortDescription}</p>
          <p className={styles.itemId}>Evidence ID: {data.id}</p>
          <div className={styles.itemActions}>
            <SaveResearchButton item={researchItem} />
            <Link
              href={`/search?q=${encodeURIComponent(data.shortName)}&mode=document`}
              className={styles.actionLink}
            >
              Search this item
              <ArrowRightIcon />
            </Link>
          </div>
        </div>

        <aside className={styles.profileCard} aria-label="Evidence item profile">
          <div className="eyebrow">Item profile</div>
          <div className={`${styles.profileStats} ${styles.profileStatsThree}`}>
            <StatCard label="Custody" value={data.chainOfCustody.length} />
            <StatCard label="Records" value={data.referencedNaids.length} />
            <StatCard label="Refs" value={referenceCount} />
          </div>
          {data.canonicalCopyUrl && data.canonicalCopyHost && (
            <a
              href={data.canonicalCopyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.canonicalLink}
            >
              <span>View canonical copy at {data.canonicalCopyHost}</span>
              <ExternalIcon />
            </a>
          )}
          <p className={styles.profileNote}>
            Detail pages connect object evidence back to custody movement,
            official testimony, archival records, and related research paths.
          </p>
        </aside>
      </header>

      <figure className={`${styles.figure} ${categoryClassName}`}>
        {data.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt={data.imageAlt ?? data.shortName}
              className={styles.figureImage}
            />
          </>
        ) : (
          <div className={styles.figurePlaceholder} aria-label="Evidence image placeholder">
            <div className={styles.figurePlate}>
              <div className="eyebrow">Official image</div>
              <div className={styles.figurePlateTitle}>
                No cached image is attached yet.
              </div>
              <p className={styles.profileNote}>
                Use the linked archival records and canonical copies to verify
                the visual source before caching or displaying an image.
              </p>
            </div>
          </div>
        )}
        <figcaption className={styles.figureCaption}>
          {data.imageCredit ??
            "Image status is metadata-driven. Official media should be verified against the source record before local caching."}
        </figcaption>
      </figure>

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
              reliability: "primary_source",
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
              reliability: "primary_source",
            })),
          },
          {
            title: "Related entities",
            emptyText: "No related entities are indexed for this evidence item yet.",
            links: data.relatedEntities.slice(0, 4).map((entity) => ({
              href: entity.href,
              label: entity.name,
              meta: entity.type,
              reliability: "curated_metadata",
            })),
          },
        ]}
        actions={[
          {
            href: `/search?q=${encodeURIComponent(data.shortName)}&mode=document`,
            label: "Search this evidence item",
            detail: categoryLabel,
            reliability: "derived_signal",
          },
          ...(data.canonicalCopyUrl && data.canonicalCopyHost
            ? [
                {
                  href: data.canonicalCopyUrl,
                  label: "Open canonical copy",
                  detail: data.canonicalCopyHost,
                  reliability: "external_reference" as const,
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
                  reliability: "evidence_record" as const,
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

      <div className={styles.bodyGrid}>
        <main className={styles.bodyMain}>
          <section aria-label="Description">
            <DetailHeading eyebrow="Description" title="What this item anchors" />
            <p className={styles.longform}>{data.longDescription}</p>
          </section>

          {data.chainOfCustody.length > 0 && (
            <section
              id="chain-of-custody"
              className={styles.section}
              aria-label="Chain of custody"
            >
              <DetailHeading
                eyebrow="Provenance"
                title="Chain of custody"
                description="Ordered transfers of the item through the investigative record, where the archival sources agree."
              />
              <ol className={styles.custodyList}>
                {data.chainOfCustody.map((step) => (
                  <li
                    key={`${step.stepOrder}-${step.custodian}`}
                    className={styles.custodyStep}
                  >
                    <div className={styles.custodyNumber}>
                      {step.stepOrder}
                    </div>
                    <div>
                      <div className={styles.custodyDate}>
                        {step.date ? formatDate(step.date) : "Date unknown"}
                      </div>
                      <div className={styles.custodyCustodian}>
                        {step.custodian}
                      </div>
                      <p className={styles.custodyAction}>{step.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>

        <aside className={styles.itemSide}>
          {data.referencedWcTestimony.length > 0 && (
            <section id="testimony" aria-label="Warren Commission testimony references">
              <DetailHeading eyebrow="Testimony" title="Warren Commission hearings" compact />
              <ul className={styles.refList}>
                {data.referencedWcTestimony.map((testimony) => (
                  <li
                    key={`${testimony.volume}-${testimony.witness}-${testimony.page}`}
                    className={styles.refCard}
                  >
                    <div className={styles.refName}>{testimony.witness}</div>
                    <div className={styles.refMeta}>
                      Volume {testimony.volume}, page {testimony.page}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.referencedNaids.length > 0 && (
            <section aria-label="NARA record references">
              <DetailHeading eyebrow="Records" title="NARA references" compact />
              <ul className={styles.refList}>
                {data.referencedNaids.map((naid) => (
                  <li key={naid}>
                    <a
                      href={`https://catalog.archives.gov/id/${encodeURIComponent(naid)}`}
                      className={styles.refLink}
                      target="_blank"
                      rel="noopener noreferrer"
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
              <DetailHeading
                eyebrow="Related"
                title="Connected people and organizations"
                compact
              />
              <div className={styles.entityMini}>
                {data.relatedEntities.map((entity) => (
                  <Link
                    key={entity.slug}
                    href={entity.href}
                    className={styles.entityMiniLink}
                  >
                    <span className={styles.entityMiniName}>{entity.name}</span>
                    <span className={styles.entityMiniType}>
                      {ENTITY_TYPE_LABEL[entity.type] ?? entity.type}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailHeading({
  eyebrow,
  title,
  description,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.sideHeading : styles.detailHeading}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className={compact ? styles.sideTitle : styles.detailTitle}>{title}</h2>
      {description && <p className={styles.detailDescription}>{description}</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statCard}>
      <div className={`num ${styles.statValue}`}>{formatNumber(value)}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function categoryClass(category: PhysicalEvidenceCategory): string {
  return {
    ballistic: styles.categoryBallistic,
    firearm: styles.categoryFirearm,
    photographic: styles.categoryPhotographic,
    medical: styles.categoryMedical,
    documentary: styles.categoryDocumentary,
    clothing: styles.categoryClothing,
    environmental: styles.categoryEnvironmental,
  }[category];
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 4h6v6M12 4 5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
