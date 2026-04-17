import type { Metadata } from "next";
import Link from "next/link";
import { fetchTopics } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Cross-cutting subjects for browsing the JFK Assassination Records Collection: investigations, agencies, and pivotal locations.",
};

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = await fetchTopics();

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>Topics</span>
      </nav>

      <header style={{ paddingTop: 40, paddingBottom: 20 }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          Subjects &amp; investigations
        </h1>
        <p
          className="muted"
          style={{
            maxWidth: "68ch",
            fontSize: "1rem",
            lineHeight: 1.65,
          }}
        >
          Curated subject collections pulled from the warehouse. Each topic
          has an AI-generated summary and a longer analysis article, both
          grounded in records from the collection.
        </p>
      </header>

      <SectionHeading
        eyebrow={`${formatNumber(topics.length)} topics`}
        title="All topics"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={t.href}
            style={{
              padding: "20px 22px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition:
                "border-color var(--motion), background var(--motion)",
            }}
          >
            {t.eyebrow && <span className="eyebrow">{t.eyebrow}</span>}
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.22rem",
                letterSpacing: "-0.005em",
                lineHeight: 1.2,
              }}
            >
              {t.title}
            </span>
            <span
              className="muted"
              style={{ fontSize: "0.9rem", lineHeight: 1.5 }}
            >
              {t.summary}
            </span>
            <span
              className="muted num"
              style={{
                fontSize: "0.78rem",
                marginTop: "auto",
                paddingTop: 4,
              }}
            >
              {formatNumber(t.documentCount)} documents
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
