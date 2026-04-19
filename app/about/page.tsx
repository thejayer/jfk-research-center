import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "How the JFK Research Center is built, edited, and what's coming next.",
};

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
      "Ingest pipeline, OCR provenance, models used for AI panels, and the current scope vs. the full collection.",
  },
  {
    href: "/about/editorial-policy",
    eyebrow: "How it's written",
    title: "Editorial policy",
    description:
      "Neutrality posture, source allowlist, banned language in AI-generated content, and the symmetric pairing of Open Questions with Established Facts.",
  },
  {
    href: "/about/roadmap",
    eyebrow: "What's next",
    title: "Roadmap",
    description:
      "Shipped, in-progress, and planned surfaces. If a route 404s, this page tells you whether it's coming.",
  },
];

export default function AboutHubPage() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ maxWidth: "72ch" }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          About
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.015em",
            marginTop: 8,
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          About the JFK Research Center
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.05rem", lineHeight: 1.6, maxWidth: "62ch" }}
        >
          A research reading room for declassified records related to the
          assassination of President John F. Kennedy. The pages below describe
          how the site is built, the editorial posture behind every panel,
          and what&rsquo;s on the way next.
        </p>
      </div>

      <div
        style={{
          marginTop: 36,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "20px 22px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text)",
            }}
          >
            <span
              className="eyebrow"
              style={{ color: "var(--text-muted)" }}
            >
              {c.eyebrow}
            </span>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.25rem",
                letterSpacing: "-0.005em",
              }}
            >
              {c.title}
            </span>
            <span
              className="muted"
              style={{ fontSize: "0.92rem", lineHeight: 1.55 }}
            >
              {c.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
