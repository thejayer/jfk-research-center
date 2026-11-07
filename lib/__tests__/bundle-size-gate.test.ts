import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUNDLE_BUDGETS,
  TRAJECTORY_ROUTE,
  checkProductionArtifacts,
  collectOtherRouteClientFiles,
  parseNextBuildTable,
} from "../bundle-size";

const enabled = process.env.BUNDLE_SIZE_REQUIRED === "1";
const buildLogPath = process.env.BUNDLE_SIZE_LOG ?? "bundle-size-build.txt";
const nextDir = process.env.BUNDLE_SIZE_NEXT_DIR ?? ".next";

describe.skipIf(!enabled)("production bundle size gate", () => {
  it("enforces First Load JS budgets and keeps three.js off other routes", () => {
    expect(BUNDLE_BUDGETS.trajectoryRoute).toBe(TRAJECTORY_ROUTE);
    expect(existsSync(buildLogPath)).toBe(true);

    const appManifestPath = path.join(nextDir, "app-build-manifest.json");
    const buildManifestPath = path.join(nextDir, "build-manifest.json");
    expect(existsSync(appManifestPath)).toBe(true);

    const listedFiles = new Set<string>();
    const buildManifest = JSON.parse(
      readFileSync(buildManifestPath, "utf8"),
    ) as { rootMainFiles?: string[] };
    for (const file of buildManifest.rootMainFiles ?? []) {
      if (file.endsWith(".js")) listedFiles.add(file);
    }

    const appManifest = JSON.parse(readFileSync(appManifestPath, "utf8")) as {
      pages?: Record<string, string[]>;
    };
    for (const file of collectOtherRouteClientFiles(appManifest)) {
      listedFiles.add(file);
    }

    const parsedLog = readFileSync(buildLogPath, "utf8");
    const parsedTable = parseNextBuildTable(parsedLog);
    for (const chunk of parsedTable.sharedChunks) {
      listedFiles.add(chunk.file);
    }

    const result = checkProductionArtifacts({
      buildLogText: parsedLog,
      listedFiles: [...listedFiles],
      readFile: (relative) =>
        readFileSync(path.join(nextDir, relative), "utf8"),
    });

    expect(result.trajectory.route).toBe(TRAJECTORY_ROUTE);
    expect(result.trajectory.firstLoadJsBytes).toBeLessThanOrEqual(
      BUNDLE_BUDGETS.trajectoryFirstLoadJsMaxBytes,
    );
    expect(result.sharedFirstLoadJsBytes).toBeLessThanOrEqual(
      BUNDLE_BUDGETS.sharedFirstLoadJsMaxBytes,
    );
  });
});
