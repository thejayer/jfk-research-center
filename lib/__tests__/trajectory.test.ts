import { describe, expect, it } from "vitest";
import { solveTrajectory } from "../trajectory";

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
});
