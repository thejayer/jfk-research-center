"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { DealeyPlazaResponse, DealeyPlazaWitness } from "@/lib/api-types";
import { DEFAULT_MUZZLE_VELOCITY_FPS } from "@/lib/constants";
import {
  HISTORICAL_DEALEY_IMAGE,
  HISTORICAL_MAP_CALIBRATION,
  buildHistoricalTrajectoryFootprint,
  projectTrajectoryPointToHistoricalImage,
  projectWitnessToHistoricalImage,
} from "@/lib/historical-map-overlay";
import {
  TRAJECTORY_FRAME_MARKS,
  buildTrajectorySourceTrail,
  getTrajectoryFrameMark,
  type TrajectoryFrameMark,
  type TrajectorySourceTrailItem,
} from "@/lib/trajectory-evidence";
import {
  TRAJECTORY_PRESETS,
  type TrajectoryPreset,
} from "@/lib/trajectory-presets";
import {
  buildTrajectoryPlanBounds,
  compareTrajectoryToPlanePoint,
  formatDegrees,
  formatFeet,
  projectTrajectoryPlanPoint,
  solveTrajectory,
  type TrajectoryPlanePointComparison,
  type TrajectoryPoint,
} from "@/lib/trajectory";
import styles from "./trajectory-sandbox.module.css";

type ControlSpec = {
  key: keyof TrajectoryPoint;
  label: string;
  min: number;
  max: number;
  step?: number;
};

const ORIGIN_CONTROLS: ControlSpec[] = [
  { key: "x", label: "Origin east/west", min: -80, max: 20 },
  { key: "y", label: "Origin height", min: 20, max: 90 },
  { key: "z", label: "Origin north/south", min: 0, max: 80 },
];

const TARGET_CONTROLS: ControlSpec[] = [
  { key: "x", label: "Target east/west", min: -20, max: 90 },
  { key: "y", label: "Target height", min: 2, max: 14 },
  { key: "z", label: "Target north/south", min: -95, max: 10 },
];

const FALLBACK_POINT: TrajectoryPoint = { x: 0, y: 0, z: 0 };
const FALLBACK_PRESET: TrajectoryPreset = {
  id: "manual",
  name: "Manual scenario",
  summary: "Fallback manual scenario used when no configured presets are available.",
  origin: FALLBACK_POINT,
  target: FALLBACK_POINT,
  uncertaintyDegrees: 1,
  sources: [],
};

const PLAN_VIEW_WIDTH = 620;
const PLAN_VIEW_HEIGHT = 260;
const PLAN_VIEW_PADDING = 24;
const PLAN_LANDMARK_POINTS: TrajectoryPoint[] = [
  { x: -86, y: 0, z: 10 },
  { x: -58, y: 0, z: 42 },
  { x: 78, y: 0, z: -84 },
  { x: 50, y: 0, z: 24 },
];

export function TrajectorySandbox() {
  const frameSelectorLabelId = useId();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const objectsRef = useRef<{
    origin: THREE.Mesh;
    target: THREE.Mesh;
    ray: THREE.Line;
    cone: THREE.Mesh;
  } | null>(null);
  const initialPreset = TRAJECTORY_PRESETS[0] ?? null;
  const initialFrame = TRAJECTORY_FRAME_MARKS[1] ?? TRAJECTORY_FRAME_MARKS[0] ?? null;
  const [activePresetId, setActivePresetId] = useState(
    initialPreset?.id ?? "",
  );
  const [activeFrameId, setActiveFrameId] = useState<string | null>(
    initialFrame?.id ?? null,
  );
  const [origin, setOrigin] = useState(
    initialPreset?.origin ?? FALLBACK_POINT,
  );
  const [target, setTarget] = useState(
    initialFrame?.target ?? initialPreset?.target ?? FALLBACK_POINT,
  );
  const [uncertaintyDegrees, setUncertaintyDegrees] = useState(
    initialFrame?.uncertaintyDegrees ?? initialPreset?.uncertaintyDegrees ?? 1,
  );
  const [historicalWitnesses, setHistoricalWitnesses] = useState<
    DealeyPlazaWitness[]
  >([]);
  const [historicalWitnessStatus, setHistoricalWitnessStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const activePreset =
    TRAJECTORY_PRESETS.find((preset) => preset.id === activePresetId) ??
    initialPreset ??
    FALLBACK_PRESET;
  const activeFrame = getTrajectoryFrameMark(activeFrameId);
  const solution = useMemo(() => solveTrajectory(origin, target), [origin, target]);
  const sourceTrail = useMemo(
    () =>
      buildTrajectorySourceTrail({
        preset: activePreset,
        frameMark: activeFrame,
        origin,
        target,
        uncertaintyDegrees,
      }),
    [activeFrame, activePreset, origin, target, uncertaintyDegrees],
  );
  const frameComparisons = useMemo(
    () =>
      TRAJECTORY_FRAME_MARKS.map((frame) => ({
        frame,
        comparison: compareTrajectoryToPlanePoint({
          origin,
          target,
          point: frame.target,
          axis: "z",
          uncertaintyDegrees,
        }),
      })),
    [origin, target, uncertaintyDegrees],
  );
  const planBounds = useMemo(
    () =>
      buildTrajectoryPlanBounds([
        ...PLAN_LANDMARK_POINTS,
        origin,
        target,
        ...TRAJECTORY_FRAME_MARKS.map((frame) => frame.target),
        ...frameComparisons.flatMap(({ comparison }) =>
          comparison.intersection?.isWithinSegment
            ? [comparison.intersection.point]
            : [],
        ),
      ]),
    [frameComparisons, origin, target],
  );
  const uncertaintyRadiusFeet =
    Math.tan((uncertaintyDegrees * Math.PI) / 180) * solution.lineDistanceFeet;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    async function loadWitnesses() {
      try {
        const response = await fetch("/api/dealey-plaza", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Dealey Plaza witness request failed");
        const data = (await response.json()) as DealeyPlazaResponse;
        if (!cancelled) {
          setHistoricalWitnesses(data.witnesses);
          setHistoricalWitnessStatus("ready");
        }
      } catch {
        if (!cancelled) setHistoricalWitnessStatus("error");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    loadWitnesses();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  /**
   * Scene lifecycle: mount creates the Y-up Three.js scene, camera, renderer,
   * lights, landmarks, ray, and cone; animate renders the orbiting camera while
   * resize keeps the canvas fit to its panel. Cleanup removes the renderer DOM
   * node and disposes geometries/materials found by scene.traverse. The camera
   * tracks lookAt [4, 8, -18]. The cone is built pointing +Y, so orientation is
   * later set from +Y into the current ray direction.
   */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1ea);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    camera.position.set(88, 104, 126);
    camera.lookAt(4, 8, -18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = styles.canvas;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7f786b, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-58, 96, 42);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 170),
      new THREE.MeshStandardMaterial({ color: 0xded6c8, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    addGrid(scene);
    addLandmarks(scene);
    addElmStreet(scene);

    const originMesh = markerMesh(0xb3422f, 2.7);
    const targetMesh = markerMesh(0x1f6f8b, 3.1);
    scene.add(originMesh, targetMesh);

    const ray = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 }),
    );
    scene.add(ray);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(4.8, 34, 36, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xb3422f,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    scene.add(cone);

    objectsRef.current = { origin: originMesh, target: targetMesh, ray, cone };

    let frame = 0;
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = performance.now() * 0.00008;
      camera.position.x = 88 + Math.sin(t) * 8;
      camera.position.z = 126 + Math.cos(t) * 8;
      camera.lookAt(4, 8, -18);
      renderer.render(scene, camera);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        disposeSceneObject(object);
      });
      objectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const objects = objectsRef.current;
    if (!objects) return;

    const o = toVector(origin);
    const t = toVector(target);
    objects.origin.position.copy(o);
    objects.target.position.copy(t);
    objects.ray.geometry.dispose();
    objects.ray.geometry = new THREE.BufferGeometry().setFromPoints([o, t]);

    const midpoint = o.clone().lerp(t, 0.5);
    const direction = t.clone().sub(o);
    const lineDistance = direction.length();
    const coneRadius = Math.max(
      0.6,
      Math.tan((uncertaintyDegrees * Math.PI) / 180) * lineDistance,
    );
    objects.cone.position.copy(midpoint);
    objects.cone.scale.set(
      coneRadius / 4.8,
      Math.max(lineDistance / 34, 0.01),
      coneRadius / 4.8,
    );
    // Y-up convention: ConeGeometry points along +Y before this rotation.
    objects.cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
  }, [origin, target, uncertaintyDegrees]);

  const applyPreset = (presetId: string) => {
    const preset =
      TRAJECTORY_PRESETS.find((candidate) => candidate.id === presetId) ??
      initialPreset ??
      FALLBACK_PRESET;
    setActivePresetId(preset.id);
    setOrigin(preset.origin);
    setTarget(preset.target);
    setUncertaintyDegrees(preset.uncertaintyDegrees);
    setActiveFrameId(null);
  };

  const applyFrame = (frame: TrajectoryFrameMark) => {
    setActiveFrameId(frame.id);
    setTarget(frame.target);
    setUncertaintyDegrees(frame.uncertaintyDegrees);
  };

  return (
    <div className={styles.shell}>
      <section className={styles.scenePanel} aria-label="Dealey Plaza 3D trajectory scene">
        <div className={styles.scene} ref={mountRef}>
          <div className={styles.hud} aria-label="Trajectory readout">
            <HudItem label="Line distance" value={formatFeet(solution.lineDistanceFeet)} />
            <HudItem label="Horizontal" value={formatFeet(solution.horizontalDistanceFeet)} />
            <HudItem label="Elevation" value={formatDegrees(solution.elevationAngleDegrees)} />
            <HudItem label="Azimuth" value={formatDegrees(solution.azimuthDegrees)} />
          </div>
        </div>
        <PlanView
          origin={origin}
          target={target}
          activeFrameId={activeFrameId}
          frameComparisons={frameComparisons}
          bounds={planBounds}
        />
        <HistoricalImageOverlay
          origin={origin}
          target={target}
          activeFrameId={activeFrameId}
          uncertaintyDegrees={uncertaintyDegrees}
          witnesses={historicalWitnesses}
          witnessStatus={historicalWitnessStatus}
        />
      </section>

      <aside className={styles.side}>
        <Panel title="Ray Controls">
          <label className={styles.selectControl}>
            <span className={styles.selectLabel}>Scenario preset</span>
            <select
              className={styles.select}
              value={activePresetId}
              onChange={(event) => applyPreset(event.target.value)}
            >
              {TRAJECTORY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.presetSummary}>{activePreset.summary}</p>
          <div className={styles.frameSelector}>
            <div id={frameSelectorLabelId} className="eyebrow">
              Zapruder frame timeline selector
            </div>
            <div
              className={styles.frameRail}
              role="group"
              aria-labelledby={frameSelectorLabelId}
            >
              {TRAJECTORY_FRAME_MARKS.map((frame) => (
                <button
                  key={frame.id}
                  className={styles.frameButton}
                  type="button"
                  aria-pressed={activeFrameId === frame.id}
                  onClick={() => applyFrame(frame)}
                >
                  <span className={styles.frameNumber}>Z{frame.frame}</span>
                  <span className={styles.frameLabel}>{frame.label}</span>
                  <span className={styles.frameTime}>
                    +{frame.timeSeconds.toFixed(2)}s
                  </span>
                </button>
              ))}
            </div>
          </div>
          <ControlGroup
            title="Origin"
            point={origin}
            controls={ORIGIN_CONTROLS}
            onChange={(next) => {
              setOrigin(next);
              setActiveFrameId(null);
            }}
          />
          <ControlGroup
            title="Target"
            point={target}
            controls={TARGET_CONTROLS}
            onChange={(next) => {
              setTarget(next);
              setActiveFrameId(null);
            }}
          />
          <div className={styles.controlGroup}>
            <div className="eyebrow">Uncertainty</div>
            <label className={styles.control}>
              <span className={styles.controlLabel}>
                Angular tolerance
                <span className={styles.controlValue}>
                  {formatDegrees(uncertaintyDegrees)}
                </span>
              </span>
              <input
                className={styles.range}
                type="range"
                min={0.5}
                max={8}
                step={0.1}
                value={uncertaintyDegrees}
                onChange={(event) => {
                  setUncertaintyDegrees(Number(event.target.value));
                  setActiveFrameId(null);
                }}
              />
            </label>
          </div>
        </Panel>

        <Panel title="Deterministic Math">
          <div className={styles.metricGrid}>
            <Metric label="Delta X" value={formatFeet(solution.dx)} />
            <Metric label="Delta Y" value={formatFeet(solution.dy)} />
            <Metric label="Delta Z" value={formatFeet(solution.dz)} />
            <Metric
              label={`Flight @ ${DEFAULT_MUZZLE_VELOCITY_FPS} fps`}
              value={`${solution.timeOfFlightSeconds.toFixed(3)} s`}
            />
            <Metric label="Cone radius" value={formatFeet(uncertaintyRadiusFeet)} />
          </div>
        </Panel>

        <Panel title="Frame Intersections">
          <p className={styles.panelNote}>
            Each row projects the active ray through a frame target&apos;s
            north/south plane and compares that crossing to the sourced frame
            marker.
          </p>
          <div className={styles.intersectionList}>
            {frameComparisons.map(({ frame, comparison }) => (
              <FrameIntersectionRow
                key={frame.id}
                frame={frame}
                comparison={comparison}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Assumptions">
          <ul className={styles.assumptionList}>
            <Assumption
              name="Coordinate frame"
              source="Approximate plaza-relative feet: X east/west, Y elevation, Z north/south."
            />
            <Assumption
              name="TSBD origin"
              source="Placeholder sixth-floor window position for geometry only."
            />
            <Assumption
              name="Target body point"
              source="Adjustable point representing a generic impact/intersection location."
            />
            <Assumption
              name="Physics scope"
              source="Straight-line ray and travel-time readout; no drag, tumbling, deflection, or wound-ballistics model."
            />
            {activePreset.sources.map((source) => (
              <Assumption
                key={`${activePreset.id}-${source.label}`}
                name={source.label}
                source={source.note}
              />
            ))}
          </ul>
        </Panel>

        <Panel title="Source Trail">
          <ol className={styles.sourceTrail}>
            {sourceTrail.map((item) => (
              <SourceTrailItem key={item.id} item={item} />
            ))}
          </ol>
        </Panel>
      </aside>
    </div>
  );
}

function HistoricalImageOverlay({
  origin,
  target,
  activeFrameId,
  uncertaintyDegrees,
  witnesses,
  witnessStatus,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  activeFrameId: string | null;
  uncertaintyDegrees: number;
  witnesses: DealeyPlazaWitness[];
  witnessStatus: "loading" | "ready" | "error";
}) {
  const footprint = buildHistoricalTrajectoryFootprint({
    origin,
    target,
    uncertaintyDegrees,
  });
  const originPoint = projectTrajectoryPointToHistoricalImage(origin);
  const targetPoint = projectTrajectoryPointToHistoricalImage(target);
  const framePoints = TRAJECTORY_FRAME_MARKS.map((frame) => ({
    frame,
    point: projectTrajectoryPointToHistoricalImage(frame.target),
  }));
  const witnessPoints = witnesses.map((witness) => ({
    witness,
    point: projectWitnessToHistoricalImage(
      witness.positionLat,
      witness.positionLng,
    ),
  }));
  const witnessStatusLabel =
    witnessStatus === "ready"
      ? `${witnesses.length} witness positions`
      : witnessStatus === "loading"
        ? "Witness positions loading"
        : "Witness positions unavailable";

  return (
    <section
      className={styles.historicalPanel}
      aria-label="Historical Dealey Plaza image overlay"
    >
      <div className={styles.historicalHeader}>
        <div>
          <div className={styles.panelTitle}>Historical Image Overlay</div>
          <p className={styles.panelNote}>
            {HISTORICAL_DEALEY_IMAGE.title}.{" "}
            {HISTORICAL_DEALEY_IMAGE.calibrationNote}
          </p>
        </div>
        <a
          className={styles.historicalSource}
          href={HISTORICAL_DEALEY_IMAGE.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Image source
        </a>
      </div>
      <svg
        className={styles.historicalSvg}
        viewBox={`0 0 ${HISTORICAL_DEALEY_IMAGE.width} ${HISTORICAL_DEALEY_IMAGE.height}`}
        role="img"
        aria-label="Historical Dealey Plaza image with active trajectory, uncertainty footprint, frame markers, and witness positions"
      >
        <image
          href={HISTORICAL_DEALEY_IMAGE.imageUrl}
          width={HISTORICAL_DEALEY_IMAGE.width}
          height={HISTORICAL_DEALEY_IMAGE.height}
          preserveAspectRatio="xMidYMid meet"
        />
        <rect
          className={styles.historicalScrim}
          width={HISTORICAL_DEALEY_IMAGE.width}
          height={HISTORICAL_DEALEY_IMAGE.height}
        />
        <polygon
          className={styles.historicalCone}
          points={[
            footprint.origin,
            footprint.left,
            footprint.right,
          ]
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
        />
        <line
          className={styles.historicalRay}
          x1={originPoint.x}
          y1={originPoint.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
        />
        {witnessPoints.map(({ witness, point }) => (
          <circle
            key={witness.witnessId}
            className={styles.historicalWitness}
            data-origin={historicalWitnessTone(witness.shotOriginPerceived)}
            cx={point.x}
            cy={point.y}
            r="3.7"
          >
            <title>{`${witness.name}: ${witness.positionDescription}`}</title>
          </circle>
        ))}
        {framePoints.map(({ frame, point }) => (
          <g key={frame.id}>
            <circle
              className={styles.historicalFrame}
              data-active={activeFrameId === frame.id}
              cx={point.x}
              cy={point.y}
              r={activeFrameId === frame.id ? 6 : 4.4}
            />
            <text
              className={styles.historicalFrameLabel}
              x={point.x + 7}
              y={point.y - 7}
            >
              Z{frame.frame}
            </text>
          </g>
        ))}
        <circle
          className={styles.historicalOrigin}
          cx={originPoint.x}
          cy={originPoint.y}
          r="6"
        />
        <circle
          className={styles.historicalTarget}
          cx={targetPoint.x}
          cy={targetPoint.y}
          r="6"
        />
      </svg>
      <div className={styles.historicalFooter}>
        <div className={styles.historicalLegend} aria-hidden="true">
          <span><i className={styles.legendOrigin} /> Origin</span>
          <span><i className={styles.legendTarget} /> Target</span>
          <span><i className={styles.legendCrossing} /> Frame</span>
          <span><i className={styles.legendWitness} /> Witness</span>
        </div>
        <div className={styles.historicalMeta}>
          {witnessStatusLabel} / fit residuals: ray{" "}
          {HISTORICAL_MAP_CALIBRATION.trajectoryResidualPixels.toFixed(1)} px,
          witnesses{" "}
          {HISTORICAL_MAP_CALIBRATION.witnessResidualPixels.toFixed(1)} px
        </div>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>{title}</div>
      {children}
    </section>
  );
}

function HudItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.hudItem}>
      <span className={styles.hudLabel}>{label}</span>
      <span className={styles.hudValue}>{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function PlanView({
  origin,
  target,
  activeFrameId,
  frameComparisons,
  bounds,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  activeFrameId: string | null;
  frameComparisons: Array<{
    frame: TrajectoryFrameMark;
    comparison: TrajectoryPlanePointComparison;
  }>;
  bounds: ReturnType<typeof buildTrajectoryPlanBounds>;
}) {
  const originPoint = projectPlanPoint(origin, bounds);
  const targetPoint = projectPlanPoint(target, bounds);
  const elmStreetPath = [
    projectPlanPoint({ x: -86, y: 0, z: 10 }, bounds),
    projectPlanPoint({ x: -26, y: 0, z: -16 }, bounds),
    projectPlanPoint({ x: 28, y: 0, z: -48 }, bounds),
    projectPlanPoint({ x: 78, y: 0, z: -84 }, bounds),
  ];

  return (
    <section className={styles.planPanel} aria-label="Linked 2D trajectory plan view">
      <div className={styles.planHeader}>
        <div>
          <div className={styles.panelTitle}>Linked 2D Plan View</div>
          <p className={styles.panelNote}>
            Top-down X/Z projection using the same active ray, frame markers,
            and intersection math as the 3D scene.
          </p>
        </div>
        <div className={styles.planLegend} aria-hidden="true">
          <span><i className={styles.legendOrigin} /> Origin</span>
          <span><i className={styles.legendTarget} /> Target</span>
          <span><i className={styles.legendCrossing} /> Crossing</span>
        </div>
      </div>
      <svg
        className={styles.planSvg}
        viewBox={`0 0 ${PLAN_VIEW_WIDTH} ${PLAN_VIEW_HEIGHT}`}
        role="img"
        aria-label="Top-down plan view of the active trajectory ray and frame intersections"
      >
        <rect
          className={styles.planGround}
          x="0"
          y="0"
          width={PLAN_VIEW_WIDTH}
          height={PLAN_VIEW_HEIGHT}
        />
        <polyline
          className={styles.planRoad}
          points={elmStreetPath.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        <rect
          className={styles.planTsbd}
          x={projectPlanPoint({ x: -79, y: 0, z: 59 }, bounds).x}
          y={projectPlanPoint({ x: -79, y: 0, z: 59 }, bounds).y}
          width="56"
          height="38"
          rx="2"
        />
        <line
          className={styles.planRay}
          x1={originPoint.x}
          y1={originPoint.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
        />
        {frameComparisons.map(({ frame, comparison }) => {
          const framePoint = projectPlanPoint(frame.target, bounds);
          const crossing = comparison.intersection?.isWithinSegment
            ? projectPlanPoint(comparison.intersection.point, bounds)
            : null;

          return (
            <g key={frame.id}>
              <circle
                className={styles.planFramePoint}
                data-active={activeFrameId === frame.id}
                cx={framePoint.x}
                cy={framePoint.y}
                r={activeFrameId === frame.id ? 5 : 3.5}
              />
              <text
                className={styles.planFrameLabel}
                x={framePoint.x + 7}
                y={framePoint.y - 6}
              >
                Z{frame.frame}
              </text>
              {crossing ? (
                <circle
                  className={styles.planCrossing}
                  cx={crossing.x}
                  cy={crossing.y}
                  r="4"
                />
              ) : null}
            </g>
          );
        })}
        <circle
          className={styles.planOrigin}
          cx={originPoint.x}
          cy={originPoint.y}
          r="6"
        />
        <circle
          className={styles.planTarget}
          cx={targetPoint.x}
          cy={targetPoint.y}
          r="6"
        />
      </svg>
    </section>
  );
}

function FrameIntersectionRow({
  frame,
  comparison,
}: {
  frame: TrajectoryFrameMark;
  comparison: TrajectoryPlanePointComparison;
}) {
  const { intersection, missDistanceFeet, coneRadiusFeet } = comparison;
  const hasCrossing =
    intersection !== null &&
    intersection.isWithinSegment &&
    missDistanceFeet !== null &&
    coneRadiusFeet !== null;
  const status = !hasCrossing
    ? "Outside ray"
    : comparison.isWithinCone
      ? "Inside cone"
      : "Misses cone";
  const crossing = hasCrossing
    ? `Crosses at X ${intersection.point.x.toFixed(1)} / Y ${intersection.point.y.toFixed(1)}`
    : "No crossing inside the current ray segment";

  return (
    <div className={styles.intersectionRow}>
      <div className={styles.intersectionHeader}>
        <div>
          <div className={styles.intersectionFrame}>Z{frame.frame}</div>
          <div className={styles.intersectionLabel}>{frame.label}</div>
        </div>
        <span className={styles.intersectionStatus} data-state={status}>
          {status}
        </span>
      </div>
      <div className={styles.intersectionDetail}>{crossing}</div>
      <div className={styles.intersectionMetrics}>
        <span>
          Miss{" "}
          <strong>
            {missDistanceFeet === null
              ? "n/a"
              : formatFeet(missDistanceFeet)}
          </strong>
        </span>
        <span>
          Cone{" "}
          <strong>
            {coneRadiusFeet === null
              ? "n/a"
              : formatFeet(coneRadiusFeet)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function projectPlanPoint(
  point: TrajectoryPoint,
  bounds: ReturnType<typeof buildTrajectoryPlanBounds>,
) {
  return projectTrajectoryPlanPoint({
    point,
    bounds,
    width: PLAN_VIEW_WIDTH,
    height: PLAN_VIEW_HEIGHT,
    padding: PLAN_VIEW_PADDING,
  });
}

function Assumption({ name, source }: { name: string; source: string }) {
  return (
    <li className={styles.assumption}>
      <div className={styles.assumptionName}>{name}</div>
      <div className={styles.assumptionSource}>{source}</div>
    </li>
  );
}

function SourceTrailItem({ item }: { item: TrajectorySourceTrailItem }) {
  const value = item.href ? (
    <a className={styles.sourceLink} href={item.href}>
      {item.value}
    </a>
  ) : (
    item.value
  );

  return (
    <li className={styles.sourceTrailItem}>
      <div className={styles.sourceTrailLabel}>{item.label}</div>
      <div className={styles.sourceTrailValue}>{value}</div>
      <div className={styles.sourceTrailDetail}>{item.detail}</div>
    </li>
  );
}

function ControlGroup({
  title,
  point,
  controls,
  onChange,
}: {
  title: string;
  point: TrajectoryPoint;
  controls: ControlSpec[];
  onChange: (next: TrajectoryPoint) => void;
}) {
  return (
    <div className={styles.controlGroup}>
      <div className="eyebrow">{title}</div>
      {controls.map((control) => (
        <label key={control.label} className={styles.control}>
          <span className={styles.controlLabel}>
            {control.label}
            <span className={styles.controlValue}>
              {formatFeet(point[control.key])}
            </span>
          </span>
          <input
            className={styles.range}
            type="range"
            min={control.min}
            max={control.max}
            step={control.step ?? 1}
            value={point[control.key]}
            onChange={(event) =>
              onChange({
                ...point,
                [control.key]: Number(event.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

function markerMesh(color: number, radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
  );
  mesh.castShadow = true;
  return mesh;
}

function toVector(point: TrajectoryPoint): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function addGrid(scene: THREE.Scene) {
  const grid = new THREE.GridHelper(220, 22, 0x9c9488, 0xc7bdae);
  grid.position.y = 0.03;
  scene.add(grid);
}

function addLandmarks(scene: THREE.Scene) {
  const tsbd = new THREE.Mesh(
    new THREE.BoxGeometry(42, 72, 34),
    new THREE.MeshStandardMaterial({ color: 0x8e715a, roughness: 0.82 }),
  );
  tsbd.position.set(-58, 36, 42);
  tsbd.castShadow = true;
  tsbd.receiveShadow = true;
  scene.add(tsbd);

  const windowMarker = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2d2520, roughness: 0.6 }),
  );
  windowMarker.position.set(-48, 62, 24.7);
  scene.add(windowMarker);

  const knoll = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 32, 7, 40),
    new THREE.MeshStandardMaterial({ color: 0x98a86a, roughness: 0.92 }),
  );
  knoll.position.set(46, 3.5, 20);
  knoll.scale.z = 0.58;
  scene.add(knoll);

  const underpass = new THREE.Mesh(
    new THREE.BoxGeometry(96, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x7f766c, roughness: 0.9 }),
  );
  underpass.position.set(22, 8, -88);
  underpass.castShadow = true;
  scene.add(underpass);
}

function addElmStreet(scene: THREE.Scene) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-86, 0.15, 10),
    new THREE.Vector3(-26, 0.15, -16),
    new THREE.Vector3(28, 0.15, -48),
    new THREE.Vector3(78, 0.15, -84),
  ]);
  const geometry = new THREE.TubeGeometry(curve, 80, 6, 10, false);
  const material = new THREE.MeshStandardMaterial({ color: 0x4b4f50, roughness: 0.86 });
  const road = new THREE.Mesh(geometry, material);
  road.receiveShadow = true;
  scene.add(road);

  const stripe = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
    new THREE.LineBasicMaterial({ color: 0xe8dcc5 }),
  );
  stripe.position.y = 0.28;
  scene.add(stripe);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
  } else {
    material.dispose();
  }
}

function disposeSceneObject(object: THREE.Object3D) {
  if (
    object instanceof THREE.Mesh ||
    object instanceof THREE.Line ||
    object instanceof THREE.GridHelper
  ) {
    object.geometry.dispose();
    disposeMaterial(object.material);
  }
}

function historicalWitnessTone(origin: string | null): string {
  switch (origin) {
    case "Texas School Book Depository":
      return "tsbd";
    case "Grassy knoll / stockade fence":
      return "knoll";
    case "Triple underpass area":
      return "underpass";
    default:
      return "unknown";
  }
}
