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

export type TrajectoryFrameSample = {
  frame: number;
  timeSeconds: number;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
  exactMark: TrajectoryFrameMark | null;
  lowerMark: TrajectoryFrameMark;
  upperMark: TrajectoryFrameMark;
  interpolation: number;
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

export function buildTrajectoryFrameSample(
  frame: number,
): TrajectoryFrameSample | null {
  const marks = [...TRAJECTORY_FRAME_MARKS].sort((a, b) => a.frame - b.frame);
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) return null;

  const requestedFrame = Number.isFinite(frame) ? Math.round(frame) : first.frame;
  const clampedFrame = Math.min(
    Math.max(requestedFrame, first.frame),
    last.frame,
  );
  const exactMark = marks.find((mark) => mark.frame === clampedFrame) ?? null;

  if (exactMark) {
    return {
      frame: exactMark.frame,
      timeSeconds: exactMark.timeSeconds,
      target: exactMark.target,
      uncertaintyDegrees: exactMark.uncertaintyDegrees,
      exactMark,
      lowerMark: exactMark,
      upperMark: exactMark,
      interpolation: 0,
    };
  }

  const upperIndex = marks.findIndex((mark) => mark.frame > clampedFrame);
  const upperMark = marks[upperIndex] ?? last;
  const lowerMark = marks[Math.max(upperIndex - 1, 0)] ?? first;
  const span = Math.max(upperMark.frame - lowerMark.frame, 1);
  const interpolation = (clampedFrame - lowerMark.frame) / span;

  return {
    frame: clampedFrame,
    timeSeconds: interpolate(
      lowerMark.timeSeconds,
      upperMark.timeSeconds,
      interpolation,
    ),
    target: {
      x: interpolate(lowerMark.target.x, upperMark.target.x, interpolation),
      y: interpolate(lowerMark.target.y, upperMark.target.y, interpolation),
      z: interpolate(lowerMark.target.z, upperMark.target.z, interpolation),
    },
    uncertaintyDegrees: interpolate(
      lowerMark.uncertaintyDegrees,
      upperMark.uncertaintyDegrees,
      interpolation,
    ),
    exactMark,
    lowerMark,
    upperMark,
    interpolation,
  };
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
  frameSample,
  origin,
  target,
  uncertaintyDegrees,
}: {
  preset: TrajectoryPreset;
  frameMark: TrajectoryFrameMark | null;
  frameSample?: TrajectoryFrameSample | null;
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
}): TrajectorySourceTrailItem[] {
  const frameSourceIds =
    frameMark?.sourceIds ??
    (frameSample
      ? [...frameSample.lowerMark.sourceIds, ...frameSample.upperMark.sourceIds]
      : []);
  const sourceRefs = getTrajectorySourceReferences([
    ...frameSourceIds,
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
      value: formatFrameTrailValue(frameMark, frameSample),
      detail: formatFrameTrailDetail(frameMark, frameSample),
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

function formatFrameTrailValue(
  frameMark: TrajectoryFrameMark | null,
  frameSample: TrajectoryFrameSample | null | undefined,
): string {
  if (frameMark) return `Z${frameMark.frame} - ${frameMark.label}`;
  if (frameSample) return `Z${frameSample.frame} interpolated`;
  return "Manual target";
}

function formatFrameTrailDetail(
  frameMark: TrajectoryFrameMark | null,
  frameSample: TrajectoryFrameSample | null | undefined,
): string {
  if (frameMark) return frameMark.summary;
  if (frameSample) {
    return `Interpolated ${Math.round(frameSample.interpolation * 100)}% from Z${frameSample.lowerMark.frame} to Z${frameSample.upperMark.frame}; target and tolerance come from the configured frame marker path.`;
  }
  return "The current target or tolerance has been adjusted manually from the frame presets.";
}

function formatPoint(point: TrajectoryPoint): string {
  return `X ${point.x.toFixed(1)} / Y ${point.y.toFixed(1)} / Z ${point.z.toFixed(1)}`;
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
