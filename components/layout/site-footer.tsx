import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: 96,
        padding: "48px 0",
        background: "var(--surface)",
      }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gap: 32,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              marginBottom: 6,
            }}
          >
            JFK Research Center
          </div>
          <div className="muted" style={{ fontSize: "0.92rem", maxWidth: "42ch" }}>
            A research reading room for records related to the assassination of
            President John F. Kennedy, drawn from the U.S. National Archives
            Catalog.
          </div>
        </div>

        <FooterCol title="Navigate">
          <FooterLink href="/">Home</FooterLink>
          <FooterLink href="/search">Search</FooterLink>
          <FooterLink href="/entities">Entities</FooterLink>
          <FooterLink href="/topics">Topics</FooterLink>
          <FooterLink href="/timeline">Timeline</FooterLink>
          <FooterLink href="/evidence">Evidence</FooterLink>
        </FooterCol>

        <FooterCol title="Analysis">
          <FooterLink href="/open-questions">Open Questions</FooterLink>
          <FooterLink href="/established-facts">Established Facts</FooterLink>
          <FooterLink href="/releases">Release history</FooterLink>
          <FooterLink href="/bibliography">Bibliography</FooterLink>
        </FooterCol>

        <FooterCol title="About">
          <FooterLink href="/about">Overview</FooterLink>
          <FooterLink href="/about/methodology">Methodology</FooterLink>
          <FooterLink href="/about/editorial-policy">Editorial policy</FooterLink>
          <FooterLink href="/about/roadmap">Roadmap</FooterLink>
          <div
            className="muted"
            style={{ fontSize: "0.85rem", lineHeight: 1.55, marginTop: 6 }}
          >
            Records sourced from the U.S. National Archives Catalog, ABBYY
            JFK-OCR, and allowlisted primary-source reports. Transcriptions
            and OCR are machine-generated and may contain errors.
          </div>
        </FooterCol>
      </div>

      <div
        className="container"
        style={{
          marginTop: 40,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          fontSize: "0.82rem",
          color: "var(--text-muted)",
        }}
      >
        <span>© {new Date().getFullYear()} JFK Research Center — non-commercial research MVP.</span>
        <span>Built with Next.js · Backed by BigQuery.</span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="eyebrow"
        style={{ marginBottom: 12, color: "var(--text-muted)" }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{ color: "var(--text)", fontSize: "0.92rem" }}
    >
      {children}
    </Link>
  );
}
