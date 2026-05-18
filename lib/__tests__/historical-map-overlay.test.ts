import { describe, expect, it } from "vitest";
import {
  HISTORICAL_DEALEY_IMAGE,
  HISTORICAL_MAP_CALIBRATION,
  buildHistoricalTrajectoryFootprint,
  projectTrajectoryPointToHistoricalImage,
  projectWitnessToHistoricalImage,
} from "../historical-map-overlay";

describe("historical map overlay", () => {
  it("defines a sourced Warren Commission historical image layer", () => {
    expect(HISTORICAL_DEALEY_IMAGE.width).toBe(592);
    expect(HISTORICAL_DEALEY_IMAGE.height).toBe(546);
    expect(HISTORICAL_DEALEY_IMAGE.sourceUrl).toContain("wikimedia.org");
    expect(HISTORICAL_DEALEY_IMAGE.attribution).toContain("public-domain");
  });

  it("projects trajectory coordinates into finite image pixels", () => {
    const projected = projectTrajectoryPointToHistoricalImage({
      x: -48,
      z: 36,
    });

    expect(Number.isFinite(projected.x)).toBe(true);
    expect(Number.isFinite(projected.y)).toBe(true);
    expect(projected.x).toBeGreaterThan(0);
    expect(projected.x).toBeLessThan(HISTORICAL_DEALEY_IMAGE.width);
    expect(projected.y).toBeGreaterThan(0);
    expect(projected.y).toBeLessThan(HISTORICAL_DEALEY_IMAGE.height);
  });

  it("projects witness latitude and longitude into finite image pixels", () => {
    const projected = projectWitnessToHistoricalImage(32.77957, -96.80831);

    expect(projected.x).toBeGreaterThan(0);
    expect(projected.x).toBeLessThan(HISTORICAL_DEALEY_IMAGE.width);
    expect(projected.y).toBeGreaterThan(0);
    expect(projected.y).toBeLessThan(HISTORICAL_DEALEY_IMAGE.height);
  });

  it("builds a triangular uncertainty footprint around the active ray", () => {
    const footprint = buildHistoricalTrajectoryFootprint({
      origin: { x: -48, y: 62, z: 36 },
      target: { x: 58, y: 7, z: -70 },
      uncertaintyDegrees: 4,
    });

    expect(footprint.origin).not.toEqual(footprint.target);
    expect(footprint.left).not.toEqual(footprint.right);
  });

  it("keeps calibration residuals available for UI caveats", () => {
    expect(HISTORICAL_MAP_CALIBRATION.trajectoryResidualPixels).toBeGreaterThan(0);
    expect(HISTORICAL_MAP_CALIBRATION.witnessResidualPixels).toBeGreaterThan(0);
  });
});
