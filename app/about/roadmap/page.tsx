import type { Metadata } from "next";
import Link from "next/link";
import { ROADMAP, type RoadmapStatus } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "Shipped, in-progress, and planned surfaces of the JFK Research Center.",
};

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  shipped: "Shipped",
  in_progress: "In progress",
  planned: "Planned",
};

const STATUS_TONE: Record<
  RoadmapStatus,
  { bg: string; fg: string; border: string }
> = {
  shipped: {
    bg: "color-mix(in srgb, var(--accent) 14%, transparent)",
    fg: "var(--accent)",
    border: "color-mix(in srgb, var(--accent) 40%, transparent)",
  },
  in_progress: {
    bg: "color-mix(in srgb, #d97706 14%, transparent)",
    fg: "#b45309",
    border: "color-mix(in srgb, #d97706 40%, transparent)",
  },
  planned: {
    bg: "color-mix(in srgb, var(--text-muted) 12%, transparent)",
    fg: "var(--text-muted)",
    border: "var(--border-strong)",
  },
};

export default function RoadmapPage() {
  const groups: RoadmapStatus[] = ["in_progress", "planned", "shipped"];
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ maxWidth: "72ch" }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          About
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.015em",
            marginTop: 8,
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          Roadmap
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.05rem", lineHeight: 1.6, maxWidth: "64ch" }}
        >
          The site is built in waves. If you&rsquo;ve probed a route like{" "}
          <code>/ask</code> or <code>/compare</code> and seen a 404, this page
          tells you whether it&rsquo;s coming. Items grouped by status, then
          by gameplan phase.
        </p>
      </div>

      {groups.map((status) => {
        const items = ROADMAP.filter((i) => i.status === status);
        if (items.length === 0) return null;
        const tone = STATUS_TONE[status];
        return (
          <section
            key={status}
            aria-label={STATUS_LABEL[status]}
            style={{ marginTop: 40 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.4rem",
                  letterSpacing: "-0.005em",
                  margin: 0,
                }}
              >
                {STATUS_LABEL[status]}
              </h2>
              <span
                className="muted num"
                style={{ fontSize: "0.85rem" }}
              >
                {items.length}
              </span>
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 12,
              }}
            >
              {items.map((item) => {
                const isPath = item.surface.startsWith("/");
                const isShipped = status === "shipped";
                return (
                  <li
                    key={item.surface}
                    style={{
                      padding: "14px 16px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: tone.bg,
                          color: tone.fg,
                          border: `1px solid ${tone.border}`,
                          fontSize: "0.72rem",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                      <span
                        className="muted"
                        style={{ fontSize: "0.78rem" }}
                      >
                        {item.phase}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.1rem",
                        letterSpacing: "-0.005em",
                        marginBottom: 4,
                      }}
                    >
                      {isShipped && isPath && !item.surface.includes("[") ? (
                        <Link
                          href={item.surface}
                          style={{ color: "var(--text)" }}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </div>
                    {isPath && (
                      <div
                        className="muted num"
                        style={{ fontSize: "0.82rem", marginBottom: 4 }}
                      >
                        {item.surface}
                      </div>
                    )}
                    <p
                      className="muted"
                      style={{
                        fontSize: "0.92rem",
                        lineHeight: 1.55,
                        margin: 0,
                        maxWidth: "68ch",
                      }}
                    >
                      {item.description}
                    </p>
                    {item.trackingUrl && (
                      <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
                        <a
                          href={item.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Tracking issue &rarr;
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div style={{ marginTop: 48 }}>
        <Link href="/about">&larr; Back to About</Link>
      </div>
    </div>
  );
}
