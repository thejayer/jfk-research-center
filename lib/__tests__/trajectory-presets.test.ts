import { describe, expect, it } from "vitest";
import {
  TRAJECTORY_PRESETS,
  getTrajectoryPreset,
} from "../trajectory-presets";

describe("trajectory presets", () => {
  it("defines sourced scenario presets", () => {
    expect(TRAJECTORY_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(
      TRAJECTORY_PRESETS.every(
        (preset) =>
          preset.id &&
          preset.name &&
          preset.summary &&
          preset.sources.length > 0 &&
          preset.uncertaintyDegrees > 0,
      ),
    ).toBe(true);
  });

  it("falls back to the first preset for unknown ids", () => {
    expect(getTrajectoryPreset("missing")).toBe(TRAJECTORY_PRESETS[0]);
  });
});
