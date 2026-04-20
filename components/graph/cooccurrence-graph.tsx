"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { CooccurrenceGraph } from "@/lib/api-types";

type SimNode = SimulationNodeDatum & {
  id: string;
  name: string;
  type: "person" | "org" | "place" | "concept";
  degree: number;
};

type SimLink = SimulationLinkDatum<SimNode> & {
  source: string | SimNode;
  target: string | SimNode;
  count: number;
};

const VIEW_W = 960;
const VIEW_H = 640;

export function CooccurrenceGraphViz({ initial }: { initial: CooccurrenceGraph }) {
  const [graph, setGraph] = useState(initial);
  const [yearFrom, setYearFrom] = useState(initial.appliedRange.yearFrom);
  const [yearTo, setYearTo] = useState(initial.appliedRange.yearTo);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const [, forceRender] = useState(0);

  const { min, max } = initial.yearBounds;

  useEffect(() => {
    const nodes: SimNode[] = graph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      degree: n.degree,
    }));
    const links: SimLink[] = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      count: l.count,
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    simRef.current?.stop();
    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => 60 + 80 / Math.max(1, l.count))
          .strength((l) => Math.min(1, 0.05 + Math.log(1 + l.count) / 10)),
      )
      .force("charge", forceManyBody<SimNode>().strength(-320))
      .force("center", forceCenter<SimNode>(VIEW_W / 2, VIEW_H / 2))
      .force(
        "collide",
        // Collide radius includes enough room for the label to the south of
        // the node. Labels run ~6.5 px per char at fontSize 12; cap the
        // contribution so very long names don't push everyone apart.
        forceCollide<SimNode>((d) =>
          Math.max(
            nodeRadius(d.degree) + 4,
            Math.min(120, d.name.length * 3.5),
          ),
        ),
      )
      .on("tick", () => {
        forceRender((t) => t + 1);
      });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [graph]);

  const commit = useCallback(
    async (nextFrom: number, nextTo: number) => {
      const lo = Math.min(nextFrom, nextTo);
      const hi = Math.max(nextFrom, nextTo);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/graph?yearFrom=${lo}&yearTo=${hi}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as CooccurrenceGraph;
        setGraph(data);
      } catch (err) {
        console.error("Graph refetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const maxCount = useMemo(
    () =>
      Math.max(
        1,
        ...graph.links.map((l) => l.count),
      ),
    [graph.links],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of nodesRef.current) m.set(n.id, n);
    return m;
  }, [graph]);

  const connectedPeerIds = useMemo(() => {
    if (!hovered) return null;
    const peers = new Set<string>([hovered]);
    for (const l of graph.links) {
      const s = typeof l.source === "string" ? l.source : l.source;
      const t = typeof l.target === "string" ? l.target : l.target;
      if (s === hovered) peers.add(t);
      if (t === hovered) peers.add(s);
    }
    return peers;
  }, [hovered, graph.links]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div className="graph-range-wrap" style={{ flex: "1 1 260px" }}>
          <label
            className="eyebrow"
            style={{ display: "block", marginBottom: 6 }}
          >
            Event date range
          </label>
          <div
            className="num"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.1rem",
              marginBottom: 4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.min(yearFrom, yearTo)} – {Math.max(yearFrom, yearTo)}
          </div>
          <div className="graph-range" style={{ position: "relative", height: 24 }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 2,
                background: "var(--border)",
                transform: "translateY(-50%)",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: `${((Math.min(yearFrom, yearTo) - min) / (max - min)) * 100}%`,
                right: `${100 - ((Math.max(yearFrom, yearTo) - min) / (max - min)) * 100}%`,
                height: 2,
                background: "var(--accent)",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="range"
              aria-label="Year range start"
              min={min}
              max={max}
              step={1}
              value={yearFrom}
              onChange={(e) => setYearFrom(parseInt(e.target.value, 10))}
              onMouseUp={() => commit(yearFrom, yearTo)}
              onTouchEnd={() => commit(yearFrom, yearTo)}
              onKeyUp={() => commit(yearFrom, yearTo)}
            />
            <input
              type="range"
              aria-label="Year range end"
              min={min}
              max={max}
              step={1}
              value={yearTo}
              onChange={(e) => setYearTo(parseInt(e.target.value, 10))}
              onMouseUp={() => commit(yearFrom, yearTo)}
              onTouchEnd={() => commit(yearFrom, yearTo)}
              onKeyUp={() => commit(yearFrom, yearTo)}
            />
          </div>
        </div>
        <div
          className="muted"
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {graph.nodes.length} entities · {graph.links.length} connections
          {loading ? " · refreshing…" : ""}
        </div>
      </div>

      <svg
        role="img"
        aria-label="Entity co-occurrence network"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{
          width: "100%",
          height: "auto",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          touchAction: "manipulation",
        }}
      >
        <g>
          {linksRef.current.map((l, i) => {
            const s = typeof l.source === "string" ? nodeById.get(l.source) : l.source;
            const t = typeof l.target === "string" ? nodeById.get(l.target) : l.target;
            if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) {
              return null;
            }
            const sourceId = typeof l.source === "string" ? l.source : l.source.id;
            const targetId = typeof l.target === "string" ? l.target : l.target.id;
            const highlighted =
              hovered === null ||
              (connectedPeerIds?.has(sourceId) && connectedPeerIds?.has(targetId));
            return (
              <a
                key={i}
                href={`/search?entity=${encodeURIComponent(sourceId)}&entity=${encodeURIComponent(targetId)}`}
                aria-label={`Search records mentioning both ${s.name} and ${t.name}`}
              >
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={highlighted ? "var(--accent)" : "var(--border-strong)"}
                  strokeOpacity={highlighted ? Math.min(0.85, 0.15 + (l.count / maxCount) * 0.7) : 0.18}
                  strokeWidth={Math.max(1, Math.min(4, Math.log(1 + l.count)))}
                />
              </a>
            );
          })}
        </g>
        <g>
          {nodesRef.current.map((n) => {
            if (n.x == null || n.y == null) return null;
            const r = nodeRadius(n.degree);
            const isHovered = hovered === n.id;
            const isConnected = connectedPeerIds?.has(n.id) ?? true;
            const dim = hovered !== null && !isConnected;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(n.id)}
                onBlur={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <a href={`/entity/${encodeURIComponent(n.id)}`}>
                  <circle
                    r={r}
                    fill={nodeColor(n.type)}
                    stroke={isHovered ? "var(--text)" : "var(--border-strong)"}
                    strokeWidth={isHovered ? 2 : 1}
                    opacity={dim ? 0.25 : 1}
                  />
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize={12}
                    fill={dim ? "var(--text-muted)" : "var(--text)"}
                    pointerEvents="none"
                    // Halo: stroke rendered BEFORE fill, in the surface color,
                    // so the label stays readable when it overlaps an edge or
                    // a neighbor's label.
                    stroke="var(--surface)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ userSelect: "none" }}
                  >
                    {n.name}
                  </text>
                </a>
              </g>
            );
          })}
        </g>
      </svg>

      <p
        className="muted"
        style={{
          fontSize: "0.82rem",
          color: "var(--text-muted)",
          maxWidth: "70ch",
          marginTop: 14,
        }}
      >
        Each node is an entity mentioned in the corpus; each edge joins a
        pair that co-occurs in at least two records at medium or high
        confidence within the selected year range. Click a node to open the
        entity page; click an edge to search for records mentioning both
        entities together.
      </p>

      <style>{`
        .graph-range input[type="range"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 24px;
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
          pointer-events: none;
          accent-color: var(--accent);
        }
        .graph-range input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--bg);
          border: 2px solid var(--accent);
          cursor: grab;
          pointer-events: auto;
          box-shadow: var(--shadow-sm);
        }
        .graph-range input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--bg);
          border: 2px solid var(--accent);
          cursor: grab;
          pointer-events: auto;
        }
        .graph-range input[type="range"]::-webkit-slider-runnable-track {
          height: 24px;
          background: transparent;
        }
      `}</style>

      <noscript>
        <p
          style={{
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 6,
            marginTop: 16,
            fontSize: "0.9rem",
          }}
        >
          The network graph needs JavaScript. An entity list with the same
          data is available at{" "}
          <Link href="/entities">/entities</Link>.
        </p>
      </noscript>
    </div>
  );
}

function nodeRadius(degree: number): number {
  return Math.max(8, Math.min(22, 8 + Math.sqrt(degree) * 3));
}

function nodeColor(type: SimNode["type"]): string {
  switch (type) {
    case "person":
      return "var(--accent)";
    case "org":
      return "var(--text)";
    case "place":
      return "var(--text-muted)";
    case "concept":
      return "var(--border-strong)";
  }
}
