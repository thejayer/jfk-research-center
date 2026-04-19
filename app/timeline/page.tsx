import type { Metadata } from "next";
import Link from "next/link";
import { fetchCaseTimeline } from "@/lib/api-client";
import type {
  CaseTimelineCategory,
  CaseTimelineEvent,
} from "@/lib/api-types";
import { formatDate } from "@/lib/format";

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

export default async function TimelinePage() {
  const data = await fetchCaseTimeline();

  // Group events by decade → year.
  const byDecade = new Map<string, Map<string, CaseTimelineEvent[]>>();
  for (const e of data.events) {
    const year = e.date.slice(0, 4);
    const decade = `${year.slice(0, 3)}0s`;
    if (!byDecade.has(decade)) byDecade.set(decade, new Map());
    const years = byDecade.get(decade)!;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(e);
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
      </header>

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
        return (
          <section
            key={decade}
            id={`decade-${decade}`}
            style={{ marginBottom: 56 }}
          >
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.6rem",
                letterSpacing: "-0.01em",
                marginBottom: 20,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 10,
              }}
            >
              <span className="num">{decade}</span>
            </h2>
            {yearKeys.map((year) => (
              <div key={year} style={{ marginBottom: 30 }}>
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
                  {years.get(year)!.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function EventCard({ event: e }: { event: CaseTimelineEvent }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 16,
        padding: "14px 16px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <div
        className="num muted"
        style={{ fontSize: "0.78rem", lineHeight: 1.5 }}
      >
        <div>{formatDate(e.date)}</div>
        {e.timeLocal && (
          <div style={{ fontSize: "0.72rem", marginTop: 2 }}>{e.timeLocal}</div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "2px 8px",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              color: CATEGORY_COLOR[e.category],
            }}
          >
            {CATEGORY_LABEL[e.category]}
          </span>
          {e.importance >= 5 && (
            <span
              className="muted"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.04em",
              }}
              title="Headline event"
            >
              ★ headline
            </span>
          )}
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
            className="muted"
            style={{
              marginTop: 8,
              fontSize: "0.78rem",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {e.relatedEntityIds.map((id) => (
              <Link
                key={id}
                href={`/entity/${encodeURIComponent(id)}`}
                style={{
                  padding: "1px 6px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
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
                }}
              >
                #{id}
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
