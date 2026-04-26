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

export function ListView({ data }: { data: CaseTimelineIndex }) {
  const byDecade = new Map<string, Map<string, CaseTimelineEvent[]>>();
  const categoryCounts: Record<CaseTimelineCategory, number> = {
    biographical: 0,
    operational: 0,
    investigation: 0,
    release: 0,
    death: 0,
  };
  for (const e of data.events) {
    const year = e.date.slice(0, 4);
    const decade = `${year.slice(0, 3)}0s`;
    if (!byDecade.has(decade)) byDecade.set(decade, new Map());
    const years = byDecade.get(decade)!;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(e);
    categoryCounts[e.category] += 1;
  }
  const decades = Array.from(byDecade.keys()).sort();

  return (
    <>
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
    </>
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
            background: "color-mix(in srgb, var(--text) 4%, var(--surface))",
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
        <EventCard key={e.id} event={e} as="li" />
      ))}
    </ol>
  );
}
