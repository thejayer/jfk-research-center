import type { Metadata } from "next";
import Link from "next/link";
import { fetchPhysicalEvidenceIndex } from "@/lib/api-client";
import type { PhysicalEvidenceCategory } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";
import styles from "@/components/evidence/evidence-workspace.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physical evidence",
  description:
    "Catalog of the physical evidence in the JFK assassination case, including ballistic, firearm, photographic, medical, documentary, clothing, and environmental items.",
};

const CATEGORY_LABELS: Record<PhysicalEvidenceCategory, string> = {
  ballistic: "Ballistic",
  firearm: "Firearms",
  photographic: "Photographic",
  medical: "Medical",
  documentary: "Documentary",
  clothing: "Clothing",
  environmental: "Environmental",
};

export default async function EvidenceIndexPage() {
  const data = await fetchPhysicalEvidenceIndex();
  const totalItems = data.items.length;
  const itemsByCategory = new Map<PhysicalEvidenceCategory, typeof data.items>();
  for (const item of data.items) {
    const list = itemsByCategory.get(item.category) ?? [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  return (
    <div className={`container ${styles.indexPage}`}>
      <header className={styles.indexHeader}>
        <div className={styles.heroCopy}>
          <div className="eyebrow">Physical evidence</div>
          <h1 className={styles.title}>The physical record</h1>
          <p className={styles.intro}>
            The documentary side of this collection, including cables,
            memoranda, and interview reports, is only one half of the case
            record. Below is the physical evidentiary side: bullets, firearms,
            photographs, clothing, medical material, and the scene itself,
            cataloged with the archival references used by official inquiries.
          </p>
        </div>

        <aside className={styles.profileCard} aria-label="Evidence profile">
          <div className="eyebrow">Evidence profile</div>
          <div className={styles.profileStats}>
            <StatCard label="Items" value={totalItems} />
            <StatCard label="Categories" value={data.categories.length} />
          </div>
          <p className={styles.profileNote}>
            Categories keep object evidence separate from document evidence
            while still linking each item back to the archival record.
          </p>
        </aside>
      </header>

      <nav className={styles.categoryNav} aria-label="Evidence categories">
        {data.categories.map((category) => (
          <a
            key={category.category}
            href={`#cat-${category.category}`}
            className={`${styles.categoryLink} ${categoryClass(category.category)}`}
          >
            <span className={styles.categoryLabel}>
              <span className={styles.swatch} aria-hidden />
              {CATEGORY_LABELS[category.category]}
            </span>
            <span className={styles.categoryCount}>{category.count}</span>
          </a>
        ))}
      </nav>

      <section
        id="comparison"
        className={styles.section}
        aria-label="Evidence comparison"
      >
        <EvidenceSectionHeading
          index="00"
          eyebrow="Compare"
          title="Evidence comparison"
          description="Scan item type, record depth, and image availability before opening a detail page."
        />
        <div className={styles.tableWrap}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                {["Item", "Category", "Image", "Path"].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.slice(0, 8).map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={item.href} className={styles.tableItem}>
                      {item.shortName}
                    </Link>
                    <div className={styles.itemId}>{item.id}</div>
                  </td>
                  <td>
                    <span
                      className={`${styles.categoryTag} ${categoryClass(item.category)}`}
                    >
                      <span className={styles.swatch} aria-hidden />
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.imageStatus} ${
                        item.imageUrl ? styles.imageStatusAvailable : ""
                      }`}
                    >
                      {item.imageUrl ? "Image available" : "No image indexed"}
                    </span>
                  </td>
                  <td>
                    <Link href={item.href} className={styles.openLink}>
                      Open item
                      <ArrowRightIcon />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.categories.map((category, index) => {
        const items = itemsByCategory.get(category.category) ?? [];
        return (
          <section
            key={category.category}
            id={`cat-${category.category}`}
            className={styles.section}
            aria-label={`${CATEGORY_LABELS[category.category]} evidence`}
          >
            <EvidenceSectionHeading
              index={String(index + 1).padStart(2, "0")}
              eyebrow={CATEGORY_LABELS[category.category]}
              title={`${CATEGORY_LABELS[category.category]} evidence`}
              description={`${formatNumber(category.count)} cataloged items in this evidence category.`}
            />
            <ul className={styles.itemGrid}>
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`${styles.itemCard} ${categoryClass(item.category)}`}
                  >
                    <div className={styles.itemCardTop}>
                      <span className={styles.categoryBadge}>
                        <span className={styles.swatch} aria-hidden />
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className={styles.itemId}>{item.id}</span>
                    </div>
                    <div className={styles.cardTitle}>{item.shortName}</div>
                    <p className={styles.cardDescription}>
                      {item.shortDescription}
                    </p>
                    <div className={styles.cardFoot}>
                      <span>{item.imageUrl ? "image indexed" : "metadata only"}</span>
                      <span className={styles.cardOpen}>
                        Open item
                        <ArrowRightIcon />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EvidenceSectionHeading({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionIndex}>{index}</div>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <p className={styles.sectionDescription}>{description}</p>
      </div>
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
