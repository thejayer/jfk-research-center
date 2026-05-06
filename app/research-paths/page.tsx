import type { Metadata } from "next";
import Link from "next/link";
import { RESEARCH_PATHS } from "@/lib/research-paths";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Research paths",
  description:
    "Curated starting points through the JFK Research Center: Oswald, Ruby, FBI records, Warren Commission, and CE 399.",
};

export default function ResearchPathsPage() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          marginBottom: 36,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Research paths</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 28,
          alignItems: "end",
          borderBottom: "1px solid var(--border)",
          paddingBottom: 34,
          marginBottom: 42,
        }}
      >
        <div style={{ maxWidth: "70ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Research collections
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2rem, 1.5rem + 1.6vw, 3.2rem)",
              lineHeight: 1.05,
              letterSpacing: 0,
              marginBottom: 16,
            }}
          >
            Guided routes through the record.
          </h1>
          <p className="muted" style={{ fontSize: "1rem", lineHeight: 1.65 }}>
            Each path gives a compact starting sequence: open the relevant
            dossier, compare the timeline or evidence context, then move into
            primary records.
          </p>
        </div>
        <aside
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Path profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            <ProfileStat label="Paths" value={RESEARCH_PATHS.length} />
            <ProfileStat
              label="Steps"
              value={RESEARCH_PATHS.reduce((sum, path) => sum + path.steps.length, 0)}
            />
          </div>
        </aside>
      </header>

      <SectionHeading
        eyebrow="Start here"
        title="Choose a research lane"
        description="Use these collections when you know the thread but not the next source to open."
      />

      <div style={{ display: "grid", gap: 18 }}>
        {RESEARCH_PATHS.map((path) => (
          <section
            key={path.slug}
            id={path.slug}
            aria-labelledby={`${path.slug}-title`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 18,
              padding: "20px 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                id={`${path.slug}-title`}
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.45rem",
                  lineHeight: 1.15,
                  letterSpacing: 0,
                  marginBottom: 8,
                }}
              >
                {path.title}
              </h2>
              <p className="muted" style={{ maxWidth: "56ch", lineHeight: 1.6 }}>
                {path.summary}
              </p>
              <Link
                href={path.startHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Begin path
                <ArrowRightIcon />
              </Link>
            </div>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 10,
              }}
            >
              {path.steps.map((step, index) => (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px minmax(0, 1fr)",
                      gap: 12,
                      padding: "13px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--surface)",
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    <span className="muted num">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <span style={{ display: "block", fontWeight: 600 }}>
                        {step.label}
                      </span>
                      <span
                        className="muted"
                        style={{ display: "block", fontSize: "0.82rem", marginTop: 2 }}
                      >
                        {step.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "1.2rem" }}>
        {value}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.64rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
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
