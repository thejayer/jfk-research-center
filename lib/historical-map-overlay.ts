import type { TrajectoryPoint } from "./trajectory";

export type HistoricalMapPoint = {
  x: number;
  y: number;
};

type AffineControlPoint = {
  id: string;
  label: string;
  source: {
    u: number;
    v: number;
  };
  image: HistoricalMapPoint;
};

type AffineTransform = {
  originU: number;
  originV: number;
  scaleU: number;
  scaleV: number;
  xCoefficients: [number, number, number];
  yCoefficients: [number, number, number];
  meanResidualPixels: number;
};

export type HistoricalTrajectoryFootprint = {
  origin: HistoricalMapPoint;
  target: HistoricalMapPoint;
  left: HistoricalMapPoint;
  right: HistoricalMapPoint;
};

export const HISTORICAL_DEALEY_IMAGE = {
  id: "wc-ce359-annotated",
  title: "Annotated Dealey Plaza, Warren Commission CE359",
  width: 592,
  height: 546,
  imageUrl:
    "https://upload.wikimedia.org/wikipedia/commons/6/6b/Dealey-plaza-annotated.png",
  sourceUrl:
    "https://commons.wikimedia.org/wiki/File:Dealey-plaza-annotated.png",
  originalSourceUrl:
    "https://www.aarclibrary.org/publib/jfk/wc/wcvols/wh16/html/WH_Vol16_0490b.htm",
  attribution:
    "Warren Commission archive photograph, annotated on Wikimedia Commons; public-domain U.S. government source material.",
  calibrationNote:
    "Provisional affine fit from visible plaza landmarks into current schematic coordinates. Use for orientation, not survey-grade measurement.",
} as const;

const TRAJECTORY_CONTROL_POINTS: readonly AffineControlPoint[] = [
  {
    id: "tsbd-window",
    label: "TSBD sixth-floor window region",
    source: { u: -48, v: 36 },
    image: { x: 111, y: 190 },
  },
  {
    id: "elm-turn",
    label: "Elm Street turn below TSBD",
    source: { u: -26, v: -16 },
    image: { x: 183, y: 257 },
  },
  {
    id: "z313",
    label: "Approximate Z313 road point",
    source: { u: 58, v: -70 },
    image: { x: 315, y: 468 },
  },
  {
    id: "triple-underpass",
    label: "Triple underpass road exit",
    source: { u: 22, v: -88 },
    image: { x: 326, y: 518 },
  },
  {
    id: "knoll",
    label: "Grassy knoll label region",
    source: { u: 50, v: 24 },
    image: { x: 232, y: 405 },
  },
];

const WITNESS_CONTROL_POINTS: readonly AffineControlPoint[] = [
  {
    id: "tsbd",
    label: "Texas School Book Depository",
    source: { u: -96.80831, v: 32.77957 },
    image: { x: 91, y: 224 },
  },
  {
    id: "stockade-fence",
    label: "Stockade fence / grassy knoll",
    source: { u: -96.80887, v: 32.77943 },
    image: { x: 237, y: 393 },
  },
  {
    id: "z313-road",
    label: "Approximate Z313 road point",
    source: { u: -96.80911, v: 32.77926 },
    image: { x: 315, y: 468 },
  },
  {
    id: "elm-start",
    label: "Elm/Houston turn",
    source: { u: -96.80796, v: 32.77956 },
    image: { x: 347, y: 168 },
  },
  {
    id: "triple-underpass",
    label: "Triple underpass",
    source: { u: -96.8095, v: 32.77985 },
    image: { x: 326, y: 518 },
  },
];

const TRAJECTORY_TRANSFORM = fitAffineTransform(TRAJECTORY_CONTROL_POINTS);
const WITNESS_TRANSFORM = fitAffineTransform(WITNESS_CONTROL_POINTS);

export const HISTORICAL_MAP_CALIBRATION = {
  trajectoryControlPoints: TRAJECTORY_CONTROL_POINTS,
  witnessControlPoints: WITNESS_CONTROL_POINTS,
  trajectoryResidualPixels: TRAJECTORY_TRANSFORM.meanResidualPixels,
  witnessResidualPixels: WITNESS_TRANSFORM.meanResidualPixels,
} as const;

/**
 * Projects a trajectory point from the sandbox's plaza-relative world frame
 * into historical image pixel space.
 *
 * @param point - Trajectory world coordinates in feet. Only x (east/west) and
 * z (north/south) are used; y/elevation is ignored for this top-down overlay.
 * @returns HistoricalMapPoint pixel coordinates within the calibrated
 * historical image.
 */
export function projectTrajectoryPointToHistoricalImage(
  point: Pick<TrajectoryPoint, "x" | "z">,
): HistoricalMapPoint {
  return projectAffinePoint(TRAJECTORY_TRANSFORM, {
    u: point.x,
    v: point.z,
  });
}

/**
 * Projects a witness position from geographic coordinates into historical
 * image pixel space.
 *
 * @param positionLat - WGS84 latitude for the witness position.
 * @param positionLng - WGS84 longitude for the witness position.
 * @returns HistoricalMapPoint pixel coordinates within the calibrated
 * historical image.
 */
export function projectWitnessToHistoricalImage(
  positionLat: number,
  positionLng: number,
): HistoricalMapPoint {
  return projectAffinePoint(WITNESS_TRANSFORM, {
    u: positionLng,
    v: positionLat,
  });
}

/**
 * Builds the top-down historical image footprint for the active trajectory
 * path and uncertainty cone.
 *
 * @param origin - Trajectory origin in plaza-relative feet.
 * @param target - Trajectory target in plaza-relative feet.
 * @param uncertaintyDegrees - Cone half-angle in degrees. sanitizeConeDegrees
 * is applied before computing the cone footprint.
 * @returns Projected pixel positions for the path and cone: origin and target
 * mark the active ray, while left and right mark the target-end cone edges.
 *
 * horizontalDistance and coneRadius are computed in plaza-relative feet from
 * x/z only; y/elevation is intentionally ignored for this historical top-down
 * overlay.
 */
export function buildHistoricalTrajectoryFootprint({
  origin,
  target,
  uncertaintyDegrees,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  uncertaintyDegrees: number;
}): HistoricalTrajectoryFootprint {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const horizontalDistance = Math.hypot(dx, dz);
  const coneRadius =
    Math.tan((sanitizeConeDegrees(uncertaintyDegrees) * Math.PI) / 180) *
    horizontalDistance;

  const unitX = horizontalDistance > 0 ? dx / horizontalDistance : 0;
  const unitZ = horizontalDistance > 0 ? dz / horizontalDistance : -1;
  const perpendicular = { x: -unitZ, z: unitX };
  const left = {
    x: target.x + perpendicular.x * coneRadius,
    z: target.z + perpendicular.z * coneRadius,
  };
  const right = {
    x: target.x - perpendicular.x * coneRadius,
    z: target.z - perpendicular.z * coneRadius,
  };

  return {
    origin: projectTrajectoryPointToHistoricalImage(origin),
    target: projectTrajectoryPointToHistoricalImage(target),
    left: projectTrajectoryPointToHistoricalImage(left),
    right: projectTrajectoryPointToHistoricalImage(right),
  };
}

function fitAffineTransform(points: readonly AffineControlPoint[]): AffineTransform {
  if (points.length < 3) {
    throw new Error("At least three control points are required");
  }

  const originU =
    points.reduce((sum, point) => sum + point.source.u, 0) / points.length;
  const originV =
    points.reduce((sum, point) => sum + point.source.v, 0) / points.length;
  const scaleU =
    Math.max(...points.map((point) => Math.abs(point.source.u - originU))) || 1;
  const scaleV =
    Math.max(...points.map((point) => Math.abs(point.source.v - originV))) || 1;

  const normalized = points.map((point) => ({
    u: (point.source.u - originU) / scaleU,
    v: (point.source.v - originV) / scaleV,
    x: point.image.x,
    y: point.image.y,
  }));

  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xVector = [0, 0, 0];
  const yVector = [0, 0, 0];

  normalized.forEach((point) => {
    const row = [point.u, point.v, 1];
    for (let r = 0; r < 3; r += 1) {
      xVector[r] += row[r] * point.x;
      yVector[r] += row[r] * point.y;
      for (let c = 0; c < 3; c += 1) {
        normal[r][c] += row[r] * row[c];
      }
    }
  });

  const xCoefficients = solveThreeByThree(normal, xVector);
  const yCoefficients = solveThreeByThree(normal, yVector);
  const transform: AffineTransform = {
    originU,
    originV,
    scaleU,
    scaleV,
    xCoefficients,
    yCoefficients,
    meanResidualPixels: 0,
  };

  const meanResidualPixels =
    points.reduce((sum, point) => {
      const projected = projectAffinePoint(transform, point.source);
      return sum + Math.hypot(projected.x - point.image.x, projected.y - point.image.y);
    }, 0) / points.length;

  return {
    ...transform,
    meanResidualPixels,
  };
}

function projectAffinePoint(
  transform: AffineTransform,
  point: { u: number; v: number },
): HistoricalMapPoint {
  const u = (point.u - transform.originU) / transform.scaleU;
  const v = (point.v - transform.originV) / transform.scaleV;
  return {
    x:
      transform.xCoefficients[0] * u +
      transform.xCoefficients[1] * v +
      transform.xCoefficients[2],
    y:
      transform.yCoefficients[0] * u +
      transform.yCoefficients[1] * v +
      transform.yCoefficients[2],
  };
}

function solveThreeByThree(
  matrix: number[][],
  vector: number[],
): [number, number, number] {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) {
        best = row;
      }
    }

    if (Math.abs(augmented[best][pivot]) < 1e-9) {
      throw new Error("Control points do not define a stable affine transform");
    }

    if (best !== pivot) {
      [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col < 4; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = pivot; col < 4; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

function sanitizeConeDegrees(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 89.999);
}
