import Link from "next/link";
import type { ReactNode } from "react";
import type {
  CaseTimelineEvent,
  CorpusManifest,
  DocumentCard,
  EntityCard,
  TopicCard,
} from "@/lib/api-types";
import { fetchCaseTimeline, fetchHome } from "@/lib/api-client";
import { SearchBar } from "@/components/search/search-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { RESEARCH_PATHS } from "@/lib/research-paths";
import { ContinueResearchPanel } from "@/components/research/continue-research-panel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [homeResult, timelineResult] = await Promise.allSettled([
    fetchHome(),
    fetchCaseTimeline(),
  ]);

  if (homeResult.status !== "fulfilled") {
    throw homeResult.reason;
  }

  const data = homeResult.value;
  const timeline = timelineResult.status === "fulfilled" ? timelineResult.value : null;
  const recentReleases =
    timeline?.events
      .filter((event) => event.category === "release")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3) ?? [];

  return (
    <div>
      <HomepageHero />
      <ScopeTrustBand manifest={data.corpusManifest} />
      <EntryRoutesSection
        documentCount={data.corpusManifest.totalRecords}
        entityCount={data.stats.entityCount}
        topicCount={data.stats.topicCount}
        timelineEventCount={timeline?.events.length ?? 0}
      />
      <GuidedResearchPaths />
      <BrowseHubSection
        entities={data.featuredEntities.slice(0, 4)}
        topics={data.featuredTopics.slice(0, 4)}
      />
      <ContinueResearchPanel />
      <ArchiveUpdatesSection
        releases={recentReleases}
        recentDocuments={data.recentDocuments.slice(0, 3)}
      />
      <HomepageResponsiveStyles />
    </div>
  );
}

function HomepageHero() {
  const suggestions = [
    ["Oswald", "/search?q=Oswald"],
    ["Mexico City", "/search?q=Mexico+City"],
    ["CE 399", "/search?q=CE+399"],
    ["104-10301-10004", "/search?q=104-10301-10004"],
  ] as const;

  return (
    <section style={{ padding: "64px 0 42px" }}>
      <div
        className="container home-hero-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
          gap: 42,
          alignItems: "end",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="eyebrow"
            style={{ marginBottom: 16, color: "var(--text-muted)" }}
          >
            Archival study / MVP
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1.04,
              maxWidth: "18ch",
              marginBottom: 20,
            }}
          >
            Search the JFK record by person, agency, place, event, or NAID.
          </h1>
          <p
            style={{
              maxWidth: "62ch",
              color: "var(--text)",
              fontSize: "clamp(1.05rem, 0.96rem + 0.35vw, 1.22rem)",
              lineHeight: 1.6,
              marginBottom: 26,
            }}
          >
            Read primary-source records from the National Archives Catalog,
            connected through entities, topics, timelines, evidence, and official
            media references.
          </p>

          <div style={{ maxWidth: 780 }}>
            <SearchBar
              size="lg"
              placeholder="Try Oswald, Mexico City, CE 399, or 104-10301-10004"
            />
          </div>

          <div
            aria-label="Suggested searches"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              marginTop: 18,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
            }}
          >
            <span>Try:</span>
            {suggestions.map(([label, href]) => (
              <Link key={href} href={href} className="home-query-chip">
                {label}
              </Link>
            ))}
          </div>
        </div>

        <aside
          aria-label="Homepage orientation"
          style={{
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            padding: "20px 0",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Reading room model
          </div>
          <ol
            style={{
              display: "grid",
              gap: 13,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            <HeroNote
              number="01"
              title="Search first"
              body="Begin with a name, agency, event, exhibit number, or archival identifier."
            />
            <HeroNote
              number="02"
              title="Follow context"
              body="Move from records into entities, topics, evidence, timeline events, and questions."
            />
            <HeroNote
              number="03"
              title="Return to sources"
              body="Document pages keep the source metadata, OCR excerpts, and National Archives links close."
            />
          </ol>
        </aside>
      </div>
    </section>
  );
}

function ScopeTrustBand({ manifest }: { manifest: CorpusManifest }) {
  return (
    <section className="container" aria-label="Archive scope and coverage">
      <div
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "24px 0",
        }}
      >
        <div className="home-trust-grid">
          <TrustMetric
            label="Indexed records"
            value={formatNumber(manifest.totalRecords)}
            note="Curated working subset"
          />
          <TrustMetric
            label="OCR records"
            value={formatNumber(manifest.recordsWithOcr)}
            note="Full text available"
          />
          <TrustMetric
            label="OCR passages"
            value={formatNumber(manifest.ocrPassages)}
            note="Searchable chunks"
          />
          <TrustMetric
            label="Indexed releases"
            value={manifest.releasesIndexed.join(", ")}
            note={
              manifest.releasesPending.length > 0
                ? `Not yet indexed: ${manifest.releasesPending.join(", ")}`
                : "Release coverage current"
            }
          />
        </div>
        <div
          className="home-trust-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginTop: 18,
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0, maxWidth: "74ch" }}>
            This index is a curated working subset of the broader JFK
            Assassination Records Collection. OCR coverage is partial and
            provenance is preserved on document pages.
          </p>
          <nav
            aria-label="Scope links"
            style={{ display: "flex", gap: 14, flexWrap: "wrap" }}
          >
            <Link href="/about/methodology">Methodology</Link>
            <Link href="/about/editorial-policy">Editorial policy</Link>
            <Link href="/releases">Release history</Link>
          </nav>
        </div>
      </div>
    </section>
  );
}

function EntryRoutesSection({
  documentCount,
  entityCount,
  topicCount,
  timelineEventCount,
}: {
  documentCount: number;
  entityCount: number;
  topicCount: number;
  timelineEventCount: number;
}) {
  const routes = [
    {
      href: "/search?q=Oswald&mode=document",
      label: "Search",
      title: "Search the archive",
      body: "Use a person, agency, place, exhibit number, event, or NAID.",
      metric: `${formatNumber(documentCount)} indexed records`,
      action: "Start searching",
    },
    {
      href: "/entities",
      label: "Entities",
      title: "Browse people and organizations",
      body: "Follow people, agencies, places, and concepts into their source records.",
      metric: `${formatNumber(entityCount)} entities`,
      action: "Browse entities",
    },
    {
      href: "/topics",
      label: "Topics",
      title: "Browse topics and investigations",
      body: "Use curated subject lanes for investigations, agencies, events, and evidence.",
      metric: `${formatNumber(topicCount)} topic dossiers`,
      action: "See topics",
    },
    {
      href: "/timeline",
      label: "Timeline",
      title: "Use the chronology",
      body: "Move through case events, release history, and investigation milestones.",
      metric:
        timelineEventCount > 0
          ? `${formatNumber(timelineEventCount)} timeline events`
          : "Case chronology",
      action: "Open timeline",
    },
  ];

  return (
    <section className="container" aria-label="Primary archive routes" style={{ marginTop: 52 }}>
      <SectionHeading
        eyebrow="Choose a route"
        title="Start from the angle you have."
        description="Search is the fastest path, but the same records can also be reached through entities, topics, and chronology."
      />
      <div
        className="home-route-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="surface-card"
            style={{
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto auto",
              gap: 10,
              minHeight: 224,
              padding: "18px 18px",
              color: "var(--text)",
              textDecoration: "none",
            }}
            aria-label={`${route.action}: ${route.title}`}
          >
            <span className="eyebrow">{route.label}</span>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.22rem",
                lineHeight: 1.2,
                letterSpacing: 0,
              }}
            >
              {route.title}
            </span>
            <span className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
              {route.body}
            </span>
            <span className="muted num" style={{ fontSize: "0.78rem" }}>
              {route.metric}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.86rem",
                fontWeight: 650,
              }}
            >
              {route.action}
              <ArrowRightIcon />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GuidedResearchPaths() {
  const paths = RESEARCH_PATHS.slice(0, 3).map((path) => ({
    title: path.title,
    body: path.summary,
    href: path.startHref,
    meta: `${path.steps.length} step path`,
  }));

  return (
    <section className="container" aria-label="Guided research paths" style={{ marginTop: 64 }}>
      <SectionHeading
        eyebrow="Guided paths"
        title="Short routes for common starting questions."
        description="Use these when you do not yet know the right query."
        actionHref="/research-paths"
        actionLabel="View all paths"
      />
      <div
        className="home-guided-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {paths.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className="surface-card"
            style={{
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto",
              gap: 9,
              minHeight: 174,
              padding: "17px 18px",
              color: "var(--text)",
              textDecoration: "none",
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
            <span className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>
              {path.body}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 650 }}>
              Open path
              <ArrowRightIcon />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BrowseHubSection({
  entities,
  topics,
}: {
  entities: EntityCard[];
  topics: TopicCard[];
}) {
  return (
    <section className="container" aria-label="Browse archive" style={{ marginTop: 72 }}>
      <SectionHeading
        eyebrow="Browse"
        title="People, agencies, and investigations."
        description="A tighter browse layer for records that are easier to approach by subject than by keyword."
      />
      <div
        className="home-browse-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 20,
        }}
      >
        <BrowseLane
          title="People & organizations"
          href="/entities"
          action="Browse all entities"
        >
          {entities.map((entity) => (
            <BrowseRow
              key={entity.slug}
              href={entity.href}
              label={entity.type === "person" ? "Person" : "Organization"}
              title={entity.name}
              body={entity.summary}
              metric={
                entity.mentionCount != null
                  ? `${formatNumber(entity.mentionCount)} mentions`
                  : `${formatNumber(entity.documentCount ?? 0)} records`
              }
            />
          ))}
        </BrowseLane>
        <BrowseLane title="Topics & investigations" href="/topics" action="See all topics">
          {topics.map((topic) => (
            <BrowseRow
              key={topic.slug}
              href={topic.href}
              label={topic.eyebrow ?? "Topic"}
              title={topic.title}
              body={topic.summary}
              metric={`${formatNumber(topic.documentCount)} documents`}
            />
          ))}
        </BrowseLane>
      </div>
    </section>
  );
}

function ArchiveUpdatesSection({
  releases,
  recentDocuments,
}: {
  releases: CaseTimelineEvent[];
  recentDocuments: DocumentCard[];
}) {
  return (
    <section className="container" aria-label="Archive updates" style={{ marginTop: 72, marginBottom: 88 }}>
      <SectionHeading
        eyebrow="New and recently processed"
        title="Freshness signals."
        description="Release milestones and newly processed records sit together here so the homepage stays current without becoming a changelog."
      />
      <div
        className="home-updates-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
          gap: 22,
          alignItems: "start",
        }}
      >
        <UpdateLane title="Releases" href="/releases" action="All releases">
          {releases.map((release) => (
            <Link
              key={release.id}
              href="/releases"
              style={{
                display: "grid",
                gap: 5,
                color: "var(--text)",
                padding: "13px 0",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              <span className="muted num" style={{ fontSize: "0.78rem" }}>
                {formatDate(release.date)}
              </span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", lineHeight: 1.32, letterSpacing: 0 }}>
                {release.title}
              </span>
            </Link>
          ))}
        </UpdateLane>
        <UpdateLane title="Recently processed records" href="/search" action="See processed records">
          {recentDocuments.map((document) => (
            <Link
              key={document.id}
              href={document.href}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 16,
                color: "var(--text)",
                padding: "13px 0",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span className="muted" style={{ display: "block", fontSize: "0.78rem", marginBottom: 5 }}>
                  {[document.agency, document.dateLabel, document.documentType]
                    .filter(Boolean)
                    .join(" | ")}
                </span>
                <span style={{ display: "block", fontFamily: "var(--font-serif)", fontSize: "1rem", lineHeight: 1.32, letterSpacing: 0 }}>
                  {document.title}
                </span>
              </span>
              <span className="muted num" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                NAID {document.naid}
              </span>
            </Link>
          ))}
        </UpdateLane>
      </div>
    </section>
  );
}

function HeroNote({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", gap: 12 }}>
      <span className="muted num" style={{ fontSize: "0.78rem", paddingTop: 3 }}>
        {number}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-serif)", fontSize: "1.05rem", letterSpacing: 0, lineHeight: 1.25 }}>
          {title}
        </span>
        <span className="muted" style={{ display: "block", marginTop: 4, fontSize: "0.86rem", lineHeight: 1.45 }}>
          {body}
        </span>
      </span>
    </li>
  );
}

function TrustMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="eyebrow" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.35rem, 1rem + 0.9vw, 2rem)",
          lineHeight: 1.05,
          letterSpacing: 0,
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      <div className="muted" style={{ marginTop: 7, fontSize: "0.82rem", lineHeight: 1.4 }}>
        {note}
      </div>
    </div>
  );
}

function BrowseLane({
  title,
  href,
  action,
  children,
}: {
  title: string;
  href: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "18px 0 4px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "1.2rem", letterSpacing: 0 }}>
          {title}
        </h3>
        <Link href={href} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem", whiteSpace: "nowrap" }}>
          {action}
          <ArrowRightIcon />
        </Link>
      </div>
      <div>{children}</div>
    </section>
  );
}

function BrowseRow({
  href,
  label,
  title,
  body,
  metric,
}: {
  href: string;
  label: string;
  title: string;
  body: string;
  metric: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 16,
        alignItems: "start",
        padding: "15px 0",
        borderBottom: "1px solid var(--border)",
        color: "var(--text)",
        textDecoration: "none",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <Badge tone="muted" size="sm">
          {label}
        </Badge>
        <span style={{ display: "block", marginTop: 8, fontFamily: "var(--font-serif)", fontSize: "1.1rem", lineHeight: 1.22, letterSpacing: 0 }}>
          {title}
        </span>
        <span className="muted" style={{ display: "block", marginTop: 6, fontSize: "0.85rem", lineHeight: 1.45 }}>
          {trimCopy(body, 120)}
        </span>
      </span>
      <span className="muted num" style={{ fontSize: "0.78rem", whiteSpace: "nowrap", paddingTop: 3 }}>
        {metric}
      </span>
    </Link>
  );
}

function UpdateLane({
  title,
  href,
  action,
  children,
}: {
  title: string;
  href: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 2 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "1.14rem", letterSpacing: 0 }}>
          {title}
        </h3>
        <Link href={href} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem", whiteSpace: "nowrap" }}>
          {action}
          <ArrowRightIcon />
        </Link>
      </div>
      {children}
    </section>
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

function trimCopy(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function HomepageResponsiveStyles() {
  return (
    <style>{`
      .home-query-chip {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        color: var(--text);
        text-decoration: none;
      }

      .home-trust-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 18px;
      }

      @media (max-width: 980px) {
        .home-hero-layout,
        .home-browse-grid,
        .home-updates-grid {
          grid-template-columns: 1fr !important;
        }

        .home-route-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .home-guided-grid,
        .home-trust-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 620px) {
        .home-route-grid,
        .home-guided-grid,
        .home-trust-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}
