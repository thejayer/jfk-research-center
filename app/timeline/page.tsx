import type { Metadata } from "next";
import Link from "next/link";
import type { CaseTimelineCategory, CaseTimelineEvent } from "@/lib/api-types";
import { fetchCaseTimeline } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/format";
import { timelineEventPacketHref } from "@/lib/timeline-source-bridge";
import { DallasView } from "@/components/timeline/dallas-view";
import { ListView } from "@/components/timeline/list-view";
import { ZoomableTimeline } from "@/components/timeline/zoomable-timeline";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Case-wide timeline from 1939 to present: Oswald biography, Cold War context, Nov 22-25 1963 hour-by-hour, investigative milestones, and declassification releases.",
};

type View = "zoom" | "list" | "dallas";

type Props = {
  searchParams: Promise<{ view?: string; category?: string }>;
};

const CATEGORY_LABELS: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

const VIEW_COPY: Record<
  View,
  { title: string; body: string; bestFor: string; href: string }
> = {
  zoom: {
    title: "Overview timeline",
    body: "Scan the whole case across decades, clusters, and headline events.",
    bestFor: "Best for broad orientation",
    href: "/timeline",
  },
  dallas: {
    title: "72-hour Dallas",
    body: "Follow the assassination weekend from the motorcade through Oswald's transfer.",
    bestFor: "Best for the Dallas sequence",
    href: "/timeline?view=dallas",
  },
  list: {
    title: "Reading list",
    body: "Move through the record step by step by decade, year, and source trail.",
    bestFor: "Best for careful study",
    href: "/timeline?view=list",
  },
};

export default async function TimelinePage({ searchParams }: Props) {
  const data = await fetchCaseTimeline();
  const sp = await searchParams;
  const view: View =
    sp.view === "list" ? "list" : sp.view === "dallas" ? "dallas" : "zoom";
  const selectedCategory = isTimelineCategory(sp.category)
    ? sp.category
    : undefined;

  const sortedEvents = [...data.events].sort((a, b) =>
    a.date === b.date
      ? (a.timeLocal ?? "").localeCompare(b.timeLocal ?? "")
      : a.date.localeCompare(b.date),
  );
  const earliestDate = sortedEvents[0]?.date ?? "";
  const latestDate = sortedEvents.at(-1)?.date ?? "";
  const dallasCount = data.events.filter(
    (event) => event.date >= "1963-11-22" && event.date <= "1963-11-25",
  ).length;
  const sourcedCount = data.events.filter(
    (event) => event.documentLinks.length > 0 || event.sourceExternal.length > 0,
  ).length;
  const topCategory = [...data.countsByCategory].sort(
    (a, b) => b.count - a.count,
  )[0];
  const topDecades = [...data.countsByDecade]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const sourcePackets = sortedEvents
    .filter(
      (event) =>
        event.documentLinks.length > 0 || event.sourceExternal.length > 0,
    )
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 4);
  const isListMode = view === "list";
  const activeCategoryLabel = selectedCategory
    ? CATEGORY_LABELS[selectedCategory]
    : null;

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <a className="timeline-skip-link" href="#timeline-workspace">
        Skip to timeline workspace
      </a>
      <ResearchHistoryTracker
        item={{
          type: "timeline",
          sourceId: `case-timeline-${view}${isListMode && selectedCategory ? `-${selectedCategory}` : ""}`,
          title: `${VIEW_COPY[view].title} timeline`,
          href:
            view === "zoom"
              ? "/timeline"
              : `/timeline?${new URLSearchParams({
                  view,
                  ...(isListMode && selectedCategory
                    ? { category: selectedCategory }
                    : {}),
                }).toString()}`,
          context:
            isListMode && selectedCategory
              ? `${CATEGORY_LABELS[selectedCategory]} events`
              : `${data.events.length.toLocaleString()} case events`,
        }}
      />
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Timeline</span>
      </nav>

      <header
        style={{
          paddingTop: 40,
          paddingBottom: 28,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "76ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Case chronology
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
              maxWidth: "15ch",
            }}
          >
            Trace the Kennedy case across events, investigations, and releases
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.06rem, 0.94rem + 0.36vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 14,
              maxWidth: "62ch",
            }}
          >
            Move from Cold War context to the Dallas weekend, later inquiries,
            and release history in one linked chronology.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, margin: 0 }}
          >
            Choose a view based on your question: overview, Dallas sequence, or
            reading list.
          </p>
        </div>
      </header>

      <ViewModeSelector current={view} />

      <section
        aria-label="Timeline profile and filters"
        style={{
          marginTop: 22,
          marginBottom: 34,
          padding: "20px 0",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 18,
          alignItems: "start",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Timeline profile
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              {earliestDate && latestDate
                ? `${formatDate(earliestDate)} through ${formatDate(latestDate)}.`
                : "Timeline range pending."}{" "}
              {topCategory &&
                `${CATEGORY_LABELS[topCategory.category]} is the largest category.`}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 8,
            }}
          >
            <ProfileStat label="Events" value={data.events.length} />
            <ProfileStat label="72h Dallas" value={dallasCount} />
            <ProfileStat label="Sourced" value={sourcedCount} />
            <ProfileStat label="Decades" value={data.countsByDecade.length} />
          </div>
          <p
            className="muted"
            style={{ margin: 0, fontSize: "0.83rem", lineHeight: 1.55 }}
          >
            Events are selected to connect biography, operations, Dallas,
            investigations, deaths, and release history into one working
            chronology.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            minWidth: 0,
          }}
        >
          <nav
            aria-label="Timeline categories"
            style={{ display: "grid", gap: 10 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <div className="eyebrow">Category filters</div>
              {activeCategoryLabel && (
                <Link
                  href="/timeline?view=list"
                  style={{
                    color: "var(--text)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  Clear {activeCategoryLabel}
                </Link>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {data.countsByCategory.map((item) => (
                <a
                  key={item.category}
                  href={`/timeline?view=list&category=${item.category}`}
                  className="surface-card"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 999,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>{CATEGORY_LABELS[item.category]}</span>
                  <span className="muted num">{formatNumber(item.count)}</span>
                </a>
              ))}
            </div>
          </nav>

          <nav aria-label="Dense decades" style={{ display: "grid", gap: 10 }}>
            <div className="eyebrow">Dense decades</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <a
                href="/timeline?view=list"
                className="num surface-card"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 999,
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: "0.82rem",
                }}
              >
                All decades
              </a>
              {topDecades.map((item) => (
                <a
                  key={item.decade}
                  href={`/timeline?view=list#decade-${item.decade}`}
                  className="num surface-card"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 999,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>{item.decade}</span>
                  <span className="muted">{formatNumber(item.count)}</span>
                </a>
              ))}
            </div>
          </nav>
        </div>
      </section>

      {sourcePackets.length > 0 && (
        <section aria-label="Start with sourced events" style={{ marginBottom: 38 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 20,
              alignItems: "start",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
              padding: "24px 0",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Start with sourced events
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.45rem",
                  lineHeight: 1.15,
                  letterSpacing: 0,
                  marginBottom: 8,
                }}
              >
                Read the record behind the event.
              </h2>
              <p className="muted" style={{ maxWidth: "48ch", lineHeight: 1.6 }}>
                These events already connect directly to records or external
                source anchors, making them the fastest route from chronology
                into evidence.
              </p>
              <Link
                href="/timeline?view=list"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--text)",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                Open reading list
                <ArrowRightIcon />
              </Link>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
                gap: 10,
              }}
            >
              {sourcePackets.map((event) => (
                <SourceEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      <main
        id="timeline-workspace"
        aria-label={`${VIEW_COPY[view].title} timeline view`}
      >
        {view === "list" && (
          <ListView data={data} initialCategory={selectedCategory} />
        )}
        {view === "dallas" && <DallasView data={data} />}
        {view === "zoom" && <ZoomableTimeline data={data} />}
      </main>

      {view === "zoom" && (
        <p
          className="muted"
          style={{
            fontSize: "0.78rem",
            marginTop: 24,
            maxWidth: "72ch",
          }}
        >
          Prefer a step-by-step chronology?{" "}
          <Link
            href="/timeline?view=list"
            style={{ color: "var(--text)", textDecoration: "underline" }}
          >
            Open reading list mode
          </Link>
        </p>
      )}
    </div>
  );
}

function isTimelineCategory(value: string | undefined): value is CaseTimelineCategory {
  return (
    value === "biographical" ||
    value === "operational" ||
    value === "investigation" ||
    value === "release" ||
    value === "death"
  );
}

function ViewModeSelector({ current }: { current: View }) {
  return (
    <nav
      aria-label="Choose timeline view"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        gap: 10,
        marginTop: 22,
      }}
    >
      {(Object.keys(VIEW_COPY) as View[]).map((view) => {
        const copy = VIEW_COPY[view];
        const active = current === view;
        return (
          <Link
            key={view}
            href={copy.href}
            aria-current={active ? "page" : undefined}
            className="surface-card"
            style={{
              display: "grid",
              gap: 8,
              padding: "14px 15px",
              border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
              borderRadius: 8,
              background: active ? "var(--text)" : "var(--surface)",
              color: active ? "var(--bg)" : "var(--text)",
              textDecoration: "none",
            }}
          >
            <span
              className="eyebrow"
              style={{
                color: active ? "color-mix(in srgb, var(--bg) 76%, transparent)" : "var(--text-muted)",
                letterSpacing: "0.09em",
              }}
            >
              {copy.bestFor}
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 700 }}>
              {copy.title}
            </span>
            <span
              style={{
                color: active ? "color-mix(in srgb, var(--bg) 74%, transparent)" : "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: 1.45,
              }}
            >
              {copy.body}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SourceEventCard({ event }: { event: CaseTimelineEvent }) {
  return (
    <article
      className="surface-card"
      style={{
        padding: "14px 14px 15px",
        display: "grid",
        gap: 9,
      }}
    >
      <div className="muted num" style={{ fontSize: "0.76rem" }}>
        {formatDate(event.date)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1rem",
          lineHeight: 1.25,
          letterSpacing: 0,
        }}
      >
        {event.title}
      </div>
      <div className="muted" style={{ fontSize: "0.78rem" }}>
        {countLabel(event.documentLinks.length, "document")} /{" "}
        {countLabel(event.sourceExternal.length, "external source")}
      </div>
      <Link
        href={timelineEventPacketHref(event)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text)",
          fontSize: "0.84rem",
          fontWeight: 600,
        }}
      >
        Open source packet
        <ArrowRightIcon />
      </Link>
    </article>
  );
}

function ProfileStat({
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
        padding: "10px 6px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "1.08rem" }}>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.62rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
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

function countLabel(value: number, noun: string): string {
  return `${value} ${value === 1 ? noun : `${noun}s`}`;
}
