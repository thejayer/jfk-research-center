import Link from "next/link";
import type {
  CaseTimelineCategory,
  CaseTimelineEvent,
  CaseTimelineIndex,
} from "@/lib/api-types";
import { CategoryFilterChips } from "./category-filter-chips";
import { DecadeSection } from "./decade-section";
import { EventCard } from "./event-card";

const MARQUEE_START = "1963-11-22";
const MARQUEE_END = "1963-11-25";

const CATEGORY_LABEL: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

export function ListView({
  data,
  initialCategory,
}: {
  data: CaseTimelineIndex;
  initialCategory?: CaseTimelineCategory;
}) {
  const byDecade = new Map<string, Map<string, CaseTimelineEvent[]>>();
  const categoryCounts: Record<CaseTimelineCategory, number> = {
    biographical: 0,
    operational: 0,
    investigation: 0,
    release: 0,
    death: 0,
  };

  for (const event of data.events) {
    const year = event.date.slice(0, 4);
    const decade = `${year.slice(0, 3)}0s`;
    if (!byDecade.has(decade)) byDecade.set(decade, new Map());
    const years = byDecade.get(decade)!;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(event);
    categoryCounts[event.category] += 1;
  }

  const decades = Array.from(byDecade.keys()).sort();
  const routeEvents = initialCategory
    ? data.events.filter((event) => event.category === initialCategory)
    : data.events;
  const readingSummary = summarizeEvents(routeEvents);
  const allSummary = summarizeEvents(data.events);
  const yearRange = summarizeYearRange(
    routeEvents.length > 0 ? routeEvents : data.events,
  );
  const decadeSummaries = decades.map((decade) => {
    const years = byDecade.get(decade)!;
    const events = Array.from(years.values()).flat();
    return { decade, ...summarizeEvents(events) };
  });

  return (
    <>
      <ReadingListHeader
        activeCategory={initialCategory}
        allSummary={allSummary}
        readingSummary={readingSummary}
        yearRange={yearRange}
      />
      <CategoryFilterChips
        counts={categoryCounts}
        initialCategory={initialCategory}
      />

      <nav
        aria-labelledby="timeline-decade-nav-title"
        style={{
          position: "sticky",
          top: 64,
          zIndex: 20,
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "saturate(1.2) blur(8px)",
          WebkitBackdropFilter: "saturate(1.2) blur(8px)",
          padding: "13px 0 14px",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            id="timeline-decade-nav-title"
            className="eyebrow"
            style={{ letterSpacing: "0.1em" }}
          >
            Jump by decade
          </div>
          <div className="muted" style={{ fontSize: "0.78rem" }}>
            Events / source-backed entries
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 124px), 1fr))",
            gap: 8,
          }}
        >
          {decadeSummaries.map((summary) => (
            <a
              key={summary.decade}
              href={`#decade-${summary.decade}`}
              className="num"
              style={{
                padding: "9px 10px",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                color: "var(--text)",
                textDecoration: "none",
                background: "var(--surface)",
                display: "grid",
                gap: 4,
              }}
            >
              <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                {summary.decade}
              </span>
              <span
                className="muted"
                style={{ fontSize: "0.7rem", lineHeight: 1.35 }}
              >
                {countLabel(summary.total, "event")} /{" "}
                {countLabel(summary.sourceBacked, "source-backed event")}
              </span>
            </a>
          ))}
        </div>
      </nav>

      {decades.map((decade) => {
        const years = byDecade.get(decade)!;
        const yearKeys = Array.from(years.keys()).sort();
        const events = Array.from(years.values()).flat();
        const summary = summarizeEvents(events);
        return (
          <DecadeSection
            key={decade}
            decade={decade}
            totalEvents={summary.total}
            sourceBackedEvents={summary.sourceBacked}
          >
            {yearKeys.map((year) => (
              <YearGroup
                key={year}
                year={year}
                events={years.get(year)!}
              />
            ))}
          </DecadeSection>
        );
      })}
    </>
  );
}

function ReadingListHeader({
  activeCategory,
  allSummary,
  readingSummary,
  yearRange,
}: {
  activeCategory?: CaseTimelineCategory;
  allSummary: EventSummary;
  readingSummary: EventSummary;
  yearRange: string;
}) {
  return (
    <section
      aria-labelledby="timeline-reading-list-title"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
        gap: 24,
        alignItems: "start",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "color-mix(in srgb, var(--text) 3%, var(--surface))",
        padding: "18px",
        marginBottom: 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Close-reading chronology
        </div>
        <h2
          id="timeline-reading-list-title"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.45rem, 1.18rem + 0.78vw, 2rem)",
            lineHeight: 1.12,
            letterSpacing: 0,
            marginBottom: 10,
          }}
        >
          Read the case as a sourced sequence.
        </h2>
        <p
          className="muted"
          style={{ lineHeight: 1.65, margin: 0, maxWidth: "68ch" }}
        >
          Use the decade rail for long-range movement, category chips for focus,
          and event anchors for shareable citations back into the chronology.
        </p>
        {activeCategory && (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              fontSize: "0.86rem",
            }}
          >
            <span>
              Showing <strong>{CATEGORY_LABEL[activeCategory]}</strong> events
              from the route filter.
            </span>
            <Link
              href="/timeline?view=list"
              style={{
                color: "var(--text)",
                fontWeight: 700,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Reset route filter
            </Link>
          </p>
        )}
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          margin: 0,
        }}
      >
        <ReadingStat label="Events in scope" value={readingSummary.total} />
        <ReadingStat label="Source-backed" value={readingSummary.sourceBacked} />
        <ReadingStat label="Headline events" value={readingSummary.headline} />
        <ReadingStat label="Years covered" value={yearRange} />
        {activeCategory && (
          <ReadingStat label="All timeline events" value={allSummary.total} />
        )}
      </dl>
    </section>
  );
}

function ReadingStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: "10px 10px 11px",
      }}
    >
      <dt
        className="muted"
        style={{
          fontSize: "0.64rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd className="num" style={{ margin: 0, fontSize: "1rem" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
    </div>
  );
}

function YearGroup({
  year,
  events,
}: {
  year: string;
  events: CaseTimelineEvent[];
}) {
  const summary = summarizeEvents(events);
  const pre = events.filter((e) => e.date < MARQUEE_START);
  const marquee = events.filter(
    (e) => e.date >= MARQUEE_START && e.date <= MARQUEE_END,
  );
  const post = events.filter((e) => e.date > MARQUEE_END);

  return (
    <div style={{ marginBottom: 30 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <h3
          className="num"
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: 0,
            margin: 0,
          }}
        >
          {year}
        </h3>
        <div className="muted num" style={{ fontSize: "0.76rem" }}>
          {countLabel(summary.total, "event")} /{" "}
          {countLabel(summary.sourceBacked, "source-backed event")}
        </div>
      </div>
      {pre.length > 0 && <EventList events={pre} />}
      {marquee.length > 0 && (
        <div
          style={{
            marginTop: pre.length > 0 ? 14 : 0,
            marginBottom: post.length > 0 ? 14 : 0,
            padding: "14px 14px 16px",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--text) 4%, var(--surface))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div
              className="eyebrow"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                color: "var(--text-muted)",
              }}
            >
              72 hours in Dallas / Nov 22-25, 1963
            </div>
            <div className="muted num" style={{ fontSize: "0.74rem" }}>
              {countLabel(marquee.length, "event")} /{" "}
              {countLabel(sourceBackedCount(marquee), "source-backed event")}
            </div>
          </div>
          <EventList events={marquee} />
        </div>
      )}
      {post.length > 0 && <EventList events={post} />}
    </div>
  );
}

function EventList({ events }: { events: CaseTimelineEvent[] }) {
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {events.map((e) => (
        <EventCard key={e.id} event={e} as="li" />
      ))}
    </ol>
  );
}

type EventSummary = {
  total: number;
  sourceBacked: number;
  headline: number;
};

function summarizeEvents(events: CaseTimelineEvent[]): EventSummary {
  let sourceBacked = 0;
  let headline = 0;
  for (const event of events) {
    if (eventHasSources(event)) sourceBacked += 1;
    if (event.importance >= 5) headline += 1;
  }
  return { total: events.length, sourceBacked, headline };
}

/**
 * Summarize the year span for timeline events whose date begins with YYYY.
 *
 * @param events - Case timeline events with ISO-like date strings.
 * @returns "No events" for empty input, one year for same-year events, or
 * a lexical min-max range such as "1939-2025" for multi-year input. Update
 * this if event.date stops placing the four-digit year at the start.
 *
 * @example summarizeYearRange([]) -> "No events"
 * @example summarizeYearRange([{ date: "1963-11-22", ... }]) -> "1963"
 * @example summarizeYearRange(multiYearEvents) -> "1939-2025"
 */
function summarizeYearRange(events: CaseTimelineEvent[]): string {
  if (events.length === 0) return "No events";
  let min = events[0]!.date.slice(0, 4);
  let max = min;
  for (const event of events) {
    const year = event.date.slice(0, 4);
    if (year < min) min = year;
    if (year > max) max = year;
  }
  return min === max ? min : `${min}-${max}`;
}

function sourceBackedCount(events: CaseTimelineEvent[]): number {
  return events.reduce(
    (count, event) => count + (eventHasSources(event) ? 1 : 0),
    0,
  );
}

function eventHasSources(event: CaseTimelineEvent): boolean {
  return event.documentLinks.length > 0 || event.sourceExternal.length > 0;
}

function countLabel(value: number, noun: string): string {
  return `${value.toLocaleString()} ${value === 1 ? noun : `${noun}s`}`;
}
