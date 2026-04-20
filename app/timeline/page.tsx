import type { Metadata } from "next";
import Link from "next/link";
import { fetchCaseTimeline } from "@/lib/api-client";
import type {
  CaseTimelineCategory,
  CaseTimelineEvent,
} from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { CategoryFilterChips } from "@/components/timeline/category-filter-chips";
import { DecadeSection } from "@/components/timeline/decade-section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Case-wide timeline from 1939 to present — Oswald biography, Cold War context, Nov 22-25 1963 hour-by-hour, investigative milestones, and declassification releases.",
};

const CATEGORY_LABEL: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

const CATEGORY_COLOR: Record<CaseTimelineCategory, string> = {
  biographical: "var(--text)",
  operational: "var(--text)",
  investigation: "var(--text-muted)",
  release: "var(--text-muted)",
  death: "var(--text-muted)",
};

const MARQUEE_START = "1963-11-22";
const MARQUEE_END = "1963-11-25";

export default async function TimelinePage() {
  const data = await fetchCaseTimeline();

  const byDecade = new Map<string, Map<string, CaseTimelineEvent[]>>();
  const categoryCounts: Record<CaseTimelineCategory, number> = {
    biographical: 0,
    operational: 0,
    investigation: 0,
    release: 0,
    death: 0,
  };
  let latestDate = "";
  for (const e of data.events) {
    const year = e.date.slice(0, 4);
    const decade = `${year.slice(0, 3)}0s`;
    if (!byDecade.has(decade)) byDecade.set(decade, new Map());
    const years = byDecade.get(decade)!;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(e);
    categoryCounts[e.category] += 1;
    if (e.date > latestDate) latestDate = e.date;
  }
  const decades = Array.from(byDecade.keys()).sort();

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Timeline
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          The case, 1939 – present
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          {data.events.length} events across biographical, operational,
          investigative, release, and death categories. The November
          22&mdash;25, 1963 block is an hour-by-hour marquee; the earlier
          Cold-War context (Bay of Pigs, Cuban Missile Crisis) and later
          investigative milestones (Warren Commission, Church Committee,
          HSCA, ARRB) frame it. Each event links to related entities,
          topics, and source documents where those exist.
        </p>
        {latestDate && (
          <p
            className="muted num"
            style={{
              fontSize: "0.82rem",
              marginTop: 10,
              letterSpacing: "0.02em",
            }}
          >
            Ongoing · current through {formatDate(latestDate)}
          </p>
        )}
      </header>

      <CategoryFilterChips counts={categoryCounts} />

      <nav
        aria-label="Decade jump"
        style={{
          position: "sticky",
          top: 64,
          zIndex: 20,
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "saturate(1.2) blur(8px)",
          WebkitBackdropFilter: "saturate(1.2) blur(8px)",
          padding: "12px 0",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {decades.map((d) => (
          <a
            key={d}
            href={`#decade-${d}`}
            className="num"
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              fontSize: "0.8rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {d} ·{" "}
            {Array.from(byDecade.get(d)!.values()).reduce(
              (n, l) => n + l.length,
              0,
            )}
          </a>
        ))}
      </nav>

      {decades.map((decade) => {
        const years = byDecade.get(decade)!;
        const yearKeys = Array.from(years.keys()).sort();
        const totalEvents = Array.from(years.values()).reduce(
          (n, l) => n + l.length,
          0,
        );
        return (
          <DecadeSection
            key={decade}
            decade={decade}
            totalEvents={totalEvents}
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
  const pre = events.filter((e) => e.date < MARQUEE_START);
  const marquee = events.filter(
    (e) => e.date >= MARQUEE_START && e.date <= MARQUEE_END,
  );
  const post = events.filter((e) => e.date > MARQUEE_END);

  return (
    <div style={{ marginBottom: 30 }}>
      <h3
        className="num"
        style={{
          fontSize: "1.05rem",
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 10,
          letterSpacing: "0.02em",
        }}
      >
        {year}
      </h3>
      {pre.length > 0 && <EventList events={pre} />}
      {marquee.length > 0 && (
        <div
          style={{
            marginTop: pre.length > 0 ? 14 : 0,
            marginBottom: post.length > 0 ? 14 : 0,
            padding: "14px 14px 16px",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background:
              "color-mix(in srgb, var(--text) 4%, var(--surface))",
          }}
        >
          <div
            className="eyebrow"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            72 hours in Dallas · Nov 22–25, 1963
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
        <EventCard key={e.id} event={e} />
      ))}
    </ol>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function EventCard({ event: e }: { event: CaseTimelineEvent }) {
  return (
    <li
      id={e.id}
      data-timeline-event
      data-category={e.category}
      style={{
        padding: "12px 16px 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        scrollMarginTop: "calc(var(--header-height, 64px) + 80px)",
      }}
    >
      <div
        className="num"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: "0.74rem",
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        <span>{formatDate(e.date)}</span>
        {e.timeLocal && (
          <>
            <span aria-hidden="true">·</span>
            <span>{e.timeLocal}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: CATEGORY_COLOR[e.category],
          }}
        >
          {CATEGORY_LABEL[e.category]}
        </span>
        {e.importance >= 5 && (
          <span title="Headline event" style={{ letterSpacing: "0.04em" }}>
            ★ headline
          </span>
        )}
        <a
          href={`#${e.id}`}
          aria-label={`Permalink to ${e.title}`}
          className="timeline-permalink"
          style={{
            marginLeft: "auto",
            fontSize: "0.9rem",
            textDecoration: "none",
            padding: "0 4px",
            lineHeight: 1,
            color: "var(--text-muted)",
          }}
        >
          #
        </a>
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.05rem",
          letterSpacing: "-0.005em",
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {e.title}
      </div>
      <p
        style={{
          fontSize: "0.92rem",
          lineHeight: 1.55,
          color: "var(--text)",
          marginTop: 4,
          marginBottom: 0,
        }}
      >
        {e.description}
      </p>
      {(e.relatedEntityIds.length > 0 || e.relatedTopicIds.length > 0) && (
        <div
          style={{
            marginTop: 8,
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "baseline",
          }}
        >
          <span
            className="eyebrow"
            style={{ letterSpacing: "0.08em", marginRight: 2 }}
          >
            Related:
          </span>
          {e.relatedEntityIds.map((id) => (
            <Link
              key={id}
              href={`/entity/${encodeURIComponent(id)}`}
              style={{
                padding: "1px 6px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {id}
            </Link>
          ))}
          {e.relatedTopicIds.map((id) => (
            <Link
              key={id}
              href={`/topic/${encodeURIComponent(id)}`}
              style={{
                padding: "1px 6px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              #{id}
            </Link>
          ))}
        </div>
      )}
      {e.sourceExternal.length > 0 && (
        <div
          style={{
            marginTop: 6,
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "baseline",
          }}
        >
          <span
            className="eyebrow"
            style={{ letterSpacing: "0.08em", marginRight: 2 }}
          >
            Sources:
          </span>
          {e.sourceExternal.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                padding: "1px 6px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {hostLabel(url)} ↗
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
