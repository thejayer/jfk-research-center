import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest } from "@/lib/api-client";
import { ocrCoverageSentence } from "@/lib/corpus-coverage";
import { formatNumber } from "@/lib/format";
import {
  AboutHero,
  AboutNav,
  ArrowRightIcon,
  StatGrid,
  type AboutNavItem,
} from "./about-components";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "How the JFK Research Center is built, edited, and what's coming next.",
};

const NAV_ITEMS: AboutNavItem[] = [
  {
    href: "/about/methodology",
    label: "Methodology",
    detail: "Scope, pipeline, OCR provenance, and models.",
  },
  {
    href: "/about/editorial-policy",
    label: "Editorial policy",
    detail: "Neutrality posture, source rules, and corrections.",
  },
  {
    href: "/about/roadmap",
    label: "Roadmap",
    detail: "Shipped, in-progress, and planned surfaces.",
  },
];

const CARDS: Array<{
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    href: "/about/methodology",
    eyebrow: "How it works",
    title: "Methodology",
    description:
      "Ingest pipeline, OCR provenance, model usage, and the current indexed scope versus the full collection.",
  },
  {
    href: "/about/editorial-policy",
    eyebrow: "How it is written",
    title: "Editorial policy",
    description:
      "Neutrality posture, source allowlist, AI disclosure rules, and how corrections are handled.",
  },
  {
    href: "/about/roadmap",
    eyebrow: "What is next",
    title: "Roadmap",
    description:
      "Shipped, in-progress, and planned surfaces. If a route 404s, this page says whether it is coming.",
  },
];

export default async function AboutHubPage() {
  const manifest = await fetchCorpusManifest();

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <AboutHero title="About the JFK Research Center" aside={<AboutNav items={NAV_ITEMS} />}>
        <p>
          A research reading room for declassified records related to the
          assassination of President John F. Kennedy. These pages explain what is
          indexed, how the site handles AI-generated panels, and what standards
          guide the editorial layer.
        </p>
      </AboutHero>

      <StatGrid
        stats={[
          {
            label: "Records indexed",
            value: formatNumber(manifest.totalRecords),
            hint: "Curated subset of the JFK Assassination Records Collection.",
          },
          {
            label: "OCR records",
            value: formatNumber(manifest.recordsWithOcr),
            hint: "Records with full-text OCR available for passage search.",
          },
          {
            label: "Releases indexed",
            value: manifest.releasesIndexed.join(", ") || "none",
            hint: "Release manifests currently represented in the local corpus.",
          },
        ]}
      />
      <p className="muted" style={{ marginTop: 16, maxWidth: "72ch", lineHeight: 1.6 }}>
        {ocrCoverageSentence(manifest)}
      </p>

      <section aria-label="About pages" style={{ marginTop: 38 }}>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 14,
                alignItems: "start",
                minHeight: 190,
                padding: "20px 22px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                color: "var(--text)",
                textDecoration: "none",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  className="eyebrow"
                  style={{ display: "block", color: "var(--text-muted)" }}
                >
                  {card.eyebrow}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.35rem",
                    letterSpacing: 0,
                    lineHeight: 1.18,
                  }}
                >
                  {card.title}
                </span>
                <span
                  className="muted"
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontSize: "0.92rem",
                    lineHeight: 1.55,
                  }}
                >
                  {card.description}
                </span>
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
