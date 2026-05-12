"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DEFAULT_MUZZLE_VELOCITY_FPS } from "@/lib/constants";
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
  formatDegrees,
  formatFeet,
  solveTrajectory,
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

export function TrajectorySandbox() {
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
  const uncertaintyRadiusFeet =
    Math.tan((uncertaintyDegrees * Math.PI) / 180) * solution.lineDistanceFeet;

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
