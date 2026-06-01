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
import { formatDate, formatNumber } from "@/lib/format";
import { RESEARCH_PATHS } from "@/lib/research-paths";
import { ContinueResearchPanel } from "@/components/research/continue-research-panel";
import styles from "./home.module.css";

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
      <ContinueResearchPanel />
      <BrowseHubSection
        entities={data.featuredEntities.slice(0, 4)}
        topics={data.featuredTopics.slice(0, 4)}
      />
      <ArchiveUpdatesSection
        releases={recentReleases}
        recentDocuments={data.recentDocuments.slice(0, 3)}
      />
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
    <section className={styles.hero}>
      <div className={`container ${styles.heroGrid}`}>
        <div>
          <div className={styles.heroEyebrow}>
            <span className={styles.rule} />
            <span className="eyebrow">Archival study / MVP</span>
          </div>
          <h1 className={styles.heroTitle}>
            Read the JFK record at the <em>source.</em>
          </h1>
          <p className={styles.heroLead}>
            Search, browse, and read primary-source records from the National
            Archives Catalog - connected through entities, topics, timelines,
            evidence, and official media references.
          </p>

          <div className={styles.searchWrap}>
            <SearchBar
              size="lg"
              placeholder="Search by person, agency, place, event, or NAID"
            />
          </div>

          <div className={styles.heroChips} aria-label="Suggested searches">
            <span>Try</span>
            {suggestions.map(([label, href]) => (
              <Link key={href} href={href} className={styles.queryChip}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <SpecimenRecord />
      </div>
    </section>
  );
}

function SpecimenRecord() {
  const title =
    "Internal Draft History of the Bay of Pigs, Vol. III - Evolution of CIA's Anti-Castro Policies, 1959 - January 1961";
  const agency = "Central Intelligence Agency";
  const date = "December 1, 1979";
  const type = "Paper - textual document";
  const naid = "104-10301-10004";
  const href = "/search?q=104-10301-10004";

  return (
    <aside className={styles.specimen} aria-label="Sample record">
      <span className={styles.specimenTab}>RECORD</span>
      <div className={styles.specimenHead}>
        <span>
          NAID <span className={styles.specimenNaid}>{naid}</span>
        </span>
        <span className={styles.specimenStamp}>DECLASSIFIED</span>
      </div>
      <div className={styles.specimenBody}>
        <dl className={styles.specimenMeta}>
          <dt>AGENCY</dt>
          <dd>{agency}</dd>
          <dt>DATE</dt>
          <dd>{date}</dd>
          <dt>TYPE</dt>
          <dd>{type}</dd>
        </dl>
        <div className={styles.specimenTitle}>{title}</div>
        <div className={styles.specimenOcr} aria-hidden="true">
          <p>
            3. By late 1959 the Directorate of Plans had concluded that the{" "}
            <span className={styles.redact}>redacted text</span> regime could
            not be removed by internal means alone.
          </p>
          <p>
            4. Preparations proceeded under the direction of{" "}
            <span className={styles.redact}>redacted</span> with logistical
            support staged through <span className={styles.redact}>redacted text</span>.
          </p>
        </div>
      </div>
      <div className={styles.specimenFoot}>
        <Link className={styles.specimenLink} href={href}>
          Open document record
          <ArrowRightIcon />
        </Link>
        <span className={styles.specimenMatch}>OCR / 14 passages</span>
      </div>
    </aside>
  );
}

function ScopeTrustBand({ manifest }: { manifest: CorpusManifest }) {
  return (
    <section className="container" aria-label="Archive scope and coverage">
      <div className={styles.statBand}>
        <div className={styles.statGrid}>
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
            compact
          />
        </div>
      </div>
      <div className={styles.statFoot}>
        <p>
          This index is a curated working subset of the broader JFK
          Assassination Records Collection. OCR coverage is partial and
          provenance is preserved on document pages.
        </p>
        <nav aria-label="Scope links">
          <Link href="/about/methodology">Methodology</Link>
          <Link href="/about/editorial-policy">Editorial policy</Link>
          <Link href="/releases">Release history</Link>
        </nav>
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
      code: "A",
      title: "Search the archive",
      body: "Use a person, agency, place, exhibit number, event, or NAID.",
      metric: `${formatNumber(documentCount)} indexed records`,
      action: "Start searching",
    },
    {
      href: "/entities",
      label: "Entities",
      code: "B",
      title: "Browse people and organizations",
      body: "Follow people, agencies, places, and concepts into their source records.",
      metric: `${formatNumber(entityCount)} entities`,
      action: "Browse entities",
    },
    {
      href: "/topics",
      label: "Topics",
      code: "C",
      title: "Browse topics and investigations",
      body: "Use curated subject lanes for investigations, agencies, events, and evidence.",
      metric: `${formatNumber(topicCount)} topic dossiers`,
      action: "See topics",
    },
    {
      href: "/timeline",
      label: "Timeline",
      code: "D",
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
    <section className={`container ${styles.section}`} aria-label="Primary archive routes">
      <HomeSectionHeading
        index="01"
        eyebrow="Choose a route"
        title="Start from the angle you have."
        description="Search is the fastest path, but the same records can also be reached through entities, topics, and chronology."
      />
      <div className={styles.routeGrid}>
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={`surface-card ${styles.routeCard}`}
            aria-label={`${route.action}: ${route.title}`}
          >
            <span className={styles.routeTop}>
              <span className="eyebrow">{route.label}</span>
              <span className={styles.routeNum}>{route.code}</span>
            </span>
            <span className={styles.routeTitle}>{route.title}</span>
            <span className={styles.routeBody}>{route.body}</span>
            <span className={styles.routeMetric}>{route.metric}</span>
            <span className={styles.routeAction}>
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
    <section className={`container ${styles.section}`} aria-label="Guided research paths">
      <HomeSectionHeading
        index="02"
        eyebrow="Guided paths"
        title="Short routes for common starting questions."
        description="Use these when you do not yet know the right query."
        actionHref="/research-paths"
        actionLabel="View all paths"
      />
      <div className={styles.guidedGrid}>
        {paths.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className={`surface-card ${styles.guidedCard}`}
          >
            <span className={styles.guidedMeta}>{path.meta}</span>
            <span className={styles.guidedTitle}>{path.title}</span>
            <span className={styles.guidedBody}>{path.body}</span>
            <span className={styles.routeAction}>
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
    <section className={`container ${styles.section}`} aria-label="Browse archive">
      <HomeSectionHeading
        index="03"
        eyebrow="Browse"
        title="People, agencies, and investigations."
        description="A tighter browse layer for records that are easier to approach by subject than by keyword."
      />
      <div className={styles.twoCol}>
        <BrowseLane
          title="People and organizations"
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
        <BrowseLane title="Topics and investigations" href="/topics" action="See all topics">
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
    <section
      className={`container ${styles.section} ${styles.lastSection}`}
      aria-label="Archive updates"
    >
      <HomeSectionHeading
        index="04"
        eyebrow="New and recently processed"
        title="Freshness signals."
        description="Release milestones and newly processed records sit together so the homepage stays current without becoming a changelog."
      />
      <div className={styles.twoCol}>
        <UpdateLane title="Releases" href="/releases" action="All releases">
          {releases.map((release) => (
            <Link key={release.id} href="/releases" className={styles.updateRow}>
              <span className={styles.updateDate}>{formatDate(release.date)}</span>
              <span className={styles.updateTitle}>{release.title}</span>
            </Link>
          ))}
        </UpdateLane>
        <UpdateLane title="Recently processed records" href="/search" action="See processed records">
          {recentDocuments.map((document) => (
            <Link key={document.id} href={document.href} className={styles.updateDoc}>
              <span className={styles.minWidthZero}>
                <span className={styles.updateDocMeta}>
                  {[document.agency, document.dateLabel, document.documentType]
                    .filter(Boolean)
                    .join(" / ")}
                </span>
                <span className={styles.updateTitle}>{document.title}</span>
              </span>
              <span className={styles.updateDocNaid}>NAID {document.naid}</span>
            </Link>
          ))}
        </UpdateLane>
      </div>
    </section>
  );
}

function HomeSectionHeading({
  index,
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionIndex}>{index}</div>
      <div className={styles.sectionHeadMain}>
        <div className={`eyebrow ${styles.sectionEyebrow}`}>{eyebrow}</div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <p className={styles.sectionDesc}>{description}</p>
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={styles.sectionAction}>
          {actionLabel}
          <ArrowRightIcon />
        </Link>
      )}
    </div>
  );
}

function TrustMetric({
  label,
  value,
  note,
  compact = false,
}: {
  label: string;
  value: string;
  note: string;
  compact?: boolean;
}) {
  return (
    <div className={styles.statCell}>
      <div className={`eyebrow ${styles.statLabel}`}>{label}</div>
      <div className={`${styles.statValue} ${compact ? styles.statValueSmall : ""} num`}>
        {value}
      </div>
      <div className={styles.statNote}>{note}</div>
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
    <section>
      <div className={styles.laneHead}>
        <h3 className={styles.laneTitle}>{title}</h3>
        <Link href={href} className={styles.laneAction}>
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
    <Link href={href} className={styles.browseRow}>
      <span className={styles.minWidthZero}>
        <span className={styles.badge}>{label}</span>
        <span className={styles.browseName}>{title}</span>
        <span className={styles.browseDesc}>{trimCopy(body, 122)}</span>
      </span>
      <span className={styles.browseMetric}>{metric}</span>
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
    <section>
      <div className={styles.laneHead}>
        <h3 className={styles.laneTitle}>{title}</h3>
        <Link href={href} className={styles.laneAction}>
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
