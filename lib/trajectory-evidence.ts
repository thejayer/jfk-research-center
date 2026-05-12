import {
  TRAJECTORY_FRAME_MARKS,
  TRAJECTORY_SOURCE_REFERENCES,
  type TrajectoryFrameMark,
  type TrajectorySourceReference,
} from "./constants";
import type { TrajectoryPreset } from "./trajectory-presets";
import type { TrajectoryPoint } from "./trajectory";

export type TrajectorySourceTrailItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export {
  TRAJECTORY_FRAME_MARKS,
  TRAJECTORY_SOURCE_REFERENCES,
  type TrajectoryFrameMark,
  type TrajectorySourceReference,
};

export function getTrajectoryFrameMark(
  id: string | null,
): TrajectoryFrameMark | null {
  if (!id) return null;
  return TRAJECTORY_FRAME_MARKS.find((mark) => mark.id === id) ?? null;
}

export function getTrajectorySourceReferences(
  ids: readonly string[],
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
