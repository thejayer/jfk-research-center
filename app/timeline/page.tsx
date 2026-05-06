import type { Metadata } from "next";
import Link from "next/link";
import type { CaseTimelineCategory } from "@/lib/api-types";
import { fetchCaseTimeline } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/format";
import { DallasView } from "@/components/timeline/dallas-view";
import { ListView } from "@/components/timeline/list-view";
import { ZoomableTimeline } from "@/components/timeline/zoomable-timeline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Case-wide timeline from 1939 to present: Oswald biography, Cold War context, Nov 22-25 1963 hour-by-hour, investigative milestones, and declassification releases.",
};

type View = "zoom" | "list" | "dallas";

type Props = {
  searchParams: Promise<{ view?: string }>;
};

const CATEGORY_LABELS: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

const VIEW_COPY: Record<View, { title: string; body: string; href: string }> = {
  zoom: {
    title: "Zoom map",
    body: "Use the interactive canvas to scan long arcs, density, and category distribution.",
    href: "/timeline",
  },
  dallas: {
    title: "72h Dallas",
    body: "Read the hour-by-hour sequence from the motorcade through Oswald's transfer.",
    href: "/timeline?view=dallas",
  },
  list: {
    title: "Chronology",
    body: "Move through the record by decade and year in a compact reading list.",
    href: "/timeline?view=list",
  },
};

export default async function TimelinePage({ searchParams }: Props) {
  const data = await fetchCaseTimeline();
  const sp = await searchParams;
  const view: View =
    sp.view === "list" ? "list" : sp.view === "dallas" ? "dallas" : "zoom";

  const sortedEvents = data.events.toSorted((a, b) =>
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
  const topCategory = data.countsByCategory.toSorted((a, b) => b.count - a.count)[0];
  const topDecades = data.countsByDecade.toSorted((a, b) => b.count - a.count).slice(0, 4);

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 40,
          paddingBottom: 34,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "70ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Case chronology
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            The case, 1939 to present
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            A case-wide chronology for moving between biography, Cold War
            context, the Dallas weekend, investigation milestones, and release
            history.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 18 }}
          >
            Switch views depending on the question: zoom out for the whole
            record, isolate the 72-hour Dallas sequence, or read the timeline
            by decade.
          </p>
          <ViewModeCards current={view} />
        </div>

        <aside
          aria-label="Timeline profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Timeline profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            <ProfileStat label="Events" value={data.events.length} />
            <ProfileStat label="72h Dallas" value={dallasCount} />
            <ProfileStat label="Sourced" value={sourcedCount} />
            <ProfileStat label="Decades" value={data.countsByDecade.length} />
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            {earliestDate && latestDate
              ? `${formatDate(earliestDate)} through ${formatDate(latestDate)}.`
              : "Timeline range pending."}{" "}
            {topCategory &&
              `${CATEGORY_LABELS[topCategory.category]} is the largest category.`}
          </p>
        </aside>
      </header>

      <section
        aria-label="Timeline navigation"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 18,
          marginTop: 26,
          marginBottom: 38,
        }}
      >
        <nav aria-label="Timeline categories" style={{ display: "grid", gap: 10 }}>
          <div className="eyebrow">Categories</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
            }}
          >
            {data.countsByCategory.map((item) => (
              <a
                key={item.category}
                href="/timeline?view=list"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 11px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface)",
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
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
            }}
          >
            {topDecades.map((item) => (
              <a
                key={item.decade}
                href={`/timeline?view=list#decade-${item.decade}`}
                className="num"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "9px 11px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface)",
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
      </section>

      <main aria-label={`${VIEW_COPY[view].title} timeline view`}>
        {view === "list" && <ListView data={data} />}
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
          Prefer a chronological list?{" "}
          <Link
            href="/timeline?view=list"
            style={{ color: "var(--text)", textDecoration: "underline" }}
          >
            Switch to list view
          </Link>
        </p>
      )}
    </div>
  );
}

function ViewModeCards({ current }: { current: View }) {
  return (
    <nav
      aria-label="Timeline view"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 8,
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
            style={{
              display: "grid",
              gap: 6,
              padding: "11px 12px",
              border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
              borderRadius: 8,
              background: active ? "var(--text)" : "var(--surface)",
              color: active ? "var(--bg)" : "var(--text)",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {copy.title}
            </span>
            <span
              style={{
                color: active ? "color-mix(in srgb, var(--bg) 74%, transparent)" : "var(--text-muted)",
                fontSize: "0.75rem",
                lineHeight: 1.35,
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
