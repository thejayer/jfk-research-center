import type { Metadata } from "next";
import Link from "next/link";
import { fetchPhysicalEvidenceIndex } from "@/lib/api-client";
import type { PhysicalEvidenceCategory } from "@/lib/api-types";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physical evidence",
  description:
    "Catalog of the physical evidence in the JFK assassination case — ballistic, firearm, photographic, medical, documentary, clothing, and environmental items.",
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
  const itemsByCategory = new Map<PhysicalEvidenceCategory, typeof data.items>();
  for (const item of data.items) {
    const list = itemsByCategory.get(item.category) ?? [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Physical evidence
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          The physical record
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          The documentary side of this collection — cables, memoranda,
          interview reports — is only one half of the case record. Below is
          the physical evidentiary side: the bullets, the rifle, the
          photographs, the clothing, and the scene itself, cataloged with
          the archival references used by the Warren Commission, the HSCA,
          and the ARRB. Descriptions are neutral; the entries link to the
          exhibits and testimony that examine them.
        </p>
      </header>

      <nav
        aria-label="Evidence categories"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 32,
        }}
      >
        {data.categories.map((c) => (
          <a
            key={c.category}
            href={`#cat-${c.category}`}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              fontSize: "0.82rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {CATEGORY_LABELS[c.category]} · {c.count}
          </a>
        ))}
      </nav>

      {data.categories.map((c) => {
        const items = itemsByCategory.get(c.category) ?? [];
        return (
          <section
            key={c.category}
            id={`cat-${c.category}`}
            style={{ marginBottom: 48 }}
            aria-label={CATEGORY_LABELS[c.category]}
          >
            <SectionHeading
              eyebrow={CATEGORY_LABELS[c.category]}
              title={`${CATEGORY_LABELS[c.category]} evidence`}
            />
            <ul
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "16px 18px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      height: "100%",
                    }}
                  >
                    <Badge tone="muted" size="sm">
                      {CATEGORY_LABELS[it.category]}
                    </Badge>
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.1rem",
                        letterSpacing: "-0.005em",
                        lineHeight: 1.25,
                      }}
                    >
                      {it.shortName}
                    </div>
                    <p
                      className="muted"
                      style={{
                        fontSize: "0.88rem",
                        lineHeight: 1.55,
                        flex: 1,
                      }}
                    >
                      {it.shortDescription}
                    </p>
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
