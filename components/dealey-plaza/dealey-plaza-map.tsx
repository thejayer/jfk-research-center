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

type SortKey = "name" | "area" | "origin";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "area", label: "Map area" },
  { key: "origin", label: "Perceived origin" },
];

const INITIAL_VIEWBOX = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
const MIN_W = VIEW_W / 8; // max zoom-in: 8×
const MAX_W = VIEW_W; // max zoom-out: 1× (no zooming past the starting extent)

export function DealeyPlazaMap({ data }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeWitnessId, setActiveWitnessId] = useState<string | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [activeOrigins, setActiveOrigins] = useState<Set<string>>(
    () => allOriginSet(),
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

  const originCounts = useMemo(() => {
    const counts = new Map<string, number>(ORIGINS.map((origin) => [origin.key, 0]));
    for (const witness of data.witnesses) {
      const key = originFilterKey(witness.shotOriginPerceived);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data.witnesses]);

  const visibleWitnesses = useMemo(
    () =>
      data.witnesses
        .filter((witness) => activeOrigins.has(originFilterKey(witness.shotOriginPerceived)))
        .sort((a, b) => compareWitnesses(a, b, sortKey)),
    [activeOrigins, data.witnesses, sortKey],
  );

  const visibleWitnessIds = useMemo(
    () => new Set(visibleWitnesses.map((witness) => witness.witnessId)),
    [visibleWitnesses],
  );

  const previewWitnessIds = useMemo(() => {
    if (!previewOrigin) return null;
    return new Set(
      data.witnesses
        .filter((witness) => originFilterKey(witness.shotOriginPerceived) === previewOrigin)
        .map((witness) => witness.witnessId),
    );
  }, [data.witnesses, previewOrigin]);

  const selected = useMemo(
    () => data.witnesses.find((witness) => witness.witnessId === selectedId) ?? null,
    [data.witnesses, selectedId],
  );

  const activeSummary = filterSummary(
    visibleWitnesses.length,
    data.witnesses.length,
    activeOrigins,
  );

  const toggleOrigin = (key: string) => {
    setActiveOrigins((s) => {
      if (s.size === ORIGINS.length) return new Set([key]);
      if (s.size === 1 && s.has(key)) return allOriginSet();
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showAllOrigins = () => {
    setActiveOrigins(allOriginSet());
    setPreviewOrigin(null);
  };

  const selectWitness = (witness: DealeyPlazaWitness) => {
    setSelectedId(witness.witnessId);
    setActiveWitnessId(witness.witnessId);
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
      <div className="dp-toolbar">
        <div className="dp-filter-group" role="group" aria-label="Perceived shot-origin filters">
        <span className="dp-legend-label">Perceived shot origin</span>
        {ORIGINS.map((o) => {
          const active = activeOrigins.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggleOrigin(o.key)}
              onFocus={() => setPreviewOrigin(o.key)}
              onBlur={() => setPreviewOrigin(null)}
              onPointerEnter={() => setPreviewOrigin(o.key)}
              onPointerLeave={() => setPreviewOrigin(null)}
              className={`dp-chip ${active ? "dp-chip-active" : ""}`}
              aria-pressed={active}
            >
              <span
                className="dp-origin-swatch"
                style={{ background: pinTone(o.key) }}
                aria-hidden="true"
              />
              <span>{o.label}</span>
              <span className="dp-chip-count">{originCounts.get(o.key) ?? 0}</span>
            </button>
          );
        })}
        </div>
        <div className="dp-toolbar-actions">
          <button
            type="button"
            className="dp-chip"
            onClick={showAllOrigins}
            disabled={activeOrigins.size === ORIGINS.length}
          >
            Show all
          </button>
        <div
          className="dp-zoom"
          role="group"
          aria-label="Zoom map"
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
      </div>

      <div className="dp-active-summary" aria-live="polite">
        {activeSummary}
      </div>

      <div className="dp-stage">
        <svg
          id="dealey-plaza-map"
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          role="group"
          aria-label="Schematic map of Dealey Plaza with interactive witness pins"
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
          {data.witnesses.map((w) => {
            const { x, y } = project(w.positionLat, w.positionLng);
            const tone = pinTone(w.shotOriginPerceived);
            const isSelected = selectedId === w.witnessId;
            const isVisible = visibleWitnessIds.has(w.witnessId);
            const isPreviewMuted =
              previewWitnessIds != null && !previewWitnessIds.has(w.witnessId);
            const isDimmed = !isVisible || isPreviewMuted;
            const isActive = activeWitnessId === w.witnessId;
            const isAccessible = isVisible && !isPreviewMuted;
            return (
              <g
                key={w.witnessId}
                transform={`translate(${x}, ${y})`}
                role={isAccessible ? "button" : undefined}
                tabIndex={isAccessible ? 0 : -1}
                aria-label={isAccessible ? `${w.name}: ${w.positionDescription}` : undefined}
                aria-disabled={isAccessible ? undefined : true}
                aria-hidden={isAccessible ? undefined : true}
                aria-describedby={isAccessible ? `dp-pin-desc-${w.witnessId}` : undefined}
                onClick={() => {
                  if (isVisible) selectWitness(w);
                }}
                onFocus={() => {
                  if (isVisible) setActiveWitnessId(w.witnessId);
                }}
                onBlur={() => setActiveWitnessId(null)}
                onPointerEnter={() => {
                  if (isVisible) setActiveWitnessId(w.witnessId);
                }}
                onPointerLeave={() => setActiveWitnessId(null)}
                onKeyDown={(e) => {
                  if (isVisible && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    selectWitness(w);
                  }
                }}
                className={`dp-pin ${isSelected ? "dp-pin-selected" : ""} ${isActive ? "dp-pin-active" : ""} ${isDimmed ? "dp-pin-dimmed" : ""}`}
              >
                <desc id={`dp-pin-desc-${w.witnessId}`}>
                  Perceived shot origin: {originDisplayLabel(w.shotOriginPerceived)}.
                </desc>
                <circle
                  r={isSelected || isActive ? 9 : 6}
                  fill={tone}
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
                {(isSelected || isActive) && (
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

      {selected && (
        <aside
          className="dp-panel"
          role="region"
          aria-label={`Witness statement: ${selected.name}`}
        >
          <WitnessDetailCard witness={selected} onClose={() => setSelectedId(null)} />
        </aside>
      )}

      <section className="dp-witness-list" aria-labelledby="dp-witness-list-title">
        <div className="dp-witness-list-head">
          <div>
            <h2 id="dp-witness-list-title" className="dp-witness-list-title">
              Witness index
            </h2>
            <p className="dp-witness-list-copy">
              Browse the same plotted witnesses without relying on the schematic.
            </p>
          </div>
          <label className="dp-sort-label">
            <span>Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="dp-sort-select"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visibleWitnesses.length > 0 ? (
          <div className="dp-witness-rows" role="list">
            {visibleWitnesses.map((witness) => {
              const isSelected = selectedId === witness.witnessId;
              const isActive = activeWitnessId === witness.witnessId;
              const isPreviewed =
                previewWitnessIds != null && previewWitnessIds.has(witness.witnessId);
              return (
                <div key={witness.witnessId} role="listitem">
                  <button
                    type="button"
                    className={`dp-witness-row ${isSelected ? "dp-witness-row-selected" : ""} ${isActive || isPreviewed ? "dp-witness-row-active" : ""}`}
                    onClick={() => selectWitness(witness)}
                    onFocus={() => setActiveWitnessId(witness.witnessId)}
                    onBlur={() => setActiveWitnessId(null)}
                    onPointerEnter={() => setActiveWitnessId(witness.witnessId)}
                    onPointerLeave={() => setActiveWitnessId(null)}
                    aria-pressed={isSelected}
                  >
                    <span className="dp-witness-row-main">
                      <span className="dp-witness-row-name">{witness.name}</span>
                      <span className="dp-witness-row-position">
                        {witness.positionDescription}
                      </span>
                    </span>
                    <span className="dp-witness-row-meta">
                      <span>{originDisplayLabel(witness.shotOriginPerceived)}</span>
                      <span>{shotCountLabel(witness.heardShots)}</span>
                      <span>{testimonyLabel(witness)}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dp-witness-empty">
            No witnesses match the active origin filters. Use Show all to restore the
            full index.
          </div>
        )}
      </section>

      <div className="dp-disclaimer">
        Witness positions are plotted from each witness&rsquo;s own
        statement. The map shows where they said they were; it does not
        establish where anyone in fact was. All reported shot origins —
        including the grassy knoll — are shown without color emphasis on
        any single hypothesis.
      </div>

    </div>
  );
}

function WitnessDetailCard({
  witness,
  onClose,
}: {
  witness: DealeyPlazaWitness;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="dp-panel-close"
        onClick={onClose}
        aria-label="Close witness panel"
      >
        x
      </button>
      <div className="dp-panel-eyebrow">Witness detail</div>
      <h3 className="dp-panel-name">{witness.name}</h3>
      {witness.role && <div className="dp-panel-role">{witness.role}</div>}
      <div className="dp-panel-position">{witness.positionDescription}</div>
      <p className="dp-panel-summary">{witness.statementSummary}</p>
      <dl className="dp-panel-meta">
        <dt>Perceived origin</dt>
        <dd>{originDisplayLabel(witness.shotOriginPerceived)}</dd>
        <dt>Shots reported</dt>
        <dd>{shotCountLabel(witness.heardShots)}</dd>
        <dt>Position confidence</dt>
        <dd>Approximate; plotted from the witness statement.</dd>
        <dt>Source reference</dt>
        <dd>{sourceReference(witness)}</dd>
      </dl>
    </>
  );
}

function allOriginSet(): Set<string> {
  return new Set(ORIGINS.map((origin) => origin.key));
}

function compareWitnesses(
  a: DealeyPlazaWitness,
  b: DealeyPlazaWitness,
  sortKey: SortKey,
): number {
  if (sortKey === "area") {
    return (
      a.positionDescription.localeCompare(b.positionDescription) ||
      a.name.localeCompare(b.name)
    );
  }
  if (sortKey === "origin") {
    return (
      originDisplayLabel(a.shotOriginPerceived).localeCompare(
        originDisplayLabel(b.shotOriginPerceived),
      ) || a.name.localeCompare(b.name)
    );
  }
  return a.name.localeCompare(b.name);
}

function filterSummary(
  visibleCount: number,
  totalCount: number,
  activeOrigins: Set<string>,
): string {
  if (visibleCount === totalCount) {
    return `Showing all ${totalCount} witnesses.`;
  }
  const labels = ORIGINS.filter((origin) => activeOrigins.has(origin.key)).map(
    (origin) => origin.label,
  );
  if (labels.length === 1) {
    return `Showing ${visibleCount} witnesses who perceived shots from ${labels[0]}.`;
  }
  if (labels.length === 0) {
    return "No perceived-origin filters are active.";
  }
  return `Showing ${visibleCount} witnesses across ${labels.length} selected origin groups.`;
}

function originFilterKey(origin: string | null): string {
  return origin && ORIGINS.some((item) => item.key === origin)
    ? origin
    : "Could not determine";
}

function originDisplayLabel(origin: string | null): string {
  const key = originFilterKey(origin);
  return ORIGINS.find((item) => item.key === key)?.label ?? "Undetermined";
}

function shotCountLabel(value: number | null): string {
  if (typeof value !== "number") return "Shots not specified";
  return value === 1 ? "1 shot" : `${value} shots`;
}

function testimonyLabel(witness: DealeyPlazaWitness): string {
  if (
    typeof witness.wcTestimonyVolume === "number" &&
    typeof witness.wcTestimonyPage === "number"
  ) {
    return `WC Vol. ${witness.wcTestimonyVolume}, p. ${witness.wcTestimonyPage}`;
  }
  return "Source reference pending";
}

function sourceReference(witness: DealeyPlazaWitness): string {
  const testimony = testimonyLabel(witness);
  if (witness.sourceNaids.length === 0) return testimony;
  return `${testimony}; NAID ${witness.sourceNaids.join(", ")}`;
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
