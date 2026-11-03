"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPlaza1963, legacyToPlaza, PLAZA_VIEWS, type PlazaView } from "./plaza-1963";
import type { DealeyPlazaWitness } from "@/lib/api-types";
import { DEFAULT_MUZZLE_VELOCITY_FPS } from "@/lib/constants";
import type { HistoricalWitnessStatus } from "@/lib/api-client";
import {
  HISTORICAL_DEALEY_IMAGE,
  HISTORICAL_MAP_CALIBRATION,
  buildHistoricalTrajectoryFootprint,
  projectTrajectoryPointToHistoricalImage,
  projectWitnessToHistoricalImage,
} from "@/lib/historical-map-overlay";
import {
  TRAJECTORY_FRAME_MARKS,
  buildTrajectoryFrameSample,
  buildTrajectorySourceTrail,
  type TrajectoryFrameMark,
  type TrajectoryFrameSample,
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

type TrajectorySandboxProps = {
  historicalWitnesses: DealeyPlazaWitness[];
  historicalWitnessStatus: HistoricalWitnessStatus;
};

export function TrajectorySandbox({
  historicalWitnesses,
  historicalWitnessStatus,
}: TrajectorySandboxProps) {
  const frameSelectorLabelId = useId();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraActions = useRef<{ view: (v: PlazaView) => void; zoom: (factor: number) => void; render: () => void; labels: (v:boolean) => void } | null>(null);
  const [view, setView] = useState<PlazaView>("overview");
  const [lowPower, setLowPower] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [showRay, setShowRay] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const objectsRef = useRef<{
    origin: THREE.Mesh;
    target: THREE.Mesh;
    ray: THREE.Line;
    cone: THREE.Mesh;
  } | null>(null);
  const initialPreset = TRAJECTORY_PRESETS[0] ?? null;
  const initialFrame = TRAJECTORY_FRAME_MARKS[1] ?? TRAJECTORY_FRAME_MARKS[0] ?? null;
  const initialFrameSample = initialFrame
    ? buildTrajectoryFrameSample(initialFrame.frame)
    : null;
  const [activePresetId, setActivePresetId] = useState(
    initialPreset?.id ?? "",
  );
  const [activeFrameSample, setActiveFrameSample] =
    useState<TrajectoryFrameSample | null>(
      initialFrameSample,
    );
  const [frameScrubberValue, setFrameScrubberValue] = useState(
    initialFrameSample?.frame ?? initialFrame?.frame ?? 0,
  );
  const [origin, setOrigin] = useState(
    initialPreset?.origin ?? FALLBACK_POINT,
  );
  const [target, setTarget] = useState(
    initialFrameSample?.target ??
      initialFrame?.target ??
      initialPreset?.target ??
      FALLBACK_POINT,
  );
  const [uncertaintyDegrees, setUncertaintyDegrees] = useState(
    initialFrameSample?.uncertaintyDegrees ??
      initialFrame?.uncertaintyDegrees ??
      initialPreset?.uncertaintyDegrees ??
      1,
  );

  const activePreset =
    TRAJECTORY_PRESETS.find((preset) => preset.id === activePresetId) ??
    initialPreset ??
    FALLBACK_PRESET;
  const activeFrame = activeFrameSample?.exactMark ?? null;
  const activeFrameId = activeFrame?.id ?? null;
  const solution = useMemo(() => solveTrajectory(origin, target), [origin, target]);
  const sourceTrail = useMemo(
    () =>
      buildTrajectorySourceTrail({
        preset: activePreset,
        frameMark: activeFrame,
        frameSample: activeFrameSample,
        origin,
        target,
        uncertaintyDegrees,
      }),
    [
      activeFrame,
      activeFrameSample,
      activePreset,
      origin,
      target,
      uncertaintyDegrees,
    ],
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

  /**
   * Scene lifecycle: mount creates the Y-up Three.js scene, camera, renderer,
   * lights, landmarks, ray, and cone; controls render on demand while
   * resize keeps the canvas fit to its panel. Cleanup removes the renderer DOM
   * node and disposes geometries/materials found by scene.traverse. The camera
   * uses the selected historical vicinity. The cone is built pointing +Y, so orientation is
   * later set from +Y into the current ray direction.
   */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd4dfdf);
    scene.fog = new THREE.Fog(0xd4dfdf, 1000, 2100);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.5, 2500);

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: !lowPower }); }
    catch { setSceneError(true); return; }
    setSceneError(false);
    renderer.setPixelRatio(lowPower ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = styles.canvas;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "1963 Dealey Plaza reconstruction. Drag to orbit, scroll or pinch to zoom. Use viewpoint and zoom buttons for keyboard navigation.");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf6f4e7, 0x6a7761, 2));
    const sun = new THREE.DirectionalLight(0xffecd0, 2.8);
    sun.position.set(-170, 480, 300);
    sun.castShadow = !lowPower;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -650, right: 650, top: 500, bottom: -500, far: 1400 });
    sun.shadow.normalBias = .45;
    scene.add(sun);
    const plaza = buildPlaza1963(scene);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 5; controls.maxDistance = 1300;
    controls.maxPolarAngle = Math.PI * .49;
    controls.enableDamping = false;
    const render = () => {
      // Keep annotations legible without letting them fill street-level views.
      const h = Math.max(mount.clientHeight, 1);
      scene.traverse(object => {
        if (object.userData.label) {
          const size = camera.position.distanceTo(object.position) * 2 * Math.tan(43 * Math.PI / 360) * 22 / h;
          object.scale.set(size * 8, size, 1);
        }
      });
      renderer.render(scene, camera);
    };
    const setView = (v: PlazaView) => {
      const preset = PLAZA_VIEWS[v];
      camera.position.set(preset.eye[0], preset.eye[1], preset.eye[2]);
      controls.target.set(preset.at[0], preset.at[1], preset.at[2]);
      controls.update(); render();
    };
    cameraActions.current = { view: setView, render,
      zoom: factor => { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); render(); },
      labels: visible => { plaza.setLabels(visible); render(); },
    };
    controls.addEventListener("change", render);

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

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
      render();
    };
    const contextLost = (e: Event) => { e.preventDefault(); setSceneError(true); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    resize();
    setView("overview");
    const observer = new ResizeObserver(resize); observer.observe(mount);

    return () => {
      observer.disconnect(); controls.dispose(); cameraActions.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        disposeSceneObject(object);
      });
      objectsRef.current = null;
    };
  }, [lowPower]);

  useEffect(() => {
    cameraActions.current?.view(view);
  }, [view, lowPower]);

  useEffect(() => {
    cameraActions.current?.labels(showLabels);
  }, [showLabels, lowPower]);

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
    for (const object of [objects.origin, objects.target, objects.ray, objects.cone]) object.visible = showRay;
    cameraActions.current?.render();
  }, [origin, target, uncertaintyDegrees, showRay, lowPower]);

  const applyPreset = (presetId: string) => {
    const preset =
      TRAJECTORY_PRESETS.find((candidate) => candidate.id === presetId) ??
      initialPreset ??
      FALLBACK_PRESET;
    setActivePresetId(preset.id);
    setOrigin(preset.origin);
    setTarget(preset.target);
    setUncertaintyDegrees(preset.uncertaintyDegrees);
    setActiveFrameSample(null);
  };

  const applyFrame = (frame: TrajectoryFrameMark) => {
    applyFrameNumber(frame.frame);
  };

  const applyFrameNumber = (frameNumber: number) => {
    const sample = buildTrajectoryFrameSample(frameNumber);
    if (!sample) return;

    setFrameScrubberValue(sample.frame);
    setActiveFrameSample(sample);
    setTarget(sample.target);
    setUncertaintyDegrees(sample.uncertaintyDegrees);
  };

  return (
    <div className={styles.shell}>
      <section className={styles.scenePanel} aria-label="Dealey Plaza 3D trajectory scene">
        <div className={styles.sceneToolbar}>
          <div><span className="eyebrow">Dallas · November 1963</span><h2>Dealey Plaza</h2></div>
          <label>Viewpoint <select aria-label="Reconstruction viewpoint" value={view} onChange={e=>setView(e.target.value as PlazaView)}>
            {Object.entries(PLAZA_VIEWS).map(([id,v])=><option key={id} value={id}>{v.label}</option>)}
          </select></label>
          <button type="button" onClick={()=>cameraActions.current?.zoom(.8)} aria-label="Zoom in">+</button>
          <button type="button" onClick={()=>cameraActions.current?.zoom(1.25)} aria-label="Zoom out">−</button>
          <button type="button" onClick={()=>{setView("overview");cameraActions.current?.view("overview");}}>Reset view</button>
          <label><input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/> Labels</label>
          <label><input type="checkbox" checked={lowPower} onChange={e=>setLowPower(e.target.checked)}/> Low power</label>
          <label><input type="checkbox" checked={showRay} onChange={e=>setShowRay(e.target.checked)}/> Legacy ray</label>
        </div>
        {showRay && <p className={styles.reconstructionNotice} role="status">Legacy ray: provisional anchors, uncalibrated to the reconstructed architecture. The readouts and plan use the original sandbox coordinates.</p>}
        <div className={styles.scene} ref={mountRef}>
          {sceneError && <div className={styles.sceneFallback} role="status">3D rendering is unavailable. The interactive plan, historical overlay and trajectory controls below remain available. Try low power mode to restart the renderer.</div>}
          <div className={styles.sceneCaption}>Drag to orbit · wheel / pinch to zoom · right drag to pan</div>
          <div className={styles.hud} aria-label="Trajectory readout">
            <HudItem label="Line distance" value={formatFeet(solution.lineDistanceFeet)} />
            <HudItem label="Horizontal" value={formatFeet(solution.horizontalDistanceFeet)} />
            <HudItem label="Elevation" value={formatDegrees(solution.elevationAngleDegrees)} />
            <HudItem label="Azimuth" value={formatDegrees(solution.azimuthDegrees)} />
          </div>
        </div>
        <details className={styles.reconstructionNotes}>
          <summary>Reconstruction sources, accuracy and usage</summary>
          <p>Source-informed architectural reconstruction. Documented anchors: 40 ft roadways, 10 ft outer sidewalks, approximately 24 ft fall from Houston to the underpass, and a 94 ft depository height (CE877). The depository footprint is 100 × 100 ft (TSHA). Curves, slopes between anchors, facade details, vegetation and street furniture are visual approximations.</p>
          <p>The legacy ray keeps its original feet and straight-line math, with a rigid rotation and translation for orientation. Its provisional anchors have not been registered to this scene. It is hidden initially; enabling it does not establish a window, vehicle position, sightline or shot source. The plan and historical overlay retain their existing schematic coordinate frame.</p>
          <ul>
            <li><a href="https://www.archives.gov/research/jfk/warren-commission-report/chapter-2.html">NARA: CE876 plaza diagram and CE2114–2116 photographs / plans</a></li>
            <li><a href="https://www.history-matters.com/archive/jfk/wc/wcvols/wh17/pdf/WH17_CE_877.pdf">CE877: contemporary physical description</a></li>
            <li><a href="https://aarclibrary.org/publib/jfk/wc/wcvols/wh17/pdf/WH17_CE_882.pdf">CE882: survey tracing reference (not calibrated here)</a></li>
            <li><a href="https://texashistory.unt.edu/ark:/67531/metapth184960/">Dallas Times Herald photograph, November 23, 1963; Sixth Floor Museum / UNT</a></li>
            <li><a href="https://www.tshaonline.org/handbook/entries/texas-school-book-depository">TSHA: depository dimensions and history</a></li>
            <li><a href="https://npgallery.nps.gov/AssetDetail/NRIS/93001607">NPS: Dealey Plaza Historic District nomination</a></li>
            <li><a href="https://www3.dallascityhall.com/committee_briefings/briefings0511/QOL_Combined_052311.pdf">City of Dallas: historic drawings and renovation briefing (2011)</a></li>
          </ul>
          <p>All reconstruction meshes and lettering are original procedural geometry. Archival photographs are reference links, not imported textures. Lighting is illustrative; this scene is not survey-grade or a forensic reconstruction. Historical camera choices indicate a vicinity, not a calibrated lens or authenticated observer position.</p>
        </details>
        <PlanView
          origin={origin}
          target={target}
          activeFrameId={activeFrameId}
          frameSample={activeFrameSample}
          frameComparisons={frameComparisons}
          bounds={planBounds}
        />
        <HistoricalImageOverlay
          origin={origin}
          target={target}
          activeFrameId={activeFrameId}
          frameSample={activeFrameSample}
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
              Zapruder frame scrubber
            </div>
            <FrameScrubber
              labelId={frameSelectorLabelId}
              sample={activeFrameSample}
              value={frameScrubberValue}
              onChange={applyFrameNumber}
            />
            <div
              className={styles.frameRail}
              role="group"
              aria-label="Configured Zapruder frame markers"
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
              setActiveFrameSample(null);
            }}
          />
          <ControlGroup
            title="Target"
            point={target}
            controls={TARGET_CONTROLS}
            onChange={(next) => {
              setTarget(next);
              setActiveFrameSample(null);
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
                  setActiveFrameSample(null);
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
  frameSample,
  uncertaintyDegrees,
  witnesses,
  witnessStatus,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  activeFrameId: string | null;
  frameSample: TrajectoryFrameSample | null;
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
        {HISTORICAL_MAP_CALIBRATION.trajectoryControlPoints.map((control) => (
          <g key={control.id} className={styles.historicalCalibrationPoint}>
            <line
              x1={control.image.x - 5}
              y1={control.image.y}
              x2={control.image.x + 5}
              y2={control.image.y}
            />
            <line
              x1={control.image.x}
              y1={control.image.y - 5}
              x2={control.image.x}
              y2={control.image.y + 5}
            />
            <circle cx={control.image.x} cy={control.image.y} r="2.6" />
            <title>{control.label}</title>
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
        {frameSample ? (
          <text
            className={styles.historicalActiveFrameLabel}
            x={targetPoint.x + 8}
            y={targetPoint.y + 16}
          >
            Z{frameSample.frame}
          </text>
        ) : null}
      </svg>
      <div className={styles.historicalFooter}>
        <div className={styles.historicalLegend} aria-hidden="true">
          <span><i className={styles.legendOrigin} /> Origin</span>
          <span><i className={styles.legendTarget} /> Target</span>
          <span><i className={styles.legendCrossing} /> Frame</span>
          <span><i className={styles.legendWitness} /> Witness</span>
          <span><i className={styles.legendCalibration} /> Fit point</span>
        </div>
        <div className={styles.historicalMetaGroup}>
          {frameSample ? (
            <span className={styles.historicalFrameMeta} aria-hidden="true">
              Z{frameSample.frame}
            </span>
          ) : null}
          <div
            className={styles.historicalMeta}
            aria-live="polite"
            aria-atomic="true"
          >
            {witnessStatusLabel} / fit residuals: ray{" "}
            {HISTORICAL_MAP_CALIBRATION.trajectoryResidualPixels.toFixed(1)} px,
            witnesses{" "}
            {HISTORICAL_MAP_CALIBRATION.witnessResidualPixels.toFixed(1)} px
          </div>
        </div>
      </div>
      <details className={styles.calibrationDetails}>
        <summary>Calibration diagnostics</summary>
        <div className={styles.calibrationStats}>
          <div>
            <span>Ray fit residual</span>
            <strong>
              {HISTORICAL_MAP_CALIBRATION.trajectoryResidualPixels.toFixed(1)} px
            </strong>
          </div>
          <div>
            <span>Witness fit residual</span>
            <strong>
              {HISTORICAL_MAP_CALIBRATION.witnessResidualPixels.toFixed(1)} px
            </strong>
          </div>
        </div>
        <ul className={styles.calibrationList}>
          {HISTORICAL_MAP_CALIBRATION.trajectoryControlPoints.map((control) => (
            <li key={control.id}>
              <span>{control.label}</span>
              <code>
                X {control.source.u.toFixed(1)} / Z {control.source.v.toFixed(1)} /
                px {control.image.x.toFixed(0)}, {control.image.y.toFixed(0)}
              </code>
            </li>
          ))}
        </ul>
      </details>
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

function FrameScrubber({
  labelId,
  sample,
  value,
  onChange,
}: {
  labelId: string;
  sample: TrajectoryFrameSample | null;
  value: number;
  onChange: (frameNumber: number) => void;
}) {
  const datalistId = useId();
  const firstFrame = TRAJECTORY_FRAME_MARKS[0];
  const lastFrame = TRAJECTORY_FRAME_MARKS[TRAJECTORY_FRAME_MARKS.length - 1];

  if (!firstFrame || !lastFrame) return null;

  const span = Math.max(lastFrame.frame - firstFrame.frame, 1);

  return (
    <div className={styles.frameScrubber}>
      <input
        className={styles.frameRange}
        type="range"
        min={firstFrame.frame}
        max={lastFrame.frame}
        step={1}
        value={value}
        list={datalistId}
        aria-labelledby={labelId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <datalist id={datalistId}>
        {TRAJECTORY_FRAME_MARKS.map((frame) => (
          <option key={frame.id} value={frame.frame} label={`Z${frame.frame}`} />
        ))}
      </datalist>
      <div className={styles.frameTicks} aria-hidden="true">
        {TRAJECTORY_FRAME_MARKS.map((frame) => (
          <span
            key={frame.id}
            style={{
              left: `${((frame.frame - firstFrame.frame) / span) * 100}%`,
            }}
          >
            Z{frame.frame}
          </span>
        ))}
      </div>
      <div className={styles.frameScrubberMeta}>
        <strong>{formatFrameSampleLabel(sample)}</strong>
        <span>{formatFrameSampleDetail(sample)}</span>
      </div>
    </div>
  );
}

function PlanView({
  origin,
  target,
  activeFrameId,
  frameSample,
  frameComparisons,
  bounds,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  activeFrameId: string | null;
  frameSample: TrajectoryFrameSample | null;
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
        {frameSample ? (
          <text
            className={styles.planActiveFrameLabel}
            x={targetPoint.x + 8}
            y={targetPoint.y + 15}
          >
            Z{frameSample.frame}
          </text>
        ) : null}
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
  return legacyToPlaza(point);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
  } else {
    if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
    material.dispose();
  }
}

function disposeSceneObject(object: THREE.Object3D) {
  if (
    object instanceof THREE.Mesh ||
    object instanceof THREE.Line ||
    object instanceof THREE.GridHelper || object instanceof THREE.Sprite
  ) {
    if ("geometry" in object) object.geometry.dispose();
    disposeMaterial(object.material);
  }
}

function formatFrameSampleLabel(sample: TrajectoryFrameSample | null): string {
  if (!sample) return "Manual target";
  if (sample.exactMark) {
    return `Z${sample.frame} - ${sample.exactMark.label}`;
  }
  return `Z${sample.frame} - interpolated`;
}

function formatFrameSampleDetail(sample: TrajectoryFrameSample | null): string {
  if (!sample) return "Current coordinates are driven by the manual controls.";
  if (sample.exactMark) {
    return `+${sample.timeSeconds.toFixed(2)}s / configured marker`;
  }
  return `+${sample.timeSeconds.toFixed(2)}s / ${Math.round(sample.interpolation * 100)}% from Z${sample.lowerMark.frame} to Z${sample.upperMark.frame}`;
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
