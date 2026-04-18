import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPhysicalEvidenceItem } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { RelatedEntities } from "@/components/entities/related-entities";
import { formatDate } from "@/lib/format";

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

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          marginBottom: 20,
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>Home</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <Link href="/evidence" style={{ color: "var(--text-muted)" }}>Evidence</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>{data.id}</span>
      </nav>

      <header style={{ marginBottom: 32 }}>
        <Badge tone="muted" size="sm">
          {CATEGORY_LABELS[data.category] ?? data.category}
        </Badge>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.9rem",
            letterSpacing: "-0.015em",
            marginTop: 10,
            marginBottom: 14,
            lineHeight: 1.2,
          }}
        >
          {data.shortName}
        </h1>
        <p
          className="muted num"
          style={{ fontSize: "0.88rem", letterSpacing: "0.02em" }}
        >
          Evidence ID: {data.id}
        </p>
      </header>

      {data.imageUrl && (
        <figure
          style={{
            margin: "0 0 32px 0",
            padding: 0,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt={data.shortName}
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

      <div style={{ display: "grid", gap: 40, maxWidth: "70ch" }}>
        <section aria-label="Description">
          <p
            style={{
              fontSize: "1.02rem",
              lineHeight: 1.7,
              color: "var(--text)",
            }}
          >
            {data.longDescription}
          </p>
        </section>

        {data.chainOfCustody.length > 0 && (
          <section aria-label="Chain of custody">
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
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {data.chainOfCustody.map((s, i) => (
                <li
                  key={i}
                  style={{
                    padding: "14px 16px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                  }}
                >
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
                </li>
              ))}
            </ol>
          </section>
        )}

        {data.referencedWcTestimony.length > 0 && (
          <section aria-label="Warren Commission testimony references">
            <SectionHeading
              eyebrow="Testimony"
              title="Examined in Warren Commission hearings"
            />
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {data.referencedWcTestimony.map((t, i) => (
                <li
                  key={i}
                  style={{ fontSize: "0.95rem", lineHeight: 1.6 }}
                >
                  <span className="num">Vol. {t.volume}</span>
                  {" · "}
                  <strong>{t.witness}</strong>
                  {" · "}
                  <span className="num muted">p. {t.page}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.referencedNaids.length > 0 && (
          <section aria-label="NARA record references">
            <SectionHeading
              eyebrow="Records"
              title="NARA document references"
            />
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {data.referencedNaids.map((naid) => (
                <li key={naid}>
                  <Link
                    href={`/document/${encodeURIComponent(naid)}`}
                    className="num"
                    style={{ fontSize: "0.9rem" }}
                  >
                    NAID {naid}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.relatedEntities.length > 0 && (
          <section aria-label="Related entities">
            <SectionHeading
              eyebrow="Related"
              title="People & organizations connected to this item"
            />
            <RelatedEntities entities={data.relatedEntities} />
          </section>
        )}
      </div>
    </div>
  );
}
