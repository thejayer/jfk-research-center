import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

const adminTools = [
  {
    href: "/admin/cost-console",
    title: "Cost Console",
    description: "Project spend, budgets, attribution, and reconciliation readiness.",
  },
  {
    href: "/admin/media",
    title: "Media rights review",
    description: "JFK Library media candidates before any local image storage.",
  },
  {
    href: "/admin/ocr-progress",
    title: "OCR pipeline progress",
    description: "Fetch, OCR, page, byte, confidence, and failure status.",
  },
  {
    href: "/admin/corrections",
    title: "Corrections queue",
    description: "User-submitted fixes and editorial triage.",
  },
  {
    href: "/admin/redactions",
    title: "Redaction review",
    description: "Document redaction detection and reviewer decisions.",
  },
];

export default function AdminHubPage() {
  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Admin
        </p>
        <h1 style={titleStyle}>Admin tools</h1>
        <p className="muted" style={ledeStyle}>
          Operational views for project maintenance, source review, and cost
          visibility.
        </p>
      </header>

      <section aria-label="Admin tools" style={gridStyle}>
        {adminTools.map((tool) => (
          <Link key={tool.href} href={tool.href} style={cardStyle}>
            <strong>{tool.title}</strong>
            <span>{tool.description}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "40px auto 96px",
  padding: "0 20px",
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 650,
  letterSpacing: 0,
  marginTop: 4,
};

const ledeStyle: CSSProperties = {
  maxWidth: "70ch",
  marginTop: 8,
  lineHeight: 1.55,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 150,
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
};
