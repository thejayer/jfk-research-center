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

export function formatDegrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

export function formatFeet(value: number): string {
  return `${value.toFixed(1)} ft`;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number): number {
  return (value + 360) % 360;
}
