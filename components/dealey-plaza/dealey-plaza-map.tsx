"use client";

import { useMemo, useState } from "react";
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

export function DealeyPlazaMap({ data }: Props) {
  const [selected, setSelected] = useState<DealeyPlazaWitness | null>(null);
  const [activeOrigins, setActiveOrigins] = useState<Set<string>>(
    () => new Set(ORIGINS.map((o) => o.key)),
  );

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
      </div>

      <div className="dp-stage">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label="Schematic map of Dealey Plaza with witness positions"
          className="dp-svg"
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
