import { describe, expect, it } from "vitest";
import {
  compareTrajectoryToPlanePoint,
  formatDegrees,
  formatFeet,
  intersectTrajectoryPlane,
  solveTrajectory,
} from "../trajectory";

describe("solveTrajectory", () => {
  it("computes deterministic distance and angle values", () => {
    const solution = solveTrajectory(
      { x: 0, y: 10, z: 0 },
      { x: 30, y: 0, z: -40 },
      1000,
    );

    expect(solution.horizontalDistanceFeet).toBeCloseTo(50);
    expect(solution.lineDistanceFeet).toBeCloseTo(50.9902);
    expect(solution.elevationAngleDegrees).toBeCloseTo(-11.3099);
    expect(solution.azimuthDegrees).toBeCloseTo(36.8699);
    expect(solution.timeOfFlightSeconds).toBeCloseTo(0.05099);
  });

  it("returns zero time of flight when velocity is not positive", () => {
    const solution = solveTrajectory(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -100 },
      0,
    );

    expect(solution.timeOfFlightSeconds).toBe(0);
  });

  it("formats degree values using the module display convention", () => {
    expect(formatDegrees(36.8699)).toBe("36.9°");
    expect(formatDegrees(0)).toBe("0.0°");
    expect(formatDegrees(-11.3099)).toBe("-11.3°");
  });

  it("formats feet values using the module display convention", () => {
    expect(formatFeet(50.9902)).toBe("51.0 ft");
    expect(formatFeet(0)).toBe("0.0 ft");
    expect(formatFeet(-12.24)).toBe("-12.2 ft");
  });
});

describe("trajectory intersections", () => {
  it("intersects a named coordinate plane deterministically", () => {
    const intersection = intersectTrajectoryPlane(
      { x: 0, y: 10, z: 0 },
      { x: 30, y: 0, z: -40 },
      "z",
      -20,
    );

    expect(intersection?.t).toBeCloseTo(0.5);
    expect(intersection?.isWithinSegment).toBe(true);
    expect(intersection?.point).toEqual({ x: 15, y: 5, z: -20 });
  });

  it("returns null when the ray is parallel to the requested plane", () => {
    expect(
      intersectTrajectoryPlane(
        { x: 0, y: 0, z: -10 },
        { x: 20, y: 0, z: -10 },
        "z",
        -20,
      ),
    ).toBeNull();
  });

  it("compares a plane intersection to a target point and cone radius", () => {
    const comparison = compareTrajectoryToPlanePoint({
      origin: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: -100 },
      point: { x: 3, y: 4, z: -50 },
      axis: "z",
      uncertaintyDegrees: 6,
    });

    expect(comparison.intersection?.point).toEqual({ x: 0, y: 0, z: -50 });
    expect(comparison.missDistanceFeet).toBeCloseTo(5);
    expect(comparison.coneRadiusFeet).toBeCloseTo(5.255, 3);
    expect(comparison.isWithinCone).toBe(true);
  });

  it("sanitizes invalid uncertainty angles before computing cone radius", () => {
    const invalid = compareTrajectoryToPlanePoint({
      origin: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: -100 },
      point: { x: 1, y: 0, z: -50 },
      axis: "z",
      uncertaintyDegrees: Number.NaN,
    });
    const huge = compareTrajectoryToPlanePoint({
      origin: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: -100 },
      point: { x: 1, y: 0, z: -50 },
      axis: "z",
      uncertaintyDegrees: 180,
    });

    expect(invalid.coneRadiusFeet).toBe(0);
    expect(invalid.isWithinCone).toBe(false);
    expect(Number.isFinite(huge.coneRadiusFeet)).toBe(true);
    expect(huge.isWithinCone).toBe(true);
  });

  it("marks comparisons outside the segment as unavailable", () => {
    const comparison = compareTrajectoryToPlanePoint({
      origin: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: -10 },
      point: { x: 0, y: 0, z: -50 },
      axis: "z",
      uncertaintyDegrees: 2,
    });

    expect(comparison.intersection?.isWithinSegment).toBe(false);
    expect(comparison.missDistanceFeet).toBeNull();
    expect(comparison.coneRadiusFeet).toBeNull();
    expect(comparison.isWithinCone).toBeNull();
  });
});
