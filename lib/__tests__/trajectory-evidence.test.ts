import { describe, expect, it } from "vitest";
import {
  TRAJECTORY_FRAME_MARKS,
  buildTrajectorySourceTrail,
  getTrajectoryFrameMark,
  getTrajectorySourceReferences,
} from "../trajectory-evidence";
import { TRAJECTORY_PRESETS } from "../trajectory-presets";

describe("trajectory evidence metadata", () => {
  it("defines frame markers with sourced target points", () => {
    expect(TRAJECTORY_FRAME_MARKS.length).toBeGreaterThanOrEqual(3);
    expect(
      TRAJECTORY_FRAME_MARKS.every(
        (mark) =>
          mark.id &&
          mark.frame > 0 &&
          mark.summary &&
          mark.sourceIds.length > 0 &&
          mark.uncertaintyDegrees > 0,
      ),
    ).toBe(true);
  });

  it("returns null for unknown frame markers", () => {
    expect(getTrajectoryFrameMark("z313")?.frame).toBe(313);
    expect(getTrajectoryFrameMark("missing")).toBeNull();
    expect(getTrajectoryFrameMark(null)).toBeNull();
  });

  it("deduplicates source references and drops unknown ids", () => {
    const refs = getTrajectorySourceReferences([
      "zapruder-film",
      "missing",
      "zapruder-film",
      "wc-report-1964",
    ]);

    expect(refs.map((ref) => ref.id)).toEqual([
      "zapruder-film",
      "wc-report-1964",
    ]);
  });

  it("builds a source trail for the current model state", () => {
    const preset = TRAJECTORY_PRESETS[0]!;
    const frameMark = TRAJECTORY_FRAME_MARKS[1]!;
    const trail = buildTrajectorySourceTrail({
      preset,
      frameMark,
      origin: preset.origin,
      target: frameMark.target,
      uncertaintyDegrees: frameMark.uncertaintyDegrees,
    });

    expect(trail[0]).toMatchObject({
      id: "preset",
      value: preset.name,
    });
    expect(trail.some((item) => item.value.includes("Z225"))).toBe(true);
    expect(trail.some((item) => item.href === "/evidence/zapruder-film")).toBe(
      true,
    );
    expect(trail.some((item) => item.id === "coordinate-frame")).toBe(true);
  });
});
