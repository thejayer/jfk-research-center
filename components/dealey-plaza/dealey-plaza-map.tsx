"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { DealeyPlazaResponse, DealeyPlazaWitness } from "@/lib/api-types";

/**
 * Schematic SVG of 1963 Dealey Plaza with witness pins.
 *
 * The renderer normalizes WGS84 lat/lng into an SVG viewBox using the
 * bounding box of all witness positions. The schematic itself (motorcade
 * route, TSBD, pergola, stockade fence, triple underpass) is drawn in
 * the same normalized space using anchor points keyed to the same
 * reference coordinates documented at the top of sql/43.
 *
 * Witnesses can be filtered by perceived shot origin via toggleable
 * legend chips. Pin clicks open a side panel with the full statement
 * summary and WC testimony reference. All shot-origin perceptions are
 * shown without color emphasis on any single hypothesis.
 */

type Props = {
  data: DealeyPlazaResponse;
};

const VIEW_W = 1000;
const VIEW_H = 600;

// Schematic anchor coordinates (WGS84). Mirror sql/43 header.
const ANCHORS = {
  tsbd: { lat: 32.77957, lng: -96.80831 },
  pergola: { lat: 32.77931, lng: -96.8087 },
  stockadeFence: { lat: 32.77943, lng: -96.80887 },
  underpass: { lat: 32.77985, lng: -96.8095 },
  z313: { lat: 32.77926, lng: -96.80911 },
  // Endpoints of the motorcade route across the visible plaza
  elmStart: { lat: 32.77956, lng: -96.80796 },
  elmEnd: { lat: 32.77985, lng: -96.80955 },
};

// Origin filter values map to the canonical strings used in the seed.
const ORIGINS: Array<{ key: string; label: string }> = [
  { key: "Texas School Book Depository", label: "TSBD" },
  { key: "Grassy knoll / stockade fence", label: "Grassy knoll" },
  { key: "Triple underpass area", label: "Triple Underpass" },
  { key: "Could not determine", label: "Undetermined" },
];

const INITIAL_VIEWBOX = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
const MIN_W = VIEW_W / 8; // max zoom-in: 8×
const MAX_W = VIEW_W; // max zoom-out: 1× (no zooming past the starting extent)

export function DealeyPlazaMap({ data }: Props) {
  const [selected, setSelected] = useState<DealeyPlazaWitness | null>(null);
  const [activeOrigins, setActiveOrigins] = useState<Set<string>>(
    () => new Set(ORIGINS.map((o) => o.key)),
  );
  const [viewBox, setViewBox] = useState(INITIAL_VIEWBOX);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; vbw: number; vbh: number } | null>(
    null,
  );
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    vbx: number;
    vby: number;
  } | null>(null);

  const screenToView = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h,
    };
  };

  const zoomAround = (cx: number, cy: number, factor: number) => {
    setViewBox((vb) => {
      const newW = Math.max(MIN_W, Math.min(MAX_W, vb.w * factor));
      const newH = newW * (VIEW_H / VIEW_W);
      // Keep (cx, cy) stationary in screen space
      const newX = cx - ((cx - vb.x) * newW) / vb.w;
      const newY = cy - ((cy - vb.y) * newH) / vb.h;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  const zoomButton = (factor: number) => {
    // Zoom around the current viewBox center when using the buttons.
    zoomAround(viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2, factor);
  };

  const resetView = () => setViewBox(INITIAL_VIEWBOX);

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) {
      // Native wheel should scroll the page. Require ctrl/meta to zoom,
      // matching how OS maps and PDFs behave.
      return;
    }
    e.preventDefault();
    const center = screenToView(e.clientX, e.clientY);
    zoomAround(center.x, center.y, e.deltaY > 0 ? 1.15 : 1 / 1.15);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        vbw: viewBox.w,
        vbh: viewBox.h,
      };
      panRef.current = null;
    } else if (pointersRef.current.size === 1) {
      panRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        vbx: viewBox.x,
        vby: viewBox.y,
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = pinchRef.current.dist / dist;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const vbMid = screenToView(midX, midY);
      setViewBox((vb) => {
        const newW = Math.max(
          MIN_W,
          Math.min(MAX_W, pinchRef.current!.vbw * factor),
        );
        const newH = newW * (VIEW_H / VIEW_W);
        const newX = vbMid.x - ((vbMid.x - vb.x) * newW) / vb.w;
        const newY = vbMid.y - ((vbMid.y - vb.y) * newH) / vb.h;
        return { x: newX, y: newY, w: newW, h: newH };
      });
    } else if (panRef.current && pointersRef.current.size === 1) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dxScreen = e.clientX - panRef.current.startX;
      const dyScreen = e.clientY - panRef.current.startY;
      const dxView = (dxScreen / rect.width) * viewBox.w;
      const dyView = (dyScreen / rect.height) * viewBox.h;
      setViewBox((vb) => ({
        ...vb,
        x: panRef.current!.vbx - dxView,
        y: panRef.current!.vby - dyView,
      }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
  };

  const project = useMemo(() => {
    const { minLat, maxLat, minLng, maxLng } = data.bounds;
    const dLat = maxLat - minLat || 1;
    const dLng = maxLng - minLng || 1;
    return (lat: number, lng: number): { x: number; y: number } => {
      // Longitude → x (west = left). Latitude → y (north = up, so invert).
      const x = ((lng - minLng) / dLng) * VIEW_W;
      const y = ((maxLat - lat) / dLat) * VIEW_H;
      return { x, y };
    };
  }, [data.bounds]);

  const visible = data.witnesses.filter(
    (w) =>
      !w.shotOriginPerceived ||
      activeOrigins.has(w.shotOriginPerceived) ||
      // Always include witnesses with a non-canonical origin string so
      // toggling Undetermined doesn't silently drop them.
      !ORIGINS.some((o) => o.key === w.shotOriginPerceived),
  );

  const toggleOrigin = (key: string) => {
    setActiveOrigins((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const a = (lat: number, lng: number) => project(lat, lng);
  const tsbd = a(ANCHORS.tsbd.lat, ANCHORS.tsbd.lng);
  const pergola = a(ANCHORS.pergola.lat, ANCHORS.pergola.lng);
  const fence = a(ANCHORS.stockadeFence.lat, ANCHORS.stockadeFence.lng);
  const underpass = a(ANCHORS.underpass.lat, ANCHORS.underpass.lng);
  const elmStart = a(ANCHORS.elmStart.lat, ANCHORS.elmStart.lng);
  const elmEnd = a(ANCHORS.elmEnd.lat, ANCHORS.elmEnd.lng);

  return (
    <div className="dp-wrap">
      <div className="dp-legend">
        <span className="dp-legend-label">Filter by perceived shot origin:</span>
        {ORIGINS.map((o) => {
          const active = activeOrigins.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggleOrigin(o.key)}
              className={`dp-chip ${active ? "dp-chip-active" : ""}`}
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
        <div
          className="dp-zoom"
          role="group"
          aria-label="Zoom map"
          style={{ marginLeft: "auto", display: "flex", gap: 4 }}
        >
          <button
            type="button"
            className="dp-chip"
            onClick={() => zoomButton(1 / 1.25)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="dp-chip"
            onClick={() => zoomButton(1.25)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="dp-chip"
            onClick={resetView}
            aria-label="Reset map view"
            disabled={
              viewBox.x === INITIAL_VIEWBOX.x &&
              viewBox.y === INITIAL_VIEWBOX.y &&
              viewBox.w === INITIAL_VIEWBOX.w &&
              viewBox.h === INITIAL_VIEWBOX.h
            }
          >
            Reset
          </button>
        </div>
      </div>

      <div className="dp-stage">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          role="img"
          aria-label="Schematic map of Dealey Plaza with witness positions"
          className="dp-svg"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            touchAction: "none",
            cursor: panRef.current ? "grabbing" : "grab",
          }}
        >
          {/* Plaza ground tone */}
          <rect width={VIEW_W} height={VIEW_H} fill="var(--surface)" />

          {/* Triple Underpass */}
          <rect
            x={underpass.x - 80}
            y={underpass.y - 35}
            width={160}
            height={70}
            fill="color-mix(in srgb, var(--text-muted) 20%, transparent)"
            stroke="var(--border-strong)"
            strokeWidth={1.4}
            rx={4}
          />
          <text
            x={underpass.x}
            y={underpass.y + 4}
            textAnchor="middle"
            className="dp-label"
          >
            Triple Underpass
          </text>

          {/* TSBD */}
          <rect
            x={tsbd.x - 36}
            y={tsbd.y - 64}
            width={72}
            height={64}
            fill="color-mix(in srgb, var(--accent) 14%, transparent)"
            stroke="var(--accent)"
            strokeWidth={1.4}
            rx={2}
          />
          <text x={tsbd.x} y={tsbd.y - 28} textAnchor="middle" className="dp-label">
            TSBD
          </text>
          <text x={tsbd.x} y={tsbd.y - 14} textAnchor="middle" className="dp-label-sub">
            6th-floor
          </text>

          {/* Pergola */}
          <rect
            x={pergola.x - 30}
            y={pergola.y - 16}
            width={60}
            height={32}
            fill="color-mix(in srgb, var(--text-muted) 20%, transparent)"
            stroke="var(--border-strong)"
            strokeWidth={1}
            rx={3}
          />
          <text x={pergola.x} y={pergola.y + 4} textAnchor="middle" className="dp-label">
            Pergola
          </text>

          {/* Stockade fence (grassy knoll) — short dash row */}
          <line
            x1={fence.x - 60}
            y1={fence.y}
            x2={fence.x + 30}
            y2={fence.y}
            stroke="var(--text)"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <text
            x={fence.x - 12}
            y={fence.y - 8}
            textAnchor="middle"
            className="dp-label-sub"
          >
            Stockade fence (grassy knoll)
          </text>

          {/* Motorcade route along Elm Street */}
          <line
            x1={elmStart.x}
            y1={elmStart.y + 8}
            x2={elmEnd.x}
            y2={elmEnd.y + 8}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="4 4"
            opacity={0.7}
          />
          <text
            x={(elmStart.x + elmEnd.x) / 2}
            y={(elmStart.y + elmEnd.y) / 2 + 22}
            textAnchor="middle"
            className="dp-label-sub"
          >
            Elm Street motorcade route →
          </text>

          {/* Witness pins */}
          {visible.map((w) => {
            const { x, y } = project(w.positionLat, w.positionLng);
            const tone = pinTone(w.shotOriginPerceived);
            const isSelected = selected?.witnessId === w.witnessId;
            return (
              <g
                key={w.witnessId}
                transform={`translate(${x}, ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`${w.name} — ${w.positionDescription}`}
                onClick={() => setSelected(w)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(w);
                  }
                }}
                className="dp-pin"
              >
                <circle
                  r={isSelected ? 9 : 6}
                  fill={tone}
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
                {isSelected && (
                  <circle
                    r={14}
                    fill="none"
                    stroke={tone}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dp-disclaimer">
        Witness positions are plotted from each witness&rsquo;s own
        statement. The map shows where they said they were; it does not
        establish where anyone in fact was. All reported shot origins —
        including the grassy knoll — are shown without color emphasis on
        any single hypothesis.
      </div>

      {selected && (
        <aside
          className="dp-panel"
          role="region"
          aria-label={`Witness statement: ${selected.name}`}
        >
          <button
            type="button"
            className="dp-panel-close"
            onClick={() => setSelected(null)}
            aria-label="Close witness panel"
          >
            ✕
          </button>
          <div className="dp-panel-eyebrow">Witness</div>
          <h3 className="dp-panel-name">{selected.name}</h3>
          {selected.role && (
            <div className="dp-panel-role">{selected.role}</div>
          )}
          <div className="dp-panel-position">
            {selected.positionDescription}
          </div>
          <p className="dp-panel-summary">{selected.statementSummary}</p>
          <dl className="dp-panel-meta">
            {typeof selected.heardShots === "number" && (
              <>
                <dt>Shots reported</dt>
                <dd>{selected.heardShots}</dd>
              </>
            )}
            {selected.shotOriginPerceived && (
              <>
                <dt>Perceived origin</dt>
                <dd>{selected.shotOriginPerceived}</dd>
              </>
            )}
            {typeof selected.wcTestimonyVolume === "number" &&
              typeof selected.wcTestimonyPage === "number" && (
                <>
                  <dt>WC testimony</dt>
                  <dd>
                    Vol. {selected.wcTestimonyVolume}, p.{" "}
                    {selected.wcTestimonyPage}
                  </dd>
                </>
              )}
          </dl>
        </aside>
      )}
    </div>
  );
}

function pinTone(origin: string | null): string {
  // Neutral palette — distinguishable enough for accessibility but
  // intentionally muted so no single perception visually dominates.
  switch (origin) {
    case "Texas School Book Depository":
      return "var(--accent)";
    case "Grassy knoll / stockade fence":
      return "#b45309";
    case "Triple underpass area":
      return "#0e7490";
    default:
      return "var(--text-muted)";
  }
}
