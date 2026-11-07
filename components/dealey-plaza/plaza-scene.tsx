"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPlaza1963, legacyToPlaza } from "./plaza-1963";
import {
  PLAZA_VIEWS,
  type PlazaCameraActions,
  type PlazaView,
} from "./plaza-1963-views";
import type { TrajectoryPoint } from "@/lib/trajectory";
import styles from "./trajectory-sandbox.module.css";

export type PlazaSceneProps = {
  view: PlazaView;
  lowPower: boolean;
  showLabels: boolean;
  showRay: boolean;
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
  onError: (failed: boolean) => void;
  cameraActionsRef: MutableRefObject<PlazaCameraActions | null>;
};

export default function PlazaScene({
  view,
  lowPower,
  showLabels,
  showRay,
  origin,
  target,
  uncertaintyDegrees,
  onError,
  cameraActionsRef,
}: PlazaSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const objectsRef = useRef<{
    origin: THREE.Mesh;
    target: THREE.Mesh;
    ray: THREE.Line;
    cone: THREE.Mesh;
  } | null>(null);

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
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !lowPower });
    } catch {
      onErrorRef.current(true);
      return;
    }
    onErrorRef.current(false);
    renderer.setPixelRatio(lowPower ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = styles.canvas;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "1963 Dealey Plaza reconstruction. Drag to orbit, scroll or pinch to zoom. Use viewpoint and zoom buttons for keyboard navigation.",
    );
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf6f4e7, 0x6a7761, 2));
    const sun = new THREE.DirectionalLight(0xffecd0, 2.8);
    sun.position.set(-170, 480, 300);
    sun.castShadow = !lowPower;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -650,
      right: 650,
      top: 500,
      bottom: -500,
      far: 1400,
    });
    sun.shadow.normalBias = 0.45;
    scene.add(sun);
    const plaza = buildPlaza1963(scene);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 5;
    controls.maxDistance = 1300;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enableDamping = false;
    const render = () => {
      // Keep annotations legible without letting them fill street-level views.
      const h = Math.max(mount.clientHeight, 1);
      scene.traverse((object) => {
        if (object.userData.label) {
          const size =
            camera.position.distanceTo(object.position) *
            2 *
            Math.tan((43 * Math.PI) / 360) *
            22 /
            h;
          object.scale.set(size * 8, size, 1);
        }
      });
      renderer.render(scene, camera);
    };
    const setView = (v: PlazaView) => {
      const preset = PLAZA_VIEWS[v];
      camera.position.set(preset.eye[0], preset.eye[1], preset.eye[2]);
      controls.target.set(preset.at[0], preset.at[1], preset.at[2]);
      controls.update();
      render();
    };
    cameraActionsRef.current = {
      view: setView,
      render,
      zoom: (factor) => {
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
        render();
      },
      labels: (visible) => {
        plaza.setLabels(visible);
        render();
      },
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
    const contextLost = (e: Event) => {
      e.preventDefault();
      onErrorRef.current(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    resize();
    setView("overview");
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      observer.disconnect();
      controls.dispose();
      cameraActionsRef.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        disposeSceneObject(object);
      });
      objectsRef.current = null;
    };
    // Recreate the renderer only when low-power settings change, matching
    // the previous sandbox lifecycle so orbit/zoom is not reset on re-render.
  }, [cameraActionsRef, lowPower]);

  useEffect(() => {
    cameraActionsRef.current?.view(view);
  }, [cameraActionsRef, view, lowPower]);

  useEffect(() => {
    cameraActionsRef.current?.labels(showLabels);
  }, [cameraActionsRef, showLabels, lowPower]);

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
    for (const object of [
      objects.origin,
      objects.target,
      objects.ray,
      objects.cone,
    ])
      object.visible = showRay;
    cameraActionsRef.current?.render();
  }, [
    cameraActionsRef,
    origin,
    target,
    uncertaintyDegrees,
    showRay,
    lowPower,
  ]);

  return <div ref={mountRef} className={styles.sceneMount} />;
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
    if ("map" in material && material.map instanceof THREE.Texture)
      material.map.dispose();
    material.dispose();
  }
}

function disposeSceneObject(object: THREE.Object3D) {
  if (
    object instanceof THREE.Mesh ||
    object instanceof THREE.Line ||
    object instanceof THREE.GridHelper ||
    object instanceof THREE.Sprite
  ) {
    if ("geometry" in object) object.geometry.dispose();
    disposeMaterial(object.material);
  }
}
