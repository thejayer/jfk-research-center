import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUNDLE_BUDGETS,
  TRAJECTORY_ROUTE,
  assertBundleBudgets,
  checkProductionArtifacts,
  collectOtherRouteClientFiles,
  findThreeLeaks,
  parseByteSize,
  parseNextBuildTable,
  requireRoute,
} from "../bundle-size";

const CLEAN_TABLE = `
Route (app)                                              Size  First Load JS
┌ ƒ /                                                  4.3 kB         112 kB
├ ƒ /dealey-plaza                                     4.45 kB         111 kB
├ ƒ /dealey-plaza/trajectory                           159 kB         267 kB
└ ƒ /topics                                             191 B         106 kB
+ First Load JS shared by all                          103 kB
  ├ chunks/3636-3c93e95088b9f38a.js                   46.6 kB
  ├ chunks/4bd1b696-f785427dddbba9fb.js               54.2 kB
  └ other shared chunks (total)                       1.98 kB
`;

const MOJIBAKE_TABLE = `
Route (app)                                              Size  First Load JS
Γöî ╞Æ /                                                  4.3 kB         112 kB
Γö£ ╞Æ /dealey-plaza                                     4.45 kB         111 kB
Γö£ ╞Æ /dealey-plaza/trajectory                           159 kB         267 kB
Γöö ╞Æ /topics                                             191 B         106 kB
+ First Load JS shared by all                          103 kB
  Γö£ chunks/3636-3c93e95088b9f38a.js                   46.6 kB
`;

const ANSI_TABLE = `
Route (app)                                              Size  First Load JS
\u001B[32m┌ ƒ /dealey-plaza/trajectory\u001B[0m                           22.1 kB         125 kB
\u001B[32m├ ƒ /dealey-plaza\u001B[0m                                     4.45 kB         111 kB
+ First Load JS shared by all                          103 kB
`;

const OVERSIZE_TABLE = `
Route (app)                                              Size  First Load JS
┌ ƒ /dealey-plaza                                     4.45 kB         111 kB
├ ƒ /dealey-plaza/trajectory                           400 kB         900 kB
└ ƒ /topics                                             191 B         106 kB
+ First Load JS shared by all                          200 kB
  ├ chunks/shared.js                                  200 kB
`;

const MISSING_TRAJECTORY_TABLE = `
Route (app)                                              Size  First Load JS
┌ ƒ /dealey-plaza                                     4.45 kB         111 kB
└ ƒ /topics                                             191 B         106 kB
+ First Load JS shared by all                          103 kB
`;

describe("parseByteSize", () => {
  it("uses Next.js 1000-based units", () => {
    expect(parseByteSize("254", "B")).toBe(254);
    expect(parseByteSize("4.3", "kB")).toBe(4300);
    expect(parseByteSize("159", "kB")).toBe(159000);
    expect(parseByteSize("1.1", "MB")).toBe(1_100_000);
  });
});

describe("parseNextBuildTable", () => {
  it("parses /dealey-plaza/trajectory separately from /dealey-plaza", () => {
    const parsed = parseNextBuildTable(CLEAN_TABLE);
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).firstLoadJsBytes).toBe(267000);
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).sizeBytes).toBe(159000);
    expect(requireRoute(parsed, "/dealey-plaza").firstLoadJsBytes).toBe(111000);
    expect(parsed.sharedFirstLoadJsBytes).toBe(103000);
    expect(parsed.sharedChunks.map((chunk) => chunk.file)).toEqual([
      "static/chunks/3636-3c93e95088b9f38a.js",
      "static/chunks/4bd1b696-f785427dddbba9fb.js",
    ]);
    expect(BUNDLE_BUDGETS.trajectoryRoute).toBe("/dealey-plaza/trajectory");
  });

  it("parses mojibake box-drawing from committed Windows build logs", () => {
    const parsed = parseNextBuildTable(MOJIBAKE_TABLE);
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).firstLoadJsBytes).toBe(267000);
    expect(parsed.sharedFirstLoadJsBytes).toBe(103000);
  });

  it("parses the committed docs/dealey-plaza-1963/build.txt artifact", () => {
    const text = readFileSync(
      path.join(process.cwd(), "docs/dealey-plaza-1963/build.txt"),
      "utf8",
    );
    const parsed = parseNextBuildTable(text);
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).route).toBe(
      "/dealey-plaza/trajectory",
    );
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).firstLoadJsBytes).toBe(121000);
    expect(parsed.routes.has("/dealey-plaza")).toBe(true);
  });

  it("strips ANSI color codes", () => {
    const parsed = parseNextBuildTable(ANSI_TABLE);
    expect(requireRoute(parsed, TRAJECTORY_ROUTE).firstLoadJsBytes).toBe(125000);
  });

  it("fails when the trajectory route is absent", () => {
    const parsed = parseNextBuildTable(MISSING_TRAJECTORY_TABLE);
    expect(() => requireRoute(parsed, TRAJECTORY_ROUTE)).toThrow(
      /\/dealey-plaza\/trajectory/,
    );
  });
});

describe("assertBundleBudgets", () => {
  const passingBudgets = {
    trajectoryRoute: TRAJECTORY_ROUTE,
    trajectoryFirstLoadJsMaxBytes: 293700,
    sharedFirstLoadJsMaxBytes: 108000,
  };

  it("accepts sizes at or under the budget", () => {
    expect(() =>
      assertBundleBudgets(parseNextBuildTable(CLEAN_TABLE), passingBudgets),
    ).not.toThrow();
  });

  it("fails when trajectory First Load JS is deliberately oversized", () => {
    expect(() =>
      assertBundleBudgets(parseNextBuildTable(OVERSIZE_TABLE), {
        ...passingBudgets,
        sharedFirstLoadJsMaxBytes: 250000,
      }),
    ).toThrow(/\/dealey-plaza\/trajectory First Load JS 900 kB exceeds budget/);
  });

  it("fails when shared First Load JS is deliberately oversized", () => {
    expect(() =>
      assertBundleBudgets(parseNextBuildTable(OVERSIZE_TABLE), {
        trajectoryRoute: TRAJECTORY_ROUTE,
        trajectoryFirstLoadJsMaxBytes: 1_000_000,
        sharedFirstLoadJsMaxBytes: 108000,
      }),
    ).toThrow(/shared by all 200 kB exceeds budget 108 kB/);
  });

  it("fails a 1-byte overflow instead of rounding the budget up", () => {
    expect(() =>
      assertBundleBudgets(parseNextBuildTable(ANSI_TABLE), {
        trajectoryRoute: TRAJECTORY_ROUTE,
        trajectoryFirstLoadJsMaxBytes: 124999,
        sharedFirstLoadJsMaxBytes: 108000,
      }),
    ).toThrow(/125 kB exceeds budget 124.999 kB/);
  });
});

describe("findThreeLeaks", () => {
  it("does not treat documentary uses of the word three as a leak", () => {
    expect(
      findThreeLeaks({
        "static/chunks/app/about/page.js":
          'throw new Error("At least three control points are required")',
      }),
    ).toEqual([]);
  });

  it("fails when three/r3f/drei signatures appear in other-route files", () => {
    const leaks = findThreeLeaks({
      "static/chunks/app/dealey-plaza/page.js":
        'import * as THREE from "three"; new THREE.WebGLRenderer()',
      "static/chunks/app/about/page.js": "export default function About(){}",
    });
    expect(leaks).toEqual([
      {
        filePath: "static/chunks/app/dealey-plaza/page.js",
        pattern: String.raw`from\s*["']three(?:\/[^"']*)?["']`,
      },
    ]);
  });

  it("collects every non-trajectory app page file for leak scanning", () => {
    const files = collectOtherRouteClientFiles({
      pages: {
        "/dealey-plaza/trajectory/page": [
          "static/chunks/three-vendor.js",
          "static/chunks/app/dealey-plaza/trajectory/page.js",
        ],
        "/dealey-plaza/page": ["static/chunks/app/dealey-plaza/page.js"],
        "/layout": ["static/chunks/main-app.js", "static/css/app.css"],
      },
    });
    expect(files.sort()).toEqual([
      "static/chunks/app/dealey-plaza/page.js",
      "static/chunks/main-app.js",
    ]);
    expect(files).not.toContain("static/chunks/three-vendor.js");
  });
});

describe("checkProductionArtifacts", () => {
  const files = {
    "static/chunks/shared.js": "export const n=1",
    "static/chunks/app/dealey-plaza/page.js": "export default function Map(){}",
  };

  it("passes a split-sized table without three.js in other-route files", () => {
    const result = checkProductionArtifacts({
      buildLogText: ANSI_TABLE,
      listedFiles: Object.keys(files),
      readFile: (relative) => files[relative as keyof typeof files],
      budgets: {
        trajectoryRoute: TRAJECTORY_ROUTE,
        trajectoryFirstLoadJsMaxBytes: 137500,
        sharedFirstLoadJsMaxBytes: 108000,
      },
    });
    expect(result.trajectory.firstLoadJsBytes).toBe(125000);
  });

  it("fails oversized First Load JS even when listed files are clean", () => {
    expect(() =>
      checkProductionArtifacts({
        buildLogText: OVERSIZE_TABLE,
        listedFiles: Object.keys(files),
        readFile: (relative) => files[relative as keyof typeof files],
        budgets: {
          trajectoryRoute: TRAJECTORY_ROUTE,
          trajectoryFirstLoadJsMaxBytes: 143000,
          sharedFirstLoadJsMaxBytes: 108000,
        },
      }),
    ).toThrow(/900 kB exceeds budget/);
  });

  it("fails when a non-trajectory first-load file contains WebGLRenderer", () => {
    expect(() =>
      checkProductionArtifacts({
        buildLogText: ANSI_TABLE,
        listedFiles: ["static/chunks/app/about/page.js"],
        readFile: () => "function boot(){ return new WebGLRenderer(); }",
        budgets: {
          trajectoryRoute: TRAJECTORY_ROUTE,
          trajectoryFirstLoadJsMaxBytes: 137500,
          sharedFirstLoadJsMaxBytes: 108000,
        },
      }),
    ).toThrow(/WebGLRenderer/);
  });
});
