import type { Metadata } from "next";
import Link from "next/link";
import { fetchCaseTimeline } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { ListView } from "@/components/timeline/list-view";
import { ZoomableTimeline } from "@/components/timeline/zoomable-timeline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Case-wide timeline from 1939 to present — Oswald biography, Cold War context, Nov 22-25 1963 hour-by-hour, investigative milestones, and declassification releases.",
};

type Props = {
  searchParams: Promise<{ view?: string }>;
};

export default async function TimelinePage({ searchParams }: Props) {
  const data = await fetchCaseTimeline();
  const sp = await searchParams;
  const isList = sp.view === "list";

  let latestDate = "";
  for (const e of data.events) if (e.date > latestDate) latestDate = e.date;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 28 }}>
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
        <p className="muted" style={{ fontSize: "1.02rem", lineHeight: 1.65 }}>
          {data.events.length} events across biographical, operational,
          investigative, release, and death categories. The November
          22&mdash;25, 1963 block is an hour-by-hour marquee; the earlier
          Cold-War context (Bay of Pigs, Cuban Missile Crisis) and later
          investigative milestones (Warren Commission, Church Committee,
          HSCA, ARRB) frame it.
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

        <div
          role="group"
          aria-label="Timeline view"
          style={{
            marginTop: 16,
            display: "inline-flex",
            border: "1px solid var(--border-strong)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <ViewToggleLink href="/timeline" active={!isList}>
            Zoom
          </ViewToggleLink>
          <ViewToggleLink href="/timeline?view=list" active={isList}>
            List
          </ViewToggleLink>
        </div>
      </header>

      {isList ? <ListView data={data} /> : <ZoomableTimeline data={data} />}

      {!isList && (
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
            Switch to list view →
          </Link>
        </p>
      )}
    </div>
  );
}

function ViewToggleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        padding: "6px 14px",
        fontSize: "0.78rem",
        fontFamily: "inherit",
        textDecoration: "none",
        background: active ? "var(--text)" : "transparent",
        color: active ? "var(--bg)" : "var(--text-muted)",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </Link>
  );
}
