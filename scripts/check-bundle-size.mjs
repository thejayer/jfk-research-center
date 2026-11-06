import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitestBin = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);

const child = spawn(
  process.execPath,
  [vitestBin, "run", "lib/__tests__/bundle-size-gate.test.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BUNDLE_SIZE_REQUIRED: "1",
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
