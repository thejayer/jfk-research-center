import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitestBin = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const buildLogPath = process.argv[2] ?? process.env.BUNDLE_SIZE_LOG ?? "bundle-size-build.txt";
const nextDir = process.argv[3] ?? process.env.BUNDLE_SIZE_NEXT_DIR ?? ".next";

const child = spawn(
  process.execPath,
  [vitestBin, "run", "lib/__tests__/bundle-size-gate.test.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BUNDLE_SIZE_REQUIRED: "1",
      BUNDLE_SIZE_LOG: buildLogPath,
      BUNDLE_SIZE_NEXT_DIR: nextDir,
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
