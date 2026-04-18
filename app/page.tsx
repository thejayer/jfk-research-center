import Link from "next/link";
import { fetchHome } from "@/lib/api-client";
import { SearchBar } from "@/components/search/search-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatPill } from "@/components/ui/stat-pill";
import { Badge } from "@/components/ui/badge";
import { ScopeBanner } from "@/components/layout/scope-banner";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await fetchHome();

  return (
    <div>
      <div className="container" style={{ paddingTop: 16 }}>
        <ScopeBanner manifest={data.corpusManifest} />
      </div>
      <Hero />

      <section
        className="container"
        style={{ marginTop: 80 }}
        aria-label="Featured entities"
      >
        <SectionHeading
          eyebrow="Featured people & organizations"
          title="Entities"
          description="The people and institutions whose records structure every JFK inquiry: defendants, investigators, and the agencies that hold the files."
          actionHref="/entity/oswald"
          actionLabel="Browse all entities"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {data.featuredEntities.map((e) => (
            <Link
              key={e.slug}
              href={e.href}
              style={{
                padding: "20px 22px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                color: "var(--text)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 160,
                transition: "border-color var(--motion), background var(--motion)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Badge tone="muted" size="sm">
                  {e.type === "person" ? "Person" : "Organization"}
                </Badge>
                {e.mentionCount !== undefined && (
                  <span className="muted num" style={{ fontSize: "0.8rem" }}>
                    {formatNumber(e.mentionCount)} mentions
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.4rem",
                  letterSpacing: "-0.005em",
                  lineHeight: 1.2,
                }}
              >
                {e.name}
              </div>
              <p
                className="muted"
                style={{
                  fontSize: "0.92rem",
                  lineHeight: 1.55,
                  flex: 1,
                }}
              >
                {e.summary.length > 150
                  ? `${e.summary.slice(0, 150).trim()}…`
                  : e.summary}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container" style={{ marginTop: 80 }}>
        <SectionHeading
          eyebrow="Topics"
          title="Subjects & investigations"
          description="Cross-cutting themes for browsing the collection: investigations, agencies, and pivotal locations."
          actionHref="/topics"
          actionLabel="See all"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {data.featuredTopics.map((t) => (
            <Link
              key={t.slug}
              href={t.href}
              style={{
                padding: "18px 20px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                color: "var(--text)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color var(--motion), background var(--motion)",
              }}
            >
              {t.eyebrow && (
                <span className="eyebrow">{t.eyebrow}</span>
              )}
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.2rem",
                  letterSpacing: "-0.005em",
                  lineHeight: 1.2,
                }}
              >
                {t.title}
              </span>
              <span
                className="muted"
                style={{ fontSize: "0.88rem", lineHeight: 1.5 }}
              >
                {t.summary.length > 120
                  ? `${t.summary.slice(0, 120).trim()}…`
                  : t.summary}
              </span>
              <span
                className="muted num"
                style={{ fontSize: "0.78rem", marginTop: 4 }}
              >
                {formatNumber(t.documentCount)} documents
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="container"
        style={{ marginTop: 80 }}
        aria-label="Collection statistics"
      >
        <SectionHeading
          eyebrow="Collection"
          title="At a glance"
          description="A bulk mirror of the National Archives Catalog records tagged to the Kennedy assassination, curated into a queryable shape."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <StatPill
            label="Records indexed"
            value={formatNumber(data.stats.documentCount)}
            hint="Bulk-mirrored from RG 59, 65, 87, 127, 233, 263, 272, 541"
          />
          <StatPill
            label="OCR passages"
            value={formatNumber(data.stats.mentionCount)}
            hint="Chunked at 1,200 characters"
          />
          <StatPill
            label="Entities"
            value={formatNumber(data.stats.entityCount)}
            hint="People, organizations, places"
          />
          <StatPill
            label="Topics"
            value={formatNumber(data.stats.topicCount)}
            hint="Curated subject collections"
          />
        </div>
      </section>

      <section
        className="container"
        style={{ marginTop: 80 }}
        aria-label="Recent additions"
      >
        <SectionHeading
          eyebrow="Recent additions"
          title="Recently processed records"
          description="A rolling sample of records recently run through OCR and entity extraction."
          actionHref="/search"
          actionLabel="See all"
        />
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            borderTop: "1px solid var(--border)",
          }}
        >
          {data.recentDocuments.map((d) => (
            <li
              key={d.id}
              style={{
                padding: "18px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Link
                href={d.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 20,
                  color: "var(--text)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    className="muted"
                    style={{
                      fontSize: "0.8rem",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    {d.agency && <span>{d.agency}</span>}
                    {d.dateLabel && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{d.dateLabel}</span>
                      </>
                    )}
                    {d.documentType && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{d.documentType}</span>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.1rem",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {d.title}
                  </div>
                </div>
                <div
                  className="muted num"
                  style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}
                >
                  NAID {d.naid}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="container"
        style={{ marginTop: 80 }}
        aria-label="How to use the archive"
      >
        <SectionHeading
          eyebrow="How to use the archive"
          title="Three ways in"
        />
        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            listStyle: "none",
            margin: 0,
            padding: 0,
            counterReset: "step",
          }}
        >
          <HowToStep
            number="01"
            title="Start with a name or agency"
            body="Search turns up titled records and OCR passages from the same interface. Keyword-style queries return the highest-confidence title hits first."
          />
          <HowToStep
            number="02"
            title="Follow an entity page"
            body="Entity pages anchor the biographical, organizational, and documentary threads so you can see how Oswald, the CIA, or the Warren Commission connect to specific evidence."
          />
          <HowToStep
            number="03"
            title="Read the primary source"
            body="Every mention resolves to a document page with archival metadata, OCR excerpts, and a direct link back to the National Archives Catalog."
          />
        </ol>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        paddingTop: 72,
        paddingBottom: 72,
      }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 40,
        }}
      >
        <div>
          <div
            className="eyebrow"
            style={{ marginBottom: 18, color: "var(--text-muted)" }}
          >
            JFK Research Center · Archival Study
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
              maxWidth: "18ch",
              lineHeight: 1.05,
              marginBottom: 20,
            }}
          >
            A reading room for the Kennedy assassination record.
          </h1>
          <p
            style={{
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.2rem)",
              lineHeight: 1.55,
              maxWidth: "58ch",
              color: "var(--text)",
              marginBottom: 28,
            }}
          >
            Search and read primary-source records from the U.S. National Archives
            Catalog, traced through the people, agencies, and investigations at the
            center of the case.
          </p>

          <div style={{ maxWidth: 720, marginBottom: 16 }}>
            <SearchBar size="lg" placeholder="Search records, people, agencies…" />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginTop: 18,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
            }}
          >
            <span>Try:</span>
            <Link href="/search?q=Mexico+City">Mexico City</Link>
            <Link href="/search?q=Oswald">Oswald</Link>
            <Link href="/search?q=Ruby">Ruby</Link>
            <Link href="/search?q=Kostikov">Kostikov</Link>
            <Link href="/search?q=Angleton">Angleton</Link>
            <Link href="/search?q=Castro">Castro</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowToStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "18px 20px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <span
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.6rem",
          color: "var(--accent)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {number}
      </span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.15rem",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </span>
      <p
        className="muted"
        style={{ fontSize: "0.93rem", lineHeight: 1.6, maxWidth: "42ch" }}
      >
        {body}
      </p>
    </li>
  );
}
