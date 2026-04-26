"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { scaleTime } from "d3-scale";
import {
  zoom as d3zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition"; // augments selection with .transition()
import {
  timeYear,
  timeMonth,
  timeHour,
} from "d3-time";
import type {
  CaseTimelineCategory,
  CaseTimelineEvent,
  CaseTimelineIndex,
} from "@/lib/api-types";
import { EventCard } from "./event-card";

const VIEW_W = 1200;
const VIEW_H = 360;
const MARGIN = { top: 28, right: 24, bottom: 36, left: 24 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

const CATEGORIES: ReadonlyArray<{
  value: CaseTimelineCategory;
  label: string;
}> = [
  { value: "biographical", label: "Biographical" },
  { value: "operational", label: "Operational" },
  { value: "investigation", label: "Investigation" },
  { value: "release", label: "Release" },
  { value: "death", label: "Death" },
];

const CATEGORY_LANE: Record<CaseTimelineCategory, number> = {
  biographical: 0,
  operational: 1,
  investigation: 2,
  release: 3,
  death: 4,
};

// Stop colors aren't used directly — we render with currentColor against
// per-category opacity to stay theme-friendly.
const CATEGORY_STYLE: Record<
  CaseTimelineCategory,
  { fill: string; stroke: string }
> = {
  biographical: { fill: "var(--text)", stroke: "var(--text)" },
  operational: { fill: "var(--text)", stroke: "var(--text)" },
  investigation: { fill: "var(--text-muted)", stroke: "var(--text-muted)" },
  release: { fill: "var(--text-muted)", stroke: "var(--text-muted)" },
  death: { fill: "var(--accent, #c44)", stroke: "var(--accent, #c44)" },
};

type ZoomLevel = "decade" | "year" | "day" | "hour";

const MARQUEE_START = new Date(Date.UTC(1963, 10, 22, 0, 0)); // Nov 22 1963
const MARQUEE_END = new Date(Date.UTC(1963, 10, 25, 23, 59)); // Nov 25 1963

function levelFor(k: number): ZoomLevel {
  if (k < 4) return "decade";
  if (k < 30) return "year";
  if (k < 250) return "day";
  return "hour";
}

function parseEventDate(e: CaseTimelineEvent): Date {
  // Date is "YYYY-MM-DD"; timeLocal (when present) is "HH:MM" local.
  const [y, m, d] = e.date.split("-").map((s) => parseInt(s, 10));
  if (e.timeLocal) {
    const [hh, mm] = e.timeLocal.split(":").map((s) => parseInt(s, 10));
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0));
  }
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatTickLabel(d: Date, level: ZoomLevel): string {
  switch (level) {
    case "decade":
      return String(d.getUTCFullYear());
    case "year":
      return String(d.getUTCFullYear());
    case "day":
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    case "hour":
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        timeZone: "UTC",
      });
  }
}

function ticksFor(
  domain: [Date, Date],
  level: ZoomLevel,
  width: number,
): Date[] {
  const targetCount = Math.max(4, Math.min(12, Math.floor(width / 110)));
  const [start, end] = domain;
  switch (level) {
    case "decade":
      return timeYear.every(10)?.range(start, end) ?? [];
    case "year":
      return timeYear.range(start, end, Math.max(1, Math.floor((end.getUTCFullYear() - start.getUTCFullYear()) / targetCount)));
    case "day":
      return timeMonth.range(start, end);
    case "hour":
      return timeHour.range(start, end, 6);
  }
}

const HEADLINE_THRESHOLD = 5;

// State serialized into the URL hash (e.g. #event-foo) and query (?center=...&zoom=...).
type ZoomState = {
  k: number;
  centerDate: Date;
};

function transformFromState(
  state: ZoomState,
  baseScale: ReturnType<typeof scaleTime>,
): ZoomTransform {
  const cx = Number(baseScale(state.centerDate));
  const targetCx = MARGIN.left + PLOT_W / 2;
  return zoomIdentity
    .translate(targetCx - cx * state.k, 0)
    .scale(state.k);
}

export function ZoomableTimeline({ data }: { data: CaseTimelineIndex }) {
  const events = useMemo(
    () =>
      data.events.map((e) => ({
        ...e,
        _t: parseEventDate(e),
      })),
    [data.events],
  );

  const domainStart = useMemo(() => {
    const min = events.reduce(
      (acc, e) => (e._t < acc ? e._t : acc),
      events[0]?._t ?? new Date(Date.UTC(1939, 0, 1)),
    );
    return timeYear.floor(min);
  }, [events]);
  const domainEnd = useMemo(() => {
    const max = events.reduce(
      (acc, e) => (e._t > acc ? e._t : acc),
      events[0]?._t ?? new Date(),
    );
    return timeYear.ceil(timeYear.offset(max, 1));
  }, [events]);

  const baseScale = useMemo(
    () =>
      scaleTime()
        .domain([domainStart, domainEnd])
        .range([MARGIN.left, MARGIN.left + PLOT_W]),
    [domainStart, domainEnd],
  );

  const [activeCategories, setActiveCategories] = useState<
    Set<CaseTimelineCategory>
  >(() => new Set(CATEGORIES.map((c) => c.value)));

  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Initialize d3-zoom on the svg element.
  useEffect(() => {
    if (!svgRef.current) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12000])
      .translateExtent([
        [MARGIN.left, 0],
        [MARGIN.left + PLOT_W, VIEW_H],
      ])
      .extent([
        [MARGIN.left, 0],
        [MARGIN.left + PLOT_W, VIEW_H],
      ])
      .filter((event) => {
        // Allow wheel + touch + drag, but not double-click (we want dblclick to focus events).
        if (event.type === "dblclick") return false;
        return !event.button;
      })
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
    zoomRef.current = z;
    select(svgRef.current).call(z);
    return () => {
      select(svgRef.current!).on(".zoom", null);
    };
  }, []);

  // Apply zoom to the svg's stored transform when our state-driven transform
  // diverges from d3-zoom's internal one (e.g. on programmatic zoomTo).
  const applyTransform = useCallback((t: ZoomTransform) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(zoomRef.current.transform, t);
  }, []);

  const zoomToEvent = useCallback(
    (e: CaseTimelineEvent & { _t: Date }) => {
      // Pick a level appropriate for this event's resolution (hour if timeLocal, else day).
      const k = e.timeLocal ? 600 : 90;
      const t = transformFromState({ k, centerDate: e._t }, baseScale);
      applyTransform(t);
      setSelectedId(e.id);
    },
    [applyTransform, baseScale],
  );

  const zoomToMarquee = useCallback(() => {
    const center = new Date(
      (MARQUEE_START.getTime() + MARQUEE_END.getTime()) / 2,
    );
    const t = transformFromState({ k: 800, centerDate: center }, baseScale);
    applyTransform(t);
  }, [applyTransform, baseScale]);

  const resetZoom = useCallback(() => {
    applyTransform(zoomIdentity);
    setSelectedId(null);
  }, [applyTransform]);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!svgRef.current || !zoomRef.current) return;
      select(svgRef.current)
        .transition()
        .duration(180)
        .call(zoomRef.current.scaleBy, factor);
    },
    [],
  );

  const panBy = useCallback(
    (dx: number) => {
      if (!svgRef.current || !zoomRef.current) return;
      select(svgRef.current)
        .transition()
        .duration(180)
        .call(zoomRef.current.translateBy, dx, 0);
    },
    [],
  );

  // Hash → zoom-to-event on initial load and on subsequent hash changes.
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const ev = events.find((e) => e.id === hash);
      if (ev) zoomToEvent(ev);
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [events, zoomToEvent]);

  // Keyboard shortcuts on the timeline container.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!el.contains(document.activeElement)) return;
      switch (ev.key) {
        case "+":
        case "=":
          ev.preventDefault();
          zoomBy(1.5);
          break;
        case "-":
        case "_":
          ev.preventDefault();
          zoomBy(1 / 1.5);
          break;
        case "ArrowLeft":
          ev.preventDefault();
          panBy(60);
          break;
        case "ArrowRight":
          ev.preventDefault();
          panBy(-60);
          break;
        case "0":
          ev.preventDefault();
          resetZoom();
          break;
        case "Escape":
          if (selectedId) {
            ev.preventDefault();
            setSelectedId(null);
          }
          break;
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [zoomBy, panBy, resetZoom, selectedId]);

  const xScale = useMemo(
    () => transform.rescaleX(baseScale),
    [transform, baseScale],
  );

  const level = levelFor(transform.k);
  const visibleDomain: [Date, Date] = [
    xScale.invert(MARGIN.left) as Date,
    xScale.invert(MARGIN.left + PLOT_W) as Date,
  ];
  const ticks = ticksFor(visibleDomain, level, PLOT_W);

  const visibleEvents = events.filter((e) => {
    if (!activeCategories.has(e.category)) return false;
    return e._t >= visibleDomain[0] && e._t <= visibleDomain[1];
  });

  const selectedEvent = selectedId
    ? events.find((e) => e.id === selectedId)
    : null;

  const toggleCategory = (c: CaseTimelineCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const showLabels = level === "day" || level === "hour";

  // Marquee window x-positions in plot space (clipped if off-screen).
  const marqueeX1 = xScale(MARQUEE_START);
  const marqueeX2 = xScale(MARQUEE_END);

  return (
    <div
      ref={containerRef}
      style={{ outline: "none", marginBottom: 28 }}
      tabIndex={-1}
    >
      <Toolbar
        level={level}
        activeCategories={activeCategories}
        toggleCategory={toggleCategory}
        onZoomIn={() => zoomBy(1.5)}
        onZoomOut={() => zoomBy(1 / 1.5)}
        onReset={resetZoom}
        onMarquee={zoomToMarquee}
        countByCategory={countCategories(events)}
      />

      <div
        style={{
          position: "relative",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label="Zoomable JFK case timeline"
          tabIndex={0}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <defs>
            <clipPath id="timeline-plot-clip">
              <rect
                x={MARGIN.left}
                y={0}
                width={PLOT_W}
                height={VIEW_H}
              />
            </clipPath>
          </defs>

          {/* Axis baseline */}
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + PLOT_W}
            y1={VIEW_H - MARGIN.bottom}
            y2={VIEW_H - MARGIN.bottom}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />

          {/* Tick lines + labels */}
          <g clipPath="url(#timeline-plot-clip)">
            {ticks.map((t) => {
              const x = xScale(t);
              return (
                <g key={t.getTime()}>
                  <line
                    x1={x}
                    x2={x}
                    y1={MARGIN.top}
                    y2={VIEW_H - MARGIN.bottom}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    opacity={0.55}
                  />
                </g>
              );
            })}
          </g>
          {ticks.map((t) => {
            const x = xScale(t);
            if (x < MARGIN.left - 30 || x > MARGIN.left + PLOT_W + 30) return null;
            return (
              <text
                key={`lbl-${t.getTime()}`}
                x={x}
                y={VIEW_H - MARGIN.bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-muted)"
                style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
              >
                {formatTickLabel(t, level)}
              </text>
            );
          })}

          {/* Marquee window highlight */}
          {marqueeX2 > MARGIN.left && marqueeX1 < MARGIN.left + PLOT_W && (
            <g clipPath="url(#timeline-plot-clip)">
              <rect
                x={Math.max(marqueeX1, MARGIN.left)}
                y={MARGIN.top}
                width={Math.max(
                  1.5,
                  Math.min(marqueeX2, MARGIN.left + PLOT_W) -
                    Math.max(marqueeX1, MARGIN.left),
                )}
                height={PLOT_H}
                fill="var(--text)"
                opacity={0.06}
              />
            </g>
          )}

          {/* Category lane labels (visible at year+ level) */}
          {level !== "decade" &&
            CATEGORIES.map((c, i) => {
              if (!activeCategories.has(c.value)) return null;
              const y = laneY(i);
              return (
                <text
                  key={`lane-${c.value}`}
                  x={MARGIN.left + 4}
                  y={y - 10}
                  fontSize={9}
                  fill="var(--text-muted)"
                  style={{
                    fontFamily: "var(--font-mono, ui-monospace)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {c.label}
                </text>
              );
            })}

          {/* Event marks */}
          <g clipPath="url(#timeline-plot-clip)">
            {visibleEvents.map((e) => {
              const x = xScale(e._t);
              const lane = level === "decade" ? -1 : CATEGORY_LANE[e.category];
              const y = lane === -1 ? VIEW_H - MARGIN.bottom - 14 : laneY(lane);
              const isHeadline = e.importance >= HEADLINE_THRESHOLD;
              const r = isHeadline ? 5.5 : 3.5;
              const isHovered = hoveredId === e.id;
              const isSelected = selectedId === e.id;
              const style = CATEGORY_STYLE[e.category];
              return (
                <g
                  key={e.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredId(e.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    setSelectedId(e.id);
                    window.history.replaceState({}, "", `#${e.id}`);
                  }}
                >
                  <circle
                    r={isHovered || isSelected ? r + 2 : r}
                    fill={style.fill}
                    fillOpacity={
                      isSelected ? 1 : isHovered ? 0.95 : isHeadline ? 0.85 : 0.65
                    }
                    stroke={isSelected ? "var(--bg)" : "transparent"}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  {isHeadline && (
                    <circle
                      r={r + 4}
                      fill="none"
                      stroke={style.stroke}
                      strokeWidth={0.75}
                      opacity={0.45}
                    />
                  )}
                  {showLabels && (isHeadline || isHovered || isSelected) && (
                    <text
                      x={0}
                      y={-r - 6}
                      fontSize={10.5}
                      textAnchor="middle"
                      fill="var(--text)"
                      style={{
                        fontFamily: "var(--font-serif)",
                        pointerEvents: "none",
                        paintOrder: "stroke",
                        stroke: "var(--surface)",
                        strokeWidth: 3,
                        strokeLinejoin: "round",
                      }}
                    >
                      {truncate(e.title, level === "hour" ? 42 : 30)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Hover tooltip */}
          {hoveredId &&
            !selectedId &&
            (() => {
              const e = events.find((x) => x.id === hoveredId);
              if (!e) return null;
              const x = xScale(e._t);
              const tx = Math.max(
                MARGIN.left + 80,
                Math.min(MARGIN.left + PLOT_W - 80, x),
              );
              return (
                <g pointerEvents="none">
                  <rect
                    x={tx - 110}
                    y={MARGIN.top - 4}
                    width={220}
                    height={28}
                    rx={4}
                    fill="var(--surface)"
                    stroke="var(--border-strong)"
                  />
                  <text
                    x={tx}
                    y={MARGIN.top + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--text)"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {truncate(e.title, 36)}
                  </text>
                </g>
              );
            })()}
        </svg>

        <ZoomLevelBadge level={level} />
      </div>

      <Legend visible={visibleEvents.length} total={events.length} />

      {/* Selected-event side panel */}
      {selectedEvent && (
        <SidePanel onClose={() => setSelectedId(null)}>
          <EventCard event={selectedEvent} as="article" showPermalink />
        </SidePanel>
      )}

      {/* Screen-reader mirror — list of currently visible events */}
      <ol
        aria-label="Currently visible timeline events"
        style={srOnlyStyle}
      >
        {visibleEvents.map((e) => (
          <li key={e.id}>
            {e.date} {e.timeLocal ?? ""} — {e.title}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Toolbar({
  level,
  activeCategories,
  toggleCategory,
  onZoomIn,
  onZoomOut,
  onReset,
  onMarquee,
  countByCategory,
}: {
  level: ZoomLevel;
  activeCategories: Set<CaseTimelineCategory>;
  toggleCategory: (c: CaseTimelineCategory) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onMarquee: () => void;
  countByCategory: Record<CaseTimelineCategory, number>;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div
        role="group"
        aria-label="Filter by category"
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
      >
        {CATEGORIES.map((c) => {
          const on = activeCategories.has(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleCategory(c.value)}
              aria-pressed={on}
              style={{
                padding: "5px 10px",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontFamily: "inherit",
                cursor: "pointer",
                background: on ? "var(--text)" : "transparent",
                color: on ? "var(--bg)" : "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {c.label} · {countByCategory[c.value] ?? 0}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span
          className="num"
          style={{
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginRight: 4,
          }}
        >
          {level}
        </span>
        <ToolbarButton onClick={onMarquee} title="Zoom into Nov 22–25, 1963">
          72h Dallas
        </ToolbarButton>
        <ToolbarButton onClick={onZoomOut} title="Zoom out (−)">
          −
        </ToolbarButton>
        <ToolbarButton onClick={onZoomIn} title="Zoom in (+)">
          +
        </ToolbarButton>
        <ToolbarButton onClick={onReset} title="Reset zoom (0)">
          ⊙
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "5px 10px",
        minWidth: 30,
        border: "1px solid var(--border-strong)",
        borderRadius: 6,
        background: "transparent",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: "0.78rem",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ZoomLevelBadge({ level }: { level: ZoomLevel }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 8,
        left: 12,
        fontSize: "0.68rem",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontFamily: "var(--font-mono, ui-monospace)",
      }}
    >
      {level} view
    </div>
  );
}

function Legend({ visible, total }: { visible: number; total: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        fontSize: "0.74rem",
        color: "var(--text-muted)",
        marginTop: 8,
      }}
    >
      <span>
        Showing {visible} of {total} events in view
      </span>
      <span aria-hidden="true">·</span>
      <span>Scroll / pinch to zoom · drag to pan · ★ = headline</span>
      <span aria-hidden="true">·</span>
      <span>Keys: + − ← → 0</span>
    </div>
  );
}

function SidePanel({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Selected timeline event"
      style={{
        position: "fixed",
        right: 0,
        top: "var(--header-height, 64px)",
        bottom: 0,
        width: "min(440px, 96vw)",
        zIndex: 60,
        background: "var(--bg)",
        borderLeft: "1px solid var(--border-strong)",
        boxShadow: "0 0 24px rgba(0,0,0,0.18)",
        padding: 18,
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close event details"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            background: "transparent",
            padding: "4px 10px",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "var(--text)",
          }}
        >
          Close ✕
        </button>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function laneY(i: number) {
  const lanes = CATEGORIES.length;
  const usable = PLOT_H - 24;
  const step = usable / lanes;
  return MARGIN.top + 12 + step * (i + 0.5);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function countCategories(
  events: ReadonlyArray<CaseTimelineEvent>,
): Record<CaseTimelineCategory, number> {
  const out: Record<CaseTimelineCategory, number> = {
    biographical: 0,
    operational: 0,
    investigation: 0,
    release: 0,
    death: 0,
  };
  for (const e of events) out[e.category] += 1;
  return out;
}

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
