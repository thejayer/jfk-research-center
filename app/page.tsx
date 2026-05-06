import Link from "next/link";
import type { DocumentCard, EntityCard, TopicCard } from "@/lib/api-types";
import { fetchCaseTimeline, fetchHome } from "@/lib/api-client";
import { SearchBar } from "@/components/search/search-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatPill } from "@/components/ui/stat-pill";
import { Badge } from "@/components/ui/badge";
import { ScopeBanner } from "@/components/layout/scope-banner";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, timeline] = await Promise.all([
    fetchHome(),
    fetchCaseTimeline().catch(() => null),
  ]);

  const recentReleases =
    timeline?.events
      .filter((e) => e.category === "release")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3) ?? [];

  return (
    <div>
      <div className="container" style={{ paddingTop: 16 }}>
        <ScopeBanner manifest={data.corpusManifest} />
      </div>
      <Hero
        recordsWithOcr={data.corpusManifest.recordsWithOcr}
        ocrPassages={data.corpusManifest.ocrPassages}
        entityCount={data.stats.entityCount}
      />

      <ResearchRoutes
        primaryEntity={data.featuredEntities[0]}
        primaryTopic={data.featuredTopics[0]}
        recentDocument={data.recentDocuments[0]}
        documentCount={data.corpusManifest.totalRecords}
        ocrPassages={data.corpusManifest.ocrPassages}
      />

      <GuidedResearchPaths />

      {recentReleases.length > 0 && (
        <section
          className="container"
          style={{ marginTop: 48 }}
          aria-label="What's new"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              className="eyebrow"
              style={{ color: "var(--text-muted)" }}
            >
              What&rsquo;s new
            </div>
            <Link
              href="/releases"
              className="muted"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.85rem",
              }}
            >
              All releases
              <ArrowRightIcon />
            </Link>
          </div>
          <ol
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {recentReleases.map((r) => (
              <li key={r.id}>
                <Link
                  href="/releases"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "14px 16px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    height: "100%",
                  }}
                >
                  <div
                    className="muted num"
                    style={{
                      fontSize: "0.78rem",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatDate(r.date)}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1rem",
                      letterSpacing: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {r.title}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section
        className="container"
        style={{ marginTop: 80 }}
        aria-label="Featured entities"
      >
        <SectionHeading
          eyebrow="Featured people & organizations"
          title="Entities"
          description="The people and institutions whose records structure every JFK inquiry: defendants, investigators, and the agencies that hold the files."
          actionHref="/entities"
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
                  letterSpacing: 0,
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
                  ? `${e.summary.slice(0, 150).trim()}...`
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
                  letterSpacing: 0,
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
                  ? `${t.summary.slice(0, 120).trim()}...`
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
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
          }}
        >
          <StatPill
            label="Records indexed"
            value={formatNumber(data.corpusManifest.totalRecords)}
            hint={`${formatNumber(data.corpusManifest.recordsWithOcr)} have full-text OCR; the rest are metadata-only`}
          />
          <StatPill
            label="OCR passages"
            value={formatNumber(data.corpusManifest.ocrPassages)}
            hint="ABBYY OCR text chunked at 1,200 characters"
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
                        <span aria-hidden>|</span>
                        <span>{d.dateLabel}</span>
                      </>
                    )}
                    {d.documentType && (
                      <>
                        <span aria-hidden>|</span>
                        <span>{d.documentType}</span>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.1rem",
                      letterSpacing: 0,
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

function GuidedResearchPaths() {
  const paths = [
    {
      title: "Oswald paper trail",
      body: "Move from entity dossier to mentions, timeline context, and the documents that frame Oswald's biography.",
      href: "/entity/oswald",
      meta: "Entity -> mentions -> records",
    },
    {
      title: "Ruby and the transfer",
      body: "Start with Ruby, then compare the Dallas weekend sequence against the related records.",
      href: "/entity/ruby",
      meta: "Profile -> 72h Dallas",
    },
    {
      title: "FBI record lane",
      body: "Read the agency topic as a curated lane before opening the broader document index.",
      href: "/topic/fbi",
      meta: "Topic -> document search",
    },
    {
      title: "Warren Commission record",
      body: "Open the commission topic, questions, bibliography, and supporting documents from one route.",
      href: "/topic/warren-commission",
      meta: "Topic -> questions -> sources",
    },
    {
      title: "CE 399 evidence path",
      body: "Follow the evidence item into custody notes, NARA references, and connected entities.",
      href: "/evidence/ce-399",
      meta: "Evidence -> records",
    },
  ];

  return (
    <section
      className="container"
      aria-label="Guided research paths"
      style={{ marginTop: 52 }}
    >
      <SectionHeading
        eyebrow="Guided paths"
        title="Start with a known thread"
        description="Short routes into the archive for the questions researchers tend to ask first."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 12,
        }}
      >
        {paths.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            style={{
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto",
              gap: 9,
              minHeight: 190,
              padding: "17px 18px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text)",
              textDecoration: "none",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span className="muted num" style={{ fontSize: "0.76rem" }}>
              {path.meta}
            </span>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.18rem",
                lineHeight: 1.22,
                letterSpacing: 0,
              }}
            >
              {path.title}
            </span>
            <span
              className="muted"
              style={{ fontSize: "0.88rem", lineHeight: 1.5 }}
            >
              {path.body}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Open path
              <ArrowRightIcon />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ResearchRoutes({
  primaryEntity,
  primaryTopic,
  recentDocument,
  documentCount,
  ocrPassages,
}: {
  primaryEntity?: EntityCard;
  primaryTopic?: TopicCard;
  recentDocument?: DocumentCard;
  documentCount: number;
  ocrPassages: number;
}) {
  const routes = [
    {
      href: "/search?q=Oswald&mode=document",
      label: "Search the archive",
      title: "Start with a name, agency, place, or NAID",
      body: `${formatNumber(documentCount)} records indexed across metadata, OCR, and curated topic lanes.`,
    },
    primaryTopic
      ? {
          href: primaryTopic.href,
          label: "Open a topic dossier",
          title: primaryTopic.title,
          body: `${formatNumber(primaryTopic.documentCount)} records gathered into a single research lane.`,
        }
      : {
          href: "/topics",
          label: "Open a topic dossier",
          title: "Browse topic dossiers",
          body: "Move through investigations, agencies, locations, and evidence groups.",
        },
    primaryEntity
      ? {
          href: primaryEntity.href,
          label: "Follow an entity",
          title: primaryEntity.name,
          body: `${formatNumber(primaryEntity.mentionCount ?? primaryEntity.documentCount ?? 0)} indexed mentions across records.`,
        }
      : {
          href: "/entities",
          label: "Follow an entity",
          title: "Browse people and organizations",
          body: "Use entity pages to connect people, agencies, and the records that mention them.",
        },
    recentDocument
      ? {
          href: recentDocument.href,
          label: "Read a source record",
          title: recentDocument.title,
          body: `Open NAID ${recentDocument.naid} with metadata, OCR, related entities, and research context.`,
        }
      : {
          href: "/search",
          label: "Read a source record",
          title: "Browse processed records",
          body: `${formatNumber(ocrPassages)} OCR passages are available for close reading.`,
        },
  ];

  return (
    <section
      className="container"
      aria-label="Research routes"
      style={{ marginTop: -24 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
          gap: 24,
          alignItems: "stretch",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "28px 0",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Research routes
          </div>
          <h2
            style={{
              fontSize: "clamp(1.45rem, 1.2rem + 0.85vw, 2.1rem)",
              letterSpacing: 0,
              marginBottom: 10,
            }}
          >
            Pick up the archive from the angle you have.
          </h2>
          <p
            className="muted"
            style={{
              maxWidth: "46ch",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            The fastest path depends on what you know first: a name, a subject,
            a date, or a primary source.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
          }}
        >
          {routes.map((route) => (
            <Link
              key={`${route.label}-${route.href}`}
              href={route.href}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 14,
                alignItems: "start",
                minHeight: 148,
                padding: "16px 18px",
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
                  style={{ display: "block", marginBottom: 10 }}
                >
                  {route.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.14rem",
                    lineHeight: 1.22,
                    letterSpacing: 0,
                  }}
                >
                  {route.title}
                </span>
                <span
                  className="muted"
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontSize: "0.84rem",
                    lineHeight: 1.45,
                  }}
                >
                  {route.body.length > 118
                    ? `${route.body.slice(0, 118).trim()}...`
                    : route.body}
                </span>
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          [aria-label="Research routes"] > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function Hero({
  recordsWithOcr,
  ocrPassages,
  entityCount,
}: {
  recordsWithOcr: number;
  ocrPassages: number;
  entityCount: number;
}) {
  return (
    <section
      style={{
        paddingTop: 56,
        paddingBottom: 64,
      }}
    >
      <div
        className="container"
        data-home-hero="true"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 28,
        }}
      >
        <div>
          <div
            className="eyebrow"
            style={{ marginBottom: 18, color: "var(--text-muted)" }}
          >
            JFK Research Center | Archival Study
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
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
            <SearchBar size="lg" placeholder="Search records, people, agencies..." />
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

        <aside
          aria-label="Archive entry points"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "22px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Start here
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <HeroPath
              href="/search?q=Oswald"
              title="Search the record"
              body="Find records, OCR passages, names, agencies, or NAIDs."
            />
            <HeroPath
              href="/entities"
              title="Browse people and organizations"
              body="Follow entity pages into the documents that mention them."
            />
            <HeroPath
              href="/timeline"
              title="Use the timeline"
              body="Move through events, releases, and investigation milestones."
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
            }}
          >
            <HeroStat label="OCR records" value={recordsWithOcr} />
            <HeroStat label="Passages" value={ocrPassages} />
            <HeroStat label="Entities" value={entityCount} />
          </div>
        </aside>
      </div>

      <style>{`
        @media (min-width: 960px) {
          [data-home-hero="true"] {
            grid-template-columns: minmax(0, 1fr) 360px !important;
            align-items: end;
          }
        }
      `}</style>
    </section>
  );
}

function HeroPath({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        color: "var(--text)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-serif)",
            fontSize: "1.08rem",
            letterSpacing: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          className="muted"
          style={{
            display: "block",
            fontSize: "0.84rem",
            lineHeight: 1.45,
            marginTop: 3,
          }}
        >
          {body}
        </span>
      </span>
      <ArrowRightIcon />
    </Link>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="num"
        style={{
          fontWeight: 600,
          fontSize: "1rem",
          lineHeight: 1.2,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(value)}
      </div>
      <div
        className="eyebrow"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.62rem",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <path
        d="M3 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m8.75 4.25 3.75 3.75-3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {number}
      </span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.15rem",
          letterSpacing: 0,
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
