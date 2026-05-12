import type { TrajectoryPreset } from "./trajectory-presets";
import type { TrajectoryPoint } from "./trajectory";

export type TrajectorySourceReference = {
  id: string;
  label: string;
  kind: "record" | "film" | "model" | "assumption";
  note: string;
  href?: string;
};

export type TrajectoryFrameMark = {
  id: string;
  label: string;
  frame: number;
  timeSeconds: number;
  summary: string;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
  sourceIds: string[];
};

export type TrajectorySourceTrailItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export const TRAJECTORY_SOURCE_REFERENCES: TrajectorySourceReference[] = [
  {
    id: "wc-report-1964",
    label: "Warren Commission report",
    kind: "record",
    href: "/document/wc-report-1964",
    note: "Primary report page used here as a stable entry point for Commission-era timing, exhibit, and scene references.",
  },
  {
    id: "zapruder-film",
    label: "Zapruder film evidence item",
    kind: "film",
    href: "/evidence/zapruder-film",
    note: "Visual timing reference for frame-labeled comparison points. This sandbox uses frame markers as navigation aids, not as forensic conclusions.",
  },
  {
    id: "dealey-plaza-topic",
    label: "Dealey Plaza topic dossier",
    kind: "record",
    href: "/topic/dealey-plaza",
    note: "Topic context for the plaza geography, witness map, and source records connected to the scene.",
  },
  {
    id: "coordinate-frame",
    label: "Plaza-relative coordinate frame",
    kind: "model",
    note: "Approximate local feet with +X east/right, +Y elevation, and +Z north/forward. Coordinates are current model inputs, not survey-grade measurements.",
  },
];

export const TRAJECTORY_FRAME_MARKS: TrajectoryFrameMark[] = [
  {
    id: "z210",
    label: "Approach window",
    frame: 210,
    timeSeconds: 0,
    summary:
      "Representative pre-impact marker for comparing line geometry before the main impact frames.",
    target: { x: 38, y: 5, z: -50 },
    uncertaintyDegrees: 3.6,
    sourceIds: ["zapruder-film", "dealey-plaza-topic", "coordinate-frame"],
  },
  {
    id: "z225",
    label: "Reaction window",
    frame: 225,
    timeSeconds: 0.82,
    summary:
      "Approximate timing checkpoint after the limousine has moved farther down Elm Street.",
    target: { x: 46, y: 5, z: -58 },
    uncertaintyDegrees: 3.1,
    sourceIds: ["zapruder-film", "wc-report-1964", "coordinate-frame"],
  },
  {
    id: "z313",
    label: "Head-shot frame",
    frame: 313,
    timeSeconds: 5.64,
    summary:
      "Common frame reference for trajectory comparisons. The coordinate point remains schematic and adjustable.",
    target: { x: 58, y: 7, z: -70 },
    uncertaintyDegrees: 4.4,
    sourceIds: ["zapruder-film", "wc-report-1964", "dealey-plaza-topic", "coordinate-frame"],
  },
];

export function getTrajectoryFrameMark(
  id: string | null,
): TrajectoryFrameMark | null {
  if (!id) return null;
  return TRAJECTORY_FRAME_MARKS.find((mark) => mark.id === id) ?? null;
}

export function getTrajectorySourceReferences(
  ids: string[],
): TrajectorySourceReference[] {
  const seen = new Set<string>();
  const refs: TrajectorySourceReference[] = [];

  ids.forEach((id) => {
    if (seen.has(id)) return;
    const ref = TRAJECTORY_SOURCE_REFERENCES.find((source) => source.id === id);
    if (!ref) return;
    seen.add(id);
    refs.push(ref);
  });

  return refs;
}

export function buildTrajectorySourceTrail({
  preset,
  frameMark,
  origin,
  target,
  uncertaintyDegrees,
}: {
  preset: TrajectoryPreset;
  frameMark: TrajectoryFrameMark | null;
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
}): TrajectorySourceTrailItem[] {
  const sourceRefs = getTrajectorySourceReferences([
    ...(frameMark?.sourceIds ?? []),
    "coordinate-frame",
  ]);

  return [
    {
      id: "preset",
      label: "Scenario preset",
      value: preset.name,
      detail: preset.summary,
    },
    {
      id: "frame",
      label: "Frame marker",
      value: frameMark ? `Z${frameMark.frame} · ${frameMark.label}` : "Manual target",
      detail: frameMark
        ? frameMark.summary
        : "The current target or tolerance has been adjusted manually from the frame presets.",
    },
    {
      id: "origin",
      label: "Origin coordinate",
      value: formatPoint(origin),
      detail: "Current origin slider values in the plaza-relative coordinate frame.",
    },
    {
      id: "target",
      label: "Target coordinate",
      value: formatPoint(target),
      detail: "Current target slider values used by the deterministic ray solver.",
    },
    {
      id: "uncertainty",
      label: "Uncertainty cone",
      value: `${uncertaintyDegrees.toFixed(1)} degrees`,
      detail:
        "Angular tolerance is visualized as a cone around the ray; it communicates model uncertainty, not probability.",
    },
    ...sourceRefs.map((source) => ({
      id: source.id,
      label: source.kind,
      value: source.label,
      detail: source.note,
      href: source.href,
    })),
  ];
}

function formatPoint(point: TrajectoryPoint): string {
  return `X ${point.x.toFixed(1)} / Y ${point.y.toFixed(1)} / Z ${point.z.toFixed(1)}`;
}
