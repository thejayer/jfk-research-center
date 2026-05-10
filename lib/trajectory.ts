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

export const DEFAULT_MUZZLE_VELOCITY_FPS = 2000;

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
