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
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 24,
          alignItems: "stretch",
          marginBottom: 34,
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Physical evidence
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.2rem",
              letterSpacing: 0,
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
            The documentary side of this collection, including cables,
            memoranda, and interview reports, is only one half of the case
            record. Below is the physical evidentiary side: the bullets, the
            rifle, the photographs, the clothing, and the scene itself,
            cataloged with the archival references used by the Warren
            Commission, the HSCA, and the ARRB. Descriptions are neutral; the
            entries link to the exhibits and testimony that examine them.
          </p>
        </div>
        <aside
          aria-label="Evidence profile"
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
            Evidence profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {[
              ["Items", totalItems],
              ["Categories", data.categories.length],
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
                  style={{ fontSize: "1.25rem", color: "var(--text)" }}
                >
                  {value}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.68rem",
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
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Categories keep object evidence separate from document evidence
            while still linking each item back to the archival record.
          </p>
        </aside>
      </header>

      <nav
        aria-label="Evidence categories"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 8,
          marginBottom: 36,
        }}
      >
        {data.categories.map((c) => (
          <a
            key={c.category}
            href={`#cat-${c.category}`}
            className="surface-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              fontSize: "0.82rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span>{CATEGORY_LABELS[c.category]}</span>
            <span className="muted num">{c.count}</span>
          </a>
        ))}
      </nav>

      <section
        id="comparison"
        aria-label="Evidence comparison"
        style={{
          marginBottom: 46,
          paddingTop: 4,
          scrollMarginTop: "calc(var(--header-height, 64px) + 24px)",
        }}
      >
        <SectionHeading
          eyebrow="Compare"
          title="Evidence comparison"
          description="Scan item type, record depth, and image availability before opening a detail page."
        />
        <div className="responsive-table-wrap">
          <table
            style={{
              minWidth: 760,
              fontSize: "0.88rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Item", "Category", "Image", "Path"].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      textAlign: "left",
                      padding: "11px 14px",
                      color: "var(--text-muted)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.slice(0, 8).map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "13px 14px", color: "var(--text)" }}>
                    <Link href={item.href} style={{ color: "var(--text)", fontWeight: 600 }}>
                      {item.shortName}
                    </Link>
                    <div className="muted num" style={{ fontSize: "0.76rem", marginTop: 2 }}>
                      {item.id}
                    </div>
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    {CATEGORY_LABELS[item.category]}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    {item.imageUrl ? "Image available" : "No image indexed"}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    <Link
                      href={item.href}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--text)",
                        fontWeight: 600,
                      }}
                    >
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
              description={`${c.count} cataloged items in this evidence category.`}
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
                    className="surface-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "16px 18px",
                      color: "var(--text)",
                      height: "100%",
                      textDecoration: "none",
                    }}
                  >
                    <Badge tone="muted" size="sm" style={{ alignSelf: "start" }}>
                      {CATEGORY_LABELS[it.category]}
                    </Badge>
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.1rem",
                        letterSpacing: 0,
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
