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
  findShortestCaseLinkPath,
  type CaseLinkChartLink,
  type CaseLinkChartNode,
} from "@/lib/case-link-chart";
import {
  serializeCaseLinkChartUrlState,
  type CaseLinkChartUrlState,
} from "@/lib/case-link-chart-url";

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
  { type: "media", label: "Media" },
];
const allTypeValues = typeOptions.map((option) => option.type);

export function CaseLinkChart({
  initial,
  initialUrlState = {},
}: {
  initial: CooccurrenceGraph;
  initialUrlState?: CaseLinkChartUrlState;
}) {
  const [graph, setGraph] = useState(initial);
  const [yearFrom, setYearFrom] = useState(initial.appliedRange.yearFrom);
  const [yearTo, setYearTo] = useState(initial.appliedRange.yearTo);
  const [loading, setLoading] = useState(false);
  const [activeTypes, setActiveTypes] = useState<CooccurrenceNode["type"][]>(
    () =>
      initialUrlState.types?.filter((type) => allTypeValues.includes(type)) ??
      allTypeValues,
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialUrlState.node ??
      (initialUrlState.edge || initialUrlState.from || initialUrlState.to
        ? null
        : (initial.nodes[0]?.id ?? null)),
  );
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(
    initialUrlState.edge ?? null,
  );
  const [pathStartId, setPathStartId] = useState(initialUrlState.from ?? "");
  const [pathEndId, setPathEndId] = useState(initialUrlState.to ?? "");
  const [zoom, setZoom] = useState(defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [chartReady, setChartReady] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const latestRequestIdRef = useRef(0);

  const chart = useMemo(() => buildCaseLinkChart(graph), [graph]);
  const { min, max } = initial.yearBounds;
  const defaultSelectedNodeId = initial.nodes[0]?.id ?? null;

  const visibleTypeSet = useMemo(() => new Set(activeTypes), [activeTypes]);
  const layout = useMemo(
    () =>
      chartReady
        ? buildLayout(chart.nodes, chart.links, visibleTypeSet)
        : { nodes: [] as PositionedNode[], links: [] as PositionedLink[] },
    [chart.nodes, chart.links, chartReady, visibleTypeSet],
  );
  const visibleNodeIds = useMemo(
    () => new Set(layout.nodes.map((node) => node.id)),
    [layout.nodes],
  );
  const visibleLinkIds = useMemo(
    () => new Set(layout.links.map((link) => link.id)),
    [layout.links],
  );
  const pathNodeOptions = useMemo(
    () => [...layout.nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [layout.nodes],
  );
  const pathResult = useMemo(
    () =>
      findShortestCaseLinkPath(chart, pathStartId, pathEndId, {
        visibleNodeIds,
        visibleLinkIds,
      }),
    [chart, pathEndId, pathStartId, visibleLinkIds, visibleNodeIds],
  );
  const pathNodeIds = useMemo(
    () =>
      pathResult ? new Set(pathResult.nodes.map((node) => node.id)) : null,
    [pathResult],
  );
  const pathLinkIds = useMemo(
    () =>
      pathResult ? new Set(pathResult.links.map((link) => link.id)) : null,
    [pathResult],
  );
  const pathStartNode = pathStartId
    ? (chart.nodes.find((node) => node.id === pathStartId) ?? null)
    : null;
  const pathEndNode = pathEndId
    ? (chart.nodes.find((node) => node.id === pathEndId) ?? null)
    : null;
  const hasPathQuery = Boolean(pathStartId && pathEndId);
  const hasSamePathEndpoint = Boolean(
    pathStartId && pathEndId && pathStartId === pathEndId,
  );

  useEffect(() => {
    setChartReady(true);
  }, []);

  const selectedLink = useMemo(
    () =>
      selectedLinkId && visibleLinkIds.has(selectedLinkId)
        ? (chart.links.find((link) => link.id === selectedLinkId) ?? null)
        : null,
    [chart.links, selectedLinkId, visibleLinkIds],
  );

  useEffect(() => {
    if (!chartReady) return;
    if (selectedLinkId && !visibleLinkIds.has(selectedLinkId)) {
      setSelectedLinkId(null);
    }
  }, [chartReady, selectedLinkId, visibleLinkIds]);

  useEffect(() => {
    if (
      selectedNodeId &&
      !chart.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(defaultSelectedNodeId);
    }
  }, [chart.nodes, defaultSelectedNodeId, selectedNodeId]);

  useEffect(() => {
    if (!chartReady) return;
    setPathStartId((current) =>
      current && !visibleNodeIds.has(current) ? "" : current,
    );
    setPathEndId((current) =>
      current && !visibleNodeIds.has(current) ? "" : current,
    );
  }, [chartReady, visibleNodeIds]);

  useEffect(() => {
    if (!chartReady) return;
    if (
      !selectedLinkId &&
      !layout.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(layout.nodes[0]?.id ?? null);
    }
  }, [chartReady, layout.nodes, selectedLinkId, selectedNodeId]);

  /**
   * URL sync invariant: this useEffect builds the canonical share state object,
   * elides default yearFrom/yearTo values from initial.yearBounds, lets
   * pathStartId/pathEndId take precedence over selectedNodeId/selectedLinkId,
   * omits selectedTypes when all types are active, and uses
   * serializeCaseLinkChartUrlState with window.history.replaceState only when
   * nextSearch differs from currentSearch.
   */
  useEffect(() => {
    const selectedTypes =
      activeTypes.length === allTypeValues.length ? undefined : activeTypes;
    const selectedPath = pathStartId || pathEndId;
    const state = {
      yearFrom: yearFrom === initial.yearBounds.min ? undefined : yearFrom,
      yearTo: yearTo === initial.yearBounds.max ? undefined : yearTo,
      types: selectedTypes,
      node:
        !selectedPath &&
        !selectedLinkId &&
        selectedNodeId &&
        selectedNodeId !== defaultSelectedNodeId
          ? selectedNodeId
          : undefined,
      edge: !selectedPath ? (selectedLinkId ?? undefined) : undefined,
      from: pathStartId || undefined,
      to: pathEndId || undefined,
    } satisfies CaseLinkChartUrlState;
    const nextSearch = serializeCaseLinkChartUrlState(state);
    const currentSearch = window.location.search.replace(/^\?/, "");
    if (nextSearch === currentSearch) return;
    const nextUrl = `${window.location.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [
    activeTypes,
    defaultSelectedNodeId,
    initial.yearBounds.max,
    initial.yearBounds.min,
    pathEndId,
    pathStartId,
    selectedLinkId,
    selectedNodeId,
    yearFrom,
    yearTo,
  ]);

  const selectedNode = useMemo(
    () =>
      selectedLink || pathResult
        ? null
        : (chart.nodes.find((node) => node.id === selectedNodeId) ?? null),
    [chart.nodes, pathResult, selectedLink, selectedNodeId],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return chart.links
      .filter(
        (link) =>
          visibleNodeIds.has(link.source) &&
          visibleNodeIds.has(link.target) &&
          (link.source === selectedNode.id || link.target === selectedNode.id),
      )
      .slice(0, 6);
  }, [chart.links, selectedNode, visibleNodeIds]);

  const focusedNodeId = hoveredNodeId ?? selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    if (pathNodeIds) return pathNodeIds;
    if (selectedLink) {
      return new Set<string>([selectedLink.source, selectedLink.target]);
    }
    if (!focusedNodeId) return null;
    const ids = new Set<string>([focusedNodeId]);
    for (const link of chart.links) {
      if (link.source === focusedNodeId) ids.add(link.target);
      if (link.target === focusedNodeId) ids.add(link.source);
    }
    return ids;
  }, [chart.links, focusedNodeId, pathNodeIds, selectedLink]);

  const commit = useCallback(
    async (nextFrom: number, nextTo: number) => {
      const lo = Math.min(nextFrom, nextTo);
      const hi = Math.max(nextFrom, nextTo);
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      setLoading(true);
      try {
        const res = await fetch(`/api/graph?yearFrom=${lo}&yearTo=${hi}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Graph refetch failed: ${res.status}`);
        }
        const data = (await res.json()) as CooccurrenceGraph;
        if (latestRequestIdRef.current === requestId) {
          setGraph(data);
        }
      } catch (err) {
        console.error("Graph refetch failed:", err);
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setLoading(false);
        }
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

  const selectLink = (linkId: string) => {
    setSelectedLinkId(linkId);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setPathStartId("");
    setPathEndId("");
  };

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedLinkId(null);
    setPathStartId("");
    setPathEndId("");
  };

  const setPathStart = (nodeId: string) => {
    setPathStartId(nodeId);
    setSelectedLinkId(null);
    setSelectedNodeId(nodeId || pathEndId || null);
  };

  const setPathEnd = (nodeId: string) => {
    setPathEndId(nodeId);
    setSelectedLinkId(null);
    setSelectedNodeId(nodeId || pathStartId || null);
  };

  const clearPath = () => {
    setPathStartId("");
    setPathEndId("");
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

        <section
          className="case-link-path-finder"
          aria-labelledby="case-link-path-heading"
        >
          <div className="case-link-path-copy">
            <div className="eyebrow" id="case-link-path-heading">
              Path finder
            </div>
            <p>
              Pick two visible cards to highlight the shortest relationship
              path and inspect each evidence step.
            </p>
          </div>
          <label className="case-link-path-field" htmlFor="case-link-path-from">
            <span>From</span>
            <select
              id="case-link-path-from"
              value={pathStartId}
              onChange={(event) => setPathStart(event.target.value)}
            >
              <option value="">Choose start</option>
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label className="case-link-path-field" htmlFor="case-link-path-to">
            <span>To</span>
            <select
              id="case-link-path-to"
              value={pathEndId}
              onChange={(event) => setPathEnd(event.target.value)}
            >
              <option value="">Choose target</option>
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <div className="case-link-path-tools">
            <button
              type="button"
              onClick={clearPath}
              disabled={!pathStartId && !pathEndId}
            >
              Clear path
            </button>
            <span aria-live="polite">
              {hasSamePathEndpoint
                ? "Choose two different cards"
                : pathResult
                  ? `${pathResult.steps.length} step${
                      pathResult.steps.length === 1 ? "" : "s"
                    } found`
                  : hasPathQuery
                    ? "No visible path"
                    : "No path selected"}
            </span>
          </div>
        </section>
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
            {!chartReady ? (
              <div className="case-link-loading">Preparing graph...</div>
            ) : null}
            <svg
              className="case-link-lines"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              aria-hidden="true"
            >
              {layout.links.map((link) => {
                const source = resolveNode(link.source);
                const target = resolveNode(link.target);
                if (!source || !target) return null;
                const selected = selectedLinkId === link.id;
                const pathEdge = pathLinkIds?.has(link.id) ?? false;
                const highlighted =
                  pathEdge ||
                  !connectedNodeIds ||
                  selected ||
                  (connectedNodeIds.has(source.id) &&
                    connectedNodeIds.has(target.id));
                const sourceX = source.x ?? 0;
                const sourceY = source.y ?? 0;
                const targetX = target.x ?? 0;
                const targetY = target.y ?? 0;

                return (
                  <g
                    key={link.id}
                    opacity={highlighted ? 1 : 0.18}
                  >
                    <line
                      className="case-link-edge-visible"
                      x1={sourceX}
                      y1={sourceY}
                      x2={targetX}
                      y2={targetY}
                      stroke={
                        selected
                          ? "var(--accent)"
                          : pathEdge
                            ? "var(--cat-release)"
                          : highlighted
                            ? "var(--border-strong)"
                            : "var(--border)"
                      }
                      strokeWidth={Math.max(
                        pathEdge ? 2.4 : 1.2,
                        Math.min(
                          pathEdge ? 5.8 : 4.4,
                          1 + Math.log(link.count),
                        ),
                      )}
                    />
                  </g>
                );
              })}
            </svg>

            {layout.links.map((link) => {
              const source = resolveNode(link.source);
              const target = resolveNode(link.target);
              if (!source || !target) return null;
              const selected = selectedLinkId === link.id;
              const pathEdge = pathLinkIds?.has(link.id) ?? false;
              const sourceX = source.x ?? 0;
              const sourceY = source.y ?? 0;
              const targetX = target.x ?? 0;
              const targetY = target.y ?? 0;
              const midX = sourceX / 2 + targetX / 2;
              const midY = sourceY / 2 + targetY / 2;
              const highlighted =
                pathEdge ||
                !connectedNodeIds ||
                selected ||
                (connectedNodeIds.has(source.id) &&
                  connectedNodeIds.has(target.id));

              return (
                <button
                  key={link.id}
                  type="button"
                  className="case-link-edge-button"
                  data-chart-interactive="true"
                  data-path={pathEdge}
                  data-selected={selected}
                  style={{
                    left: midX,
                    top: midY - 8,
                    opacity: highlighted ? 1 : 0.22,
                  }}
                  aria-label={`Inspect ${link.sourceName} and ${link.targetName}: ${link.label}`}
                  onClick={() => selectLink(link.id)}
                >
                  {link.label}
                </button>
              );
            })}

            {layout.nodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const pathNode = pathNodeIds?.has(node.id) ?? false;
              const connected =
                !connectedNodeIds || connectedNodeIds.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className="case-link-node"
                  data-chart-interactive="true"
                  data-path={pathNode}
                  data-type={node.type}
                  data-selected={selected}
                  style={{
                    left: node.x ?? 0,
                    top: node.y ?? 0,
                    opacity: connected ? 1 : 0.34,
                  }}
                  onClick={() => selectNode(node.id)}
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
          {pathResult ? (
            <>
              <div className="eyebrow">Path finder</div>
              <h2>
                {pathResult.source.name} to {pathResult.target.name}
              </h2>
              <p>
                Shortest visible path: {pathResult.steps.length} relationship
                step{pathResult.steps.length === 1 ? "" : "s"}. Each step links
                to the paired mention search and shows sampled supporting
                records when available.
              </p>
              <div className="case-link-path-list">
                {pathResult.steps.map((step, index) => (
                  <div key={step.link.id} className="case-link-path-step">
                    <div className="case-link-path-step-header">
                      <span>{index + 1}</span>
                      <Link href={step.link.href}>
                        {step.from.name} to {step.to.name}
                      </Link>
                      <strong>{step.link.label}</strong>
                    </div>
                    {step.link.documents.length > 0 ? (
                      <div className="case-link-path-records">
                        {step.link.documents.slice(0, 2).map((document) => (
                          <Link key={document.id} href={document.href}>
                            <span>{document.title}</span>
                            <small>
                              {[
                                document.agency,
                                document.dateLabel ?? document.date,
                              ]
                                .filter(Boolean)
                                .join(" / ") || "Record"}
                            </small>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No sampled records on this edge. Open paired search for
                        the full trail.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : hasPathQuery ? (
            <>
              <div className="eyebrow">Path finder</div>
              <h2>No visible path</h2>
              <p>
                {hasSamePathEndpoint
                  ? "Choose two different cards to calculate a relationship path."
                  : `No visible route connects ${
                      pathStartNode?.name ?? "the selected start"
                    } and ${
                      pathEndNode?.name ?? "the selected target"
                    } with the current date range and node-type filters.`}
              </p>
            </>
          ) : selectedLink ? (
            <>
              <div className="eyebrow">Selected relationship</div>
              <h2>
                {selectedLink.sourceName} and {selectedLink.targetName}
              </h2>
              {isMediaLink(selectedLink) ? (
                <p>
                  This edge comes from official media metadata. Open the media
                  record to review the JFK Library source, rights posture, and
                  related entity or topic tags.
                </p>
              ) : (
                <p>
                  The selected range includes {selectedLink.label} that{" "}
                  {selectedLink.count === 1 ? "mentions" : "mention"} both
                  endpoints. Review the sample records below, or open the full
                  paired search for the complete trail.
                </p>
              )}
              <div className="case-link-actions">
                <Link href={selectedLink.href}>
                  {isMediaLink(selectedLink)
                    ? "Open media record"
                    : "Search both entities"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(selectedLink.source);
                    setSelectedLinkId(null);
                  }}
                >
                  Inspect {selectedLink.sourceName}
                </button>
              </div>
              <div className="case-link-record-list">
                <div className="eyebrow">
                  {isMediaLink(selectedLink)
                    ? "Media source"
                    : "Supporting records"}
                </div>
                {selectedLink.documents.length > 0 ? (
                  selectedLink.documents.map((document) => (
                    <Link key={document.id} href={document.href}>
                      <span className="case-link-record-title">
                        {document.title}
                      </span>
                      <span className="case-link-record-meta">
                        {[document.agency, document.dateLabel ?? document.date]
                          .filter(Boolean)
                          .join(" / ") || "Record"}
                      </span>
                      {document.snippet ? (
                        <span className="case-link-record-snippet">
                          {document.snippet}
                        </span>
                      ) : null}
                    </Link>
                  ))
                ) : (
                  <p className="muted">
                    {isMediaLink(selectedLink)
                      ? "This metadata edge is backed by the linked media record rather than sampled OCR records."
                      : "This edge does not include sampled records yet. Use paired search to inspect the full document trail."}
                  </p>
                )}
              </div>
            </>
          ) : selectedNode ? (
            <>
              <div className="eyebrow">Selected card</div>
              <h2>{selectedNode.name}</h2>
              {selectedNode.type === "media" ? (
                <>
                  <p>
                    {selectedNode.description ??
                      "Official media record connected by curated entity and topic metadata."}
                  </p>
                  {selectedNode.meta ? (
                    <p className="case-link-node-context">{selectedNode.meta}</p>
                  ) : null}
                  <div className="case-link-node-badges">
                    {selectedNode.rightsLabel ? (
                      <span>{selectedNode.rightsLabel}</span>
                    ) : null}
                    {selectedNode.storageLabel ? (
                      <span>{selectedNode.storageLabel}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <p>
                  {selectedNode.typeLabel} with {selectedNode.degree} connected
                  peer{selectedNode.degree === 1 ? "" : "s"} in the selected
                  date range.
                </p>
              )}
              <div className="case-link-actions">
                <Link href={selectedNode.href}>
                  {selectedNode.type === "media"
                    ? "Open media page"
                    : selectedNode.typeLabel === "Topic"
                      ? "Open topic"
                      : "Open entity"}
                </Link>
                {selectedNode.searchHref ? (
                  <Link href={selectedNode.searchHref}>Search mentions</Link>
                ) : null}
                {selectedNode.sourceUrl ? (
                  <a
                    href={selectedNode.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official record
                  </a>
                ) : null}
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
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => selectLink(link.id)}
                      >
                        <span>{peerName}</span>
                        <strong>{link.label}</strong>
                      </button>
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
        Cards represent entities, topics, and rights-aware official media in the
        corpus. Lines show shared records or curated media metadata, not proven
        relationships. Use the date range and type filters to isolate
        investigative eras, then open the underlying source trail.
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
        .case-link-path-tools button,
        .case-link-actions a,
        .case-link-actions button {
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
        .case-link-path-finder {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns:
            minmax(220px, 1fr)
            minmax(180px, 0.8fr)
            minmax(180px, 0.8fr)
            minmax(130px, auto);
          gap: 14px;
          align-items: end;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .case-link-path-copy {
          display: grid;
          gap: 4px;
        }
        .case-link-path-copy p {
          max-width: 46ch;
          margin: 0;
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.4;
        }
        .case-link-path-field {
          display: grid;
          gap: 6px;
          min-width: 0;
          color: var(--text-muted);
          font-size: 0.78rem;
        }
        .case-link-path-field select {
          width: 100%;
          min-height: 38px;
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          font: inherit;
          font-size: 0.86rem;
          padding: 0 10px;
        }
        .case-link-path-tools {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .case-link-path-tools button {
          padding: 0 12px;
        }
        .case-link-path-tools button:disabled {
          cursor: not-allowed;
          opacity: 0.52;
        }
        .case-link-path-tools span {
          min-height: 1rem;
          color: var(--text-muted);
          font-size: 0.76rem;
          line-height: 1.2;
          text-align: center;
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
        .case-link-loading {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: var(--text-muted);
          font-size: 0.86rem;
        }
        .case-link-edge-visible {
          transition: stroke var(--motion), stroke-width var(--motion);
        }
        .case-link-edge-button {
          position: absolute;
          z-index: 1;
          max-width: 116px;
          transform: translate(-50%, -50%);
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: color-mix(in srgb, var(--surface) 88%, var(--bg));
          color: var(--text-muted);
          box-shadow: var(--shadow-sm);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          line-height: 1;
          padding: 6px 8px;
          cursor: pointer;
          transition:
            opacity var(--motion),
            border-color var(--motion),
            background var(--motion),
            color var(--motion),
            box-shadow var(--motion),
            transform var(--motion);
        }
        .case-link-edge-button:hover,
        .case-link-edge-button:focus-visible,
        .case-link-edge-button[data-path="true"],
        .case-link-edge-button[data-selected="true"] {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          color: var(--text);
          box-shadow: var(--shadow-md);
          outline: none;
          transform: translate(-50%, -50%) translateY(-1px);
        }
        .case-link-node {
          position: absolute;
          z-index: 2;
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
        .case-link-node[data-path="true"],
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
        .case-link-node[data-type="media"] {
          border-top-color: var(--cat-operational);
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
        .case-link-node-context {
          margin-top: 10px;
          font-family: var(--font-mono);
          font-size: 0.78rem;
        }
        .case-link-node-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .case-link-node-badges span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: color-mix(in srgb, var(--surface) 82%, var(--accent-soft));
          color: var(--text-muted);
          font-size: 0.74rem;
        }
        .case-link-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin: 16px 0 22px;
        }
        .case-link-actions a,
        .case-link-actions button {
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
        .case-link-connection-list button {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          width: 100%;
          padding: 10px 0;
          border: 0;
          border-top: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
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
        .case-link-record-list {
          display: grid;
          gap: 10px;
          margin-top: 20px;
        }
        .case-link-record-list a {
          display: grid;
          gap: 5px;
          padding: 12px 0;
          border-top: 1px solid var(--border);
          color: var(--text);
          text-decoration: none;
        }
        .case-link-record-title {
          font-family: var(--font-serif);
          font-size: 1rem;
          line-height: 1.18;
        }
        .case-link-record-meta,
        .case-link-record-snippet {
          color: var(--text-muted);
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .case-link-record-snippet {
          display: -webkit-box;
          overflow: hidden;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .case-link-path-list {
          display: grid;
          gap: 12px;
          margin-top: 20px;
        }
        .case-link-path-step {
          display: grid;
          gap: 10px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .case-link-path-step-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 6px 10px;
          align-items: center;
        }
        .case-link-path-step-header > span {
          grid-row: span 2;
          display: inline-grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 0.76rem;
        }
        .case-link-path-step-header a {
          min-width: 0;
          color: var(--text);
          font-family: var(--font-serif);
          font-size: 1rem;
          line-height: 1.18;
          text-decoration: none;
        }
        .case-link-path-step-header strong {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.76rem;
          font-weight: 500;
        }
        .case-link-path-records {
          display: grid;
          gap: 8px;
          padding-left: 36px;
        }
        .case-link-path-records a {
          display: grid;
          gap: 3px;
          color: var(--text);
          text-decoration: none;
        }
        .case-link-path-records span {
          display: -webkit-box;
          overflow: hidden;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          font-size: 0.85rem;
          line-height: 1.22;
        }
        .case-link-path-records small {
          color: var(--text-muted);
          font-size: 0.72rem;
          line-height: 1.25;
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
          .case-link-path-finder,
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
          .case-link-path-finder {
            gap: 10px;
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
    case "media":
      return "var(--cat-operational)";
  }
}

function isMediaLink(link: CaseLinkChartLink): boolean {
  return link.kind === "media_entity" || link.kind === "media_topic";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
