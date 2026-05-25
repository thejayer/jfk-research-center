"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { CooccurrenceGraph, CooccurrenceNode } from "@/lib/api-types";
import {
  buildCaseLinkChart,
  type CaseLinkChartLink,
  type CaseLinkChartNode,
} from "@/lib/case-link-chart";

type PositionedNode = CaseLinkChartNode & SimulationNodeDatum;
type PositionedLink = Omit<CaseLinkChartLink, "source" | "target"> &
  SimulationLinkDatum<PositionedNode> & {
    source: string | PositionedNode;
    target: string | PositionedNode;
    count: number;
  };

const canvasWidth = 980;
const canvasHeight = 640;
const cardWidth = 178;
const cardHeight = 88;
const defaultZoom = 0.84;
const minZoom = 0.68;
const maxZoom = 1.35;
const typeOptions: Array<{ type: CooccurrenceNode["type"]; label: string }> = [
  { type: "person", label: "People" },
  { type: "org", label: "Organizations" },
  { type: "place", label: "Places" },
  { type: "concept", label: "Concepts" },
];

export function CaseLinkChart({ initial }: { initial: CooccurrenceGraph }) {
  const [graph, setGraph] = useState(initial);
  const [yearFrom, setYearFrom] = useState(initial.appliedRange.yearFrom);
  const [yearTo, setYearTo] = useState(initial.appliedRange.yearTo);
  const [loading, setLoading] = useState(false);
  const [activeTypes, setActiveTypes] = useState<CooccurrenceNode["type"][]>(
    () => typeOptions.map((option) => option.type),
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initial.nodes[0]?.id ?? null,
  );
  const [zoom, setZoom] = useState(defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const chart = useMemo(() => buildCaseLinkChart(graph), [graph]);
  const { min, max } = initial.yearBounds;

  const visibleTypeSet = useMemo(() => new Set(activeTypes), [activeTypes]);
  const layout = useMemo(
    () => buildLayout(chart.nodes, chart.links, visibleTypeSet),
    [chart.nodes, chart.links, visibleTypeSet],
  );

  useEffect(() => {
    if (!layout.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(layout.nodes[0]?.id ?? null);
    }
  }, [layout.nodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => chart.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [chart.nodes, selectedNodeId],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return chart.links
      .filter(
        (link) =>
          link.source === selectedNode.id || link.target === selectedNode.id,
      )
      .slice(0, 6);
  }, [chart.links, selectedNode]);

  const focusedNodeId = hoveredNodeId ?? selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!focusedNodeId) return null;
    const ids = new Set<string>([focusedNodeId]);
    for (const link of chart.links) {
      if (link.source === focusedNodeId) ids.add(link.target);
      if (link.target === focusedNodeId) ids.add(link.source);
    }
    return ids;
  }, [chart.links, focusedNodeId]);

  const commit = useCallback(
    async (nextFrom: number, nextTo: number) => {
      const lo = Math.min(nextFrom, nextTo);
      const hi = Math.max(nextFrom, nextTo);
      setLoading(true);
      try {
        const res = await fetch(`/api/graph?yearFrom=${lo}&yearTo=${hi}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Graph refetch failed: ${res.status}`);
        }
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

  const toggleType = (type: CooccurrenceNode["type"]) => {
    setActiveTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1
          ? current
          : current.filter((value) => value !== type);
      }
      return [...current, type];
    });
  };

  const resetView = () => {
    setZoom(defaultZoom);
    setPan({ x: 0, y: 0 });
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest("[data-chart-interactive='true']")) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.panX + event.clientX - drag.startX,
      y: drag.panY + event.clientY - drag.startY,
    });
  };

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setZoom((current) =>
      clamp(current + direction * 0.08, minZoom, maxZoom),
    );
  };

  return (
    <section className="case-link-chart" aria-label="JFK case link chart">
      <div className="case-link-toolbar">
        <div className="case-link-range">
          <label className="eyebrow" htmlFor="case-link-year-from">
            Event date range
          </label>
          <div className="case-link-range-value">
            {Math.min(yearFrom, yearTo)}-{Math.max(yearFrom, yearTo)}
          </div>
          <div className="case-link-range-control">
            <input
              id="case-link-year-from"
              type="range"
              aria-label="Year range start"
              min={min}
              max={max}
              step={1}
              value={yearFrom}
              onChange={(event) => setYearFrom(parseInt(event.target.value, 10))}
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
              onChange={(event) => setYearTo(parseInt(event.target.value, 10))}
              onMouseUp={() => commit(yearFrom, yearTo)}
              onTouchEnd={() => commit(yearFrom, yearTo)}
              onKeyUp={() => commit(yearFrom, yearTo)}
            />
          </div>
        </div>

        <fieldset className="case-link-types">
          <legend className="eyebrow">Node types</legend>
          <div className="case-link-type-row">
            {typeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className="case-link-type"
                data-active={activeTypes.includes(option.type)}
                onClick={() => toggleType(option.type)}
              >
                <span
                  className="case-link-type-dot"
                  style={{ background: nodeTypeColor(option.type) }}
                />
                {option.label}
                <span className="case-link-type-count">
                  {chart.summary.typeCounts[option.type]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="case-link-stats" aria-live="polite">
          <strong>{layout.nodes.length}</strong> cards
          <span>{layout.links.length} labeled links</span>
          {loading ? <span>Refreshing...</span> : null}
        </div>
      </div>

      <div className="case-link-workspace">
        <div
          className="case-link-canvas"
          role="region"
          aria-label="Pan and zoom case link chart. Select a card to inspect its connections."
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onWheel={onCanvasWheel}
        >
          <div className="case-link-zoom-controls" data-chart-interactive="true">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => clamp(z + 0.1, minZoom, maxZoom))}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => clamp(z - 0.1, minZoom, maxZoom))}
            >
              -
            </button>
            <button type="button" onClick={resetView}>
              Reset
            </button>
          </div>

          <div
            className="case-link-stage"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <svg
              className="case-link-lines"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              aria-hidden="true"
            >
              {layout.links.map((link) => {
                const source = resolveNode(link.source);
                const target = resolveNode(link.target);
                if (!source || !target) return null;
                const highlighted =
                  !connectedNodeIds ||
                  (connectedNodeIds.has(source.id) &&
                    connectedNodeIds.has(target.id));
                const sourceX = source.x ?? 0;
                const sourceY = source.y ?? 0;
                const targetX = target.x ?? 0;
                const targetY = target.y ?? 0;
                const midX = sourceX / 2 + targetX / 2;
                const midY = sourceY / 2 + targetY / 2;

                return (
                  <g key={link.id} opacity={highlighted ? 1 : 0.18}>
                    <line
                      x1={sourceX}
                      y1={sourceY}
                      x2={targetX}
                      y2={targetY}
                      stroke={
                        highlighted ? "var(--border-strong)" : "var(--border)"
                      }
                      strokeWidth={Math.max(
                        1.2,
                        Math.min(4.4, 1 + Math.log(link.count)),
                      )}
                    />
                    {link.count >= 2 ? (
                      <text
                        x={midX}
                        y={midY - 8}
                        textAnchor="middle"
                        className="case-link-line-label"
                      >
                        {link.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {layout.nodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const connected =
                !connectedNodeIds || connectedNodeIds.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className="case-link-node"
                  data-chart-interactive="true"
                  data-type={node.type}
                  data-selected={selected}
                  style={{
                    left: node.x ?? 0,
                    top: node.y ?? 0,
                    opacity: connected ? 1 : 0.34,
                  }}
                  onClick={() => setSelectedNodeId(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onFocus={() => setHoveredNodeId(node.id)}
                  onBlur={() => setHoveredNodeId(null)}
                >
                  <span className="case-link-node-topline">
                    <span
                      className="case-link-node-dot"
                      style={{ background: nodeTypeColor(node.type) }}
                    />
                    {node.typeLabel}
                  </span>
                  <span className="case-link-node-name">{node.name}</span>
                  <span className="case-link-node-meta">
                    {node.degree} connection{node.degree === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="case-link-detail" aria-label="Selected chart item">
          {selectedNode ? (
            <>
              <div className="eyebrow">Selected card</div>
              <h2>{selectedNode.name}</h2>
              <p>
                {selectedNode.typeLabel} with {selectedNode.degree} co-occurring
                peer{selectedNode.degree === 1 ? "" : "s"} in the selected date
                range.
              </p>
              <div className="case-link-actions">
                <Link href={selectedNode.href}>Open entity</Link>
                <Link href={selectedNode.searchHref}>Search mentions</Link>
              </div>
              <div className="case-link-connection-list">
                <div className="eyebrow">Strongest links</div>
                {selectedConnections.length > 0 ? (
                  selectedConnections.map((link) => {
                    const peerName =
                      link.source === selectedNode.id
                        ? link.targetName
                        : link.sourceName;
                    return (
                      <Link key={link.id} href={link.href}>
                        <span>{peerName}</span>
                        <strong>{link.count.toLocaleString()}</strong>
                      </Link>
                    );
                  })
                ) : (
                  <p className="muted">No visible links for this filter.</p>
                )}
              </div>
            </>
          ) : (
            <p className="muted">Select a card to inspect its source trail.</p>
          )}
        </aside>
      </div>

      <p className="case-link-note">
        Cards represent entities in the corpus. Lines show shared records, not
        proven relationships. Use the date range and type filters to isolate
        investigative eras, then open the entity or search the paired mentions.
      </p>

      <noscript>
        <p className="case-link-note">
          The case link chart requires JavaScript. The same entity index is
          available at <Link href="/entities">/entities</Link>.
        </p>
      </noscript>

      <style>{`
        .case-link-chart {
          display: grid;
          gap: 18px;
        }
        .case-link-toolbar {
          display: grid;
          grid-template-columns: minmax(250px, 1fr) minmax(300px, 1.2fr) auto;
          gap: 18px;
          align-items: end;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: color-mix(in srgb, var(--surface) 86%, var(--bg));
          box-shadow: var(--shadow-sm);
        }
        .case-link-range-value {
          margin: 3px 0 8px;
          font-family: var(--font-serif);
          font-size: 1.2rem;
          font-variant-numeric: tabular-nums;
        }
        .case-link-range-control {
          position: relative;
          height: 28px;
        }
        .case-link-range-control::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 2px;
          background: var(--border);
          transform: translateY(-50%);
        }
        .case-link-range-control input[type="range"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 28px;
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
          pointer-events: none;
          accent-color: var(--accent);
        }
        .case-link-range-control input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 2px solid var(--accent);
          background: var(--surface);
          box-shadow: var(--shadow-sm);
          cursor: grab;
          pointer-events: auto;
        }
        .case-link-range-control input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 2px solid var(--accent);
          background: var(--surface);
          cursor: grab;
          pointer-events: auto;
        }
        .case-link-types {
          min-width: 0;
          border: 0;
          padding: 0;
          margin: 0;
        }
        .case-link-type-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        .case-link-type,
        .case-link-zoom-controls button,
        .case-link-actions a {
          min-height: 36px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          font: inherit;
          font-size: 0.84rem;
          cursor: pointer;
          transition:
            border-color var(--motion),
            box-shadow var(--motion),
            background var(--motion);
        }
        .case-link-type {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
        }
        .case-link-type[data-active="true"] {
          border-color: var(--border-strong);
          background: var(--accent-soft);
        }
        .case-link-type-dot,
        .case-link-node-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .case-link-type-count {
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .case-link-stats {
          display: grid;
          gap: 2px;
          min-width: 130px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
        .case-link-stats strong {
          color: var(--text);
          font-size: 1.2rem;
          line-height: 1;
        }
        .case-link-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 16px;
          align-items: stretch;
        }
        .case-link-canvas {
          position: relative;
          min-height: 640px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px),
            var(--surface);
          background-size: 44px 44px;
          box-shadow: var(--shadow-md);
          touch-action: none;
          cursor: grab;
        }
        .case-link-canvas:active {
          cursor: grabbing;
        }
        .case-link-stage {
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: 0 0;
        }
        .case-link-lines {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .case-link-line-label {
          font-family: var(--font-mono);
          font-size: 11px;
          fill: var(--text-muted);
          paint-order: stroke;
          stroke: var(--surface);
          stroke-width: 5px;
          stroke-linejoin: round;
        }
        .case-link-node {
          position: absolute;
          width: ${cardWidth}px;
          min-height: ${cardHeight}px;
          transform: translate(-50%, -50%);
          display: grid;
          gap: 5px;
          text-align: left;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-top: 3px solid var(--border-strong);
          border-radius: 8px;
          background: color-mix(in srgb, var(--surface) 92%, var(--bg));
          color: var(--text);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          transition:
            opacity var(--motion),
            border-color var(--motion),
            box-shadow var(--motion),
            transform var(--motion);
        }
        .case-link-node:hover,
        .case-link-node:focus-visible,
        .case-link-node[data-selected="true"] {
          border-color: var(--accent);
          box-shadow: var(--shadow-md);
          transform: translate(-50%, -50%) translateY(-2px);
          outline: none;
        }
        .case-link-node[data-type="person"] {
          border-top-color: var(--accent);
        }
        .case-link-node[data-type="org"] {
          border-top-color: var(--link);
        }
        .case-link-node[data-type="place"] {
          border-top-color: var(--cat-investigation);
        }
        .case-link-node[data-type="concept"] {
          border-top-color: var(--cat-release);
        }
        .case-link-node-topline,
        .case-link-node-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: 0.72rem;
          line-height: 1.2;
        }
        .case-link-node-name {
          display: -webkit-box;
          overflow: hidden;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          font-family: var(--font-serif);
          font-size: 1rem;
          line-height: 1.16;
        }
        .case-link-zoom-controls {
          position: absolute;
          z-index: 3;
          top: 12px;
          left: 12px;
          display: flex;
          gap: 6px;
        }
        .case-link-zoom-controls button {
          min-width: 36px;
          padding: 0 10px;
        }
        .case-link-detail {
          min-height: 640px;
          padding: 18px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: var(--shadow-sm);
        }
        .case-link-detail h2 {
          margin: 8px 0 10px;
          font-family: var(--font-serif);
          font-size: 1.45rem;
          line-height: 1.15;
        }
        .case-link-detail p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .case-link-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin: 16px 0 22px;
        }
        .case-link-actions a {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          text-decoration: none;
        }
        .case-link-connection-list {
          display: grid;
          gap: 8px;
        }
        .case-link-connection-list a {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 10px 0;
          border-top: 1px solid var(--border);
          color: var(--text);
          text-decoration: none;
        }
        .case-link-connection-list span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .case-link-connection-list strong {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }
        .case-link-note {
          max-width: 76ch;
          margin: 0;
          color: var(--text-muted);
          font-size: 0.86rem;
          line-height: 1.55;
        }
        @media (max-width: 980px) {
          .case-link-toolbar,
          .case-link-workspace {
            grid-template-columns: 1fr;
          }
          .case-link-stats {
            text-align: left;
          }
          .case-link-canvas,
          .case-link-detail {
            min-height: 560px;
          }
        }
        @media (max-width: 640px) {
          .case-link-toolbar {
            padding: 12px;
          }
          .case-link-type-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .case-link-canvas {
            min-height: 520px;
          }
          .case-link-detail {
            min-height: auto;
          }
        }
      `}</style>
    </section>
  );
}

function buildLayout(
  chartNodes: CaseLinkChartNode[],
  chartLinks: CaseLinkChartLink[],
  visibleTypes: Set<CooccurrenceNode["type"]>,
): { nodes: PositionedNode[]; links: PositionedLink[] } {
  const nodes: PositionedNode[] = chartNodes
    .filter((node) => visibleTypes.has(node.type))
    .map((node, index, arr) => {
      const angle = (index / Math.max(1, arr.length)) * Math.PI * 2;
      const radius = 190 + (index % 5) * 28;
      return {
        ...node,
        x: canvasWidth / 2 + Math.cos(angle) * radius,
        y: canvasHeight / 2 + Math.sin(angle) * radius,
      };
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links: PositionedLink[] = chartLinks
    .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
    .map((link) => ({ ...link }));

  const simulation = forceSimulation<PositionedNode>(nodes)
    .force(
      "link",
      forceLink<PositionedNode, PositionedLink>(links)
        .id((node) => node.id)
        .distance((link) => Math.max(138, 230 - link.count * 5))
        .strength((link) => Math.min(0.5, 0.14 + Math.log1p(link.count) / 12)),
    )
    .force("charge", forceManyBody<PositionedNode>().strength(-780))
    .force(
      "center",
      forceCenter<PositionedNode>(canvasWidth / 2, canvasHeight / 2),
    )
    .force(
      "collide",
      forceCollide<PositionedNode>(
        () => Math.max(cardWidth, cardHeight) * 0.62,
      ),
    )
    .stop();

  for (let i = 0; i < 220; i += 1) {
    simulation.tick();
  }

  for (const node of nodes) {
    node.x = clamp(
      node.x ?? canvasWidth / 2,
      cardWidth / 2 + 18,
      canvasWidth - cardWidth / 2 - 18,
    );
    node.y = clamp(
      node.y ?? canvasHeight / 2,
      cardHeight / 2 + 18,
      canvasHeight - cardHeight / 2 - 18,
    );
  }

  return { nodes, links };
}

function resolveNode(
  node: string | PositionedNode | undefined,
): PositionedNode | null {
  return typeof node === "object" && node ? node : null;
}

function nodeTypeColor(type: CooccurrenceNode["type"]): string {
  switch (type) {
    case "person":
      return "var(--accent)";
    case "org":
      return "var(--link)";
    case "place":
      return "var(--cat-investigation)";
    case "concept":
      return "var(--cat-release)";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
