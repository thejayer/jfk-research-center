import { describe, expect, it } from "vitest";
import { formatDegrees, formatFeet, solveTrajectory } from "../trajectory";

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
