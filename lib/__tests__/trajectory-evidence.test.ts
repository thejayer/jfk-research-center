import { describe, expect, it } from "vitest";
import {
  TRAJECTORY_FRAME_MARKS,
  buildTrajectoryFrameSample,
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

  it("builds exact and interpolated frame samples for the scrubber", () => {
    const exact = buildTrajectoryFrameSample(313);
    const interpolated = buildTrajectoryFrameSample(269);

    expect(exact?.exactMark?.id).toBe("z313");
    expect(exact?.target).toEqual(getTrajectoryFrameMark("z313")?.target);
    expect(interpolated?.exactMark).toBeNull();
    expect(interpolated?.lowerMark.id).toBe("z225");
    expect(interpolated?.upperMark.id).toBe("z313");
    expect(interpolated?.interpolation).toBeCloseTo(0.5);
    expect(interpolated?.target).toEqual({
      x: 52,
      y: 6,
      z: -64,
    });
    expect(interpolated?.uncertaintyDegrees).toBeCloseTo(3.75);
  });

  it("clamps frame samples to the configured frame range", () => {
    const first = TRAJECTORY_FRAME_MARKS[0]!;
    const last = TRAJECTORY_FRAME_MARKS[TRAJECTORY_FRAME_MARKS.length - 1]!;

    expect(buildTrajectoryFrameSample(-1)?.frame).toBe(first.frame);
    expect(buildTrajectoryFrameSample(999)?.frame).toBe(last.frame);
    expect(buildTrajectoryFrameSample(Number.NaN)?.frame).toBe(first.frame);
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
      frameSample: null,
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

  it("builds a manual-target source trail without frame-backed links", () => {
    const preset = TRAJECTORY_PRESETS[0]!;
    const frameMark = TRAJECTORY_FRAME_MARKS[1]!;
    const trail = buildTrajectorySourceTrail({
      preset,
      frameMark: null,
      frameSample: null,
      origin: preset.origin,
      target: { x: 12, y: 6, z: -34 },
      uncertaintyDegrees: 2.8,
    });

    expect(frameMark.id).toBe("z225");
    expect(trail).toContainEqual(
      expect.objectContaining({
        id: "frame",
        value: "Manual target",
      }),
    );
    expect(trail.some((item) => item.id === "coordinate-frame")).toBe(true);
    expect(trail.some((item) => item.href === "/evidence/zapruder-film")).toBe(
      false,
    );
  });

  it("labels interpolated frame samples separately from manual targets", () => {
    const preset = TRAJECTORY_PRESETS[0]!;
    const frameSample = buildTrajectoryFrameSample(269)!;
    const trail = buildTrajectorySourceTrail({
      preset,
      frameMark: null,
      frameSample,
      origin: preset.origin,
      target: frameSample.target,
      uncertaintyDegrees: frameSample.uncertaintyDegrees,
    });

    expect(trail).toContainEqual(
      expect.objectContaining({
        id: "frame",
        value: "Z269 interpolated",
      }),
    );
    expect(trail.find((item) => item.id === "frame")?.detail).toContain(
      "from Z225 to Z313",
    );
    expect(trail.some((item) => item.href === "/evidence/zapruder-film")).toBe(
      true,
    );
  });
});
