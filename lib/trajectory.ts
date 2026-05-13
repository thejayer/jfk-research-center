import { DEFAULT_MUZZLE_VELOCITY_FPS } from "./constants";

export type TrajectoryPoint = {
  x: number;
  y: number;
  z: number;
};

export type TrajectorySolution = {
  dx: number;
  dy: number;
  dz: number;
  horizontalDistanceFeet: number;
  lineDistanceFeet: number;
  elevationAngleDegrees: number;
  azimuthDegrees: number;
  timeOfFlightSeconds: number;
};

export type TrajectoryAxis = keyof TrajectoryPoint;

export type TrajectoryPlaneIntersection = {
  axis: TrajectoryAxis;
  value: number;
  point: TrajectoryPoint;
  t: number;
  isWithinSegment: boolean;
  distanceFromOriginFeet: number;
};

export type TrajectoryPlanePointComparison = {
  intersection: TrajectoryPlaneIntersection | null;
  missDistanceFeet: number | null;
  coneRadiusFeet: number | null;
  isWithinCone: boolean | null;
};

export type TrajectoryPlanBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type TrajectoryPlanPoint = {
  x: number;
  y: number;
};

/**
 * solveTrajectory computes straight-line geometry in plaza-relative feet.
 *
 * Coordinates use +x as east/right, +y as up/elevation, and +z as north/forward.
 * elevationAngleDegrees is measured against the horizontal X/Z plane.
 * azimuthDegrees uses atan2(dx, -dz), so 0 degrees points along the -z axis and
 * positive angles rotate toward +x. Time of flight divides line distance by the
 * supplied muzzle velocity in feet per second.
 */
export function solveTrajectory(
  origin: TrajectoryPoint,
  target: TrajectoryPoint,
  muzzleVelocityFps = DEFAULT_MUZZLE_VELOCITY_FPS,
): TrajectorySolution {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const horizontalDistanceFeet = Math.hypot(dx, dz);
  const lineDistanceFeet = Math.hypot(horizontalDistanceFeet, dy);

  return {
    dx,
    dy,
    dz,
    horizontalDistanceFeet,
    lineDistanceFeet,
    elevationAngleDegrees: radiansToDegrees(Math.atan2(dy, horizontalDistanceFeet)),
    azimuthDegrees: normalizeDegrees(radiansToDegrees(Math.atan2(dx, -dz))),
    timeOfFlightSeconds:
      muzzleVelocityFps > 0 ? lineDistanceFeet / muzzleVelocityFps : 0,
  };
}

/**
 * Intersect a straight trajectory segment with a coordinate plane.
 *
 * @param origin - Ray origin in plaza-relative feet.
 * @param target - Ray target in plaza-relative feet.
 * @param axis - Coordinate axis whose plane should be tested.
 * @param value - Plane value on the selected axis, in plaza-relative feet.
 * @returns The interpolated plane crossing, or null when the ray is parallel
 * to that plane (`delta === 0`). The returned `t` is `(value - origin[axis]) /
 * (target[axis] - origin[axis])`; `isWithinSegment` is true for `0 <= t <= 1`,
 * including exact origin and target boundary hits. Values outside that interval
 * are still returned so callers can distinguish a parallel ray from an
 * out-of-segment crossing.
 *
 * The function is deterministic and side-effect free. Floating point precision
 * is JavaScript number precision; callers should use tolerances for equality
 * checks around very small deltas or boundary values.
 */
export function intersectTrajectoryPlane(
  origin: TrajectoryPoint,
  target: TrajectoryPoint,
  axis: TrajectoryAxis,
  value: number,
): TrajectoryPlaneIntersection | null {
  const delta = target[axis] - origin[axis];
  if (delta === 0) return null;

  const t = (value - origin[axis]) / delta;
  const point = interpolatePoint(origin, target, t);

  return {
    axis,
    value,
    point,
    t,
    isWithinSegment: t >= 0 && t <= 1,
    distanceFromOriginFeet: distanceBetweenPoints(origin, point),
  };
}

/**
 * Compare a trajectory's plane crossing to a sourced point on that same plane.
 *
 * @param origin - Ray origin in plaza-relative feet.
 * @param target - Ray target in plaza-relative feet.
 * @param point - Sourced comparison point in plaza-relative feet.
 * @param axis - Coordinate axis used to define the comparison plane.
 * @param uncertaintyDegrees - Angular cone tolerance in degrees. Non-finite
 * values and negative values are treated as zero; values at or above 90 degrees
 * are clamped below 90 to keep `Math.tan` finite.
 * @returns A comparison object containing the plane intersection, miss distance,
 * cone radius, and containment flag. If the ray is parallel to the plane or the
 * crossing falls outside the origin-target segment, the distance, cone radius,
 * and containment flag are returned as null.
 *
 * This helper is deterministic and side-effect free. Distances and radii are
 * in feet. Boundary crossings at `t === 0` or `t === 1` are valid segment hits.
 */
export function compareTrajectoryToPlanePoint({
  origin,
  target,
  point,
  axis,
  uncertaintyDegrees,
}: {
  origin: TrajectoryPoint;
  target: TrajectoryPoint;
  point: TrajectoryPoint;
  axis: TrajectoryAxis;
  uncertaintyDegrees: number;
}): TrajectoryPlanePointComparison {
  const intersection = intersectTrajectoryPlane(origin, target, axis, point[axis]);
  if (!intersection || !intersection.isWithinSegment) {
    return {
      intersection,
      missDistanceFeet: null,
      coneRadiusFeet: null,
      isWithinCone: null,
    };
  }

  const missDistanceFeet = distanceBetweenPoints(intersection.point, point);
  const clampedUncertaintyDegrees = sanitizeConeDegrees(uncertaintyDegrees);
  const coneRadiusFeet =
    Math.tan((clampedUncertaintyDegrees * Math.PI) / 180) *
    intersection.distanceFromOriginFeet;

  return {
    intersection,
    missDistanceFeet,
    coneRadiusFeet,
    isWithinCone: missDistanceFeet <= coneRadiusFeet,
  };
}

/**
 * Builds padded X/Z bounds for a top-down plaza projection.
 *
 * Coordinates are plaza-relative feet. `y` is ignored because this is a plan
 * view. Empty inputs return a symmetric fallback around the origin, and
 * degenerate one-point spans are widened slightly so projection never divides
 * by zero.
 */
export function buildTrajectoryPlanBounds(
  points: readonly TrajectoryPoint[],
  paddingFeet = 16,
): TrajectoryPlanBounds {
  if (points.length === 0) {
    return {
      minX: -paddingFeet,
      maxX: paddingFeet,
      minZ: -paddingFeet,
      maxZ: paddingFeet,
    };
  }

  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const xSpan = Math.max(maxX - minX, 1);
  const zSpan = Math.max(maxZ - minZ, 1);

  return {
    minX: minX - paddingFeet - (xSpan === 1 ? 0.5 : 0),
    maxX: maxX + paddingFeet + (xSpan === 1 ? 0.5 : 0),
    minZ: minZ - paddingFeet - (zSpan === 1 ? 0.5 : 0),
    maxZ: maxZ + paddingFeet + (zSpan === 1 ? 0.5 : 0),
  };
}

/**
 * Projects a plaza-relative point into SVG coordinates for a top-down plan.
 *
 * X maps left-to-right. Z is inverted so larger/northern Z values render higher
 * on the SVG. Width, height, and padding are CSS/SVG pixels; source bounds are
 * in feet. The helper is deterministic and clamps zero-size drawable areas or
 * spans to one unit to avoid NaN/Infinity at narrow sizes.
 */
export function projectTrajectoryPlanPoint({
  point,
  bounds,
  width,
  height,
  padding = 18,
}: {
  point: TrajectoryPoint;
  bounds: TrajectoryPlanBounds;
  width: number;
  height: number;
  padding?: number;
}): TrajectoryPlanPoint {
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);
  const xSpan = Math.max(bounds.maxX - bounds.minX, 1);
  const zSpan = Math.max(bounds.maxZ - bounds.minZ, 1);

  return {
    x: padding + ((point.x - bounds.minX) / xSpan) * drawableWidth,
    y: padding + ((bounds.maxZ - point.z) / zSpan) * drawableHeight,
  };
}

export function formatDegrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

export function formatFeet(value: number): string {
  return `${value.toFixed(1)} ft`;
}

function interpolatePoint(
  origin: TrajectoryPoint,
  target: TrajectoryPoint,
  t: number,
): TrajectoryPoint {
  return {
    x: origin.x + (target.x - origin.x) * t,
    y: origin.y + (target.y - origin.y) * t,
    z: origin.z + (target.z - origin.z) * t,
  };
}

function distanceBetweenPoints(a: TrajectoryPoint, b: TrajectoryPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sanitizeConeDegrees(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 89.999);
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number): number {
  return (value + 360) % 360;
}
