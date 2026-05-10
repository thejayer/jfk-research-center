import type { TrajectoryPoint } from "./trajectory";

export type TrajectoryPreset = {
  id: string;
  name: string;
  summary: string;
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
  sources: Array<{
    label: string;
    note: string;
  }>;
};

export const TRAJECTORY_PRESETS: TrajectoryPreset[] = [
  {
    id: "tsbd-window-generic",
    name: "TSBD window to generic target",
    summary:
      "Foundation preset matching the initial sandbox ray. Coordinates are provisional scene anchors.",
    origin: { x: -48, y: 62, z: 36 },
    target: { x: 46, y: 5, z: -58 },
    uncertaintyDegrees: 2.1,
    sources: [
      {
        label: "Origin",
        note: "Placeholder sixth-floor TSBD window anchor pending survey-grade measurement ingest.",
      },
      {
        label: "Target",
        note: "Generic body/intersection point for geometry testing, not a historical finding.",
      },
    ],
  },
  {
    id: "tsbd-window-lower-elm",
    name: "TSBD window to lower Elm Street",
    summary:
      "Compares a similar origin against a lower, farther target on the Elm Street path.",
    origin: { x: -48, y: 62, z: 36 },
    target: { x: 66, y: 4, z: -78 },
    uncertaintyDegrees: 3.4,
    sources: [
      {
        label: "Scene geometry",
        note: "Uses the current schematic Elm Street curve as a provisional spatial reference.",
      },
      {
        label: "Uncertainty",
        note: "Wider cone communicates unresolved vehicle/body/frame placement assumptions.",
      },
    ],
  },
  {
    id: "knoll-candidate-line",
    name: "Knoll candidate line",
    summary:
      "A non-conclusive comparison ray from the grassy knoll region toward the same target envelope.",
    origin: { x: 50, y: 12, z: 24 },
    target: { x: 46, y: 5, z: -58 },
    uncertaintyDegrees: 4.2,
    sources: [
      {
        label: "Origin",
        note: "Candidate region only; not a claim of a shot source or authenticated position.",
      },
      {
        label: "Purpose",
        note: "Supports geometry comparison against other hypotheses with identical math.",
      },
    ],
  },
];

export function getTrajectoryPreset(id: string): TrajectoryPreset {
  return TRAJECTORY_PRESETS.find((preset) => preset.id === id) ?? TRAJECTORY_PRESETS[0]!;
}
