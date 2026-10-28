import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../..", import.meta.url).pathname;
const SERVER_ROOTS = ["app", "lib"];
const SKIP_DIR_NAMES = new Set([
  "__tests__",
  "node_modules",
  ".next",
]);

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("server code must not fetch the public origin", () => {
  const files = SERVER_ROOTS.flatMap((root) => walk(join(ROOT, root)));

  it("does not build a fetch to JFK_API_BASE_URL or researchjfk.ai", () => {
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file);
      const source = stripComments(readFileSync(file, "utf8"));

      if (/\bJFK_API_BASE_URL\b/.test(source)) {
        violations.push(`${rel}: references JFK_API_BASE_URL`);
      }

      if (
        /fetch\s*\([\s\S]{0,240}https?:\/\/(?:www\.)?researchjfk\.ai/i.test(
          source,
        )
      ) {
        violations.push(`${rel}: fetch() targets researchjfk.ai`);
      }

      if (/fetch\s*\([\s\S]{0,240}\bPUBLIC_SITE_ORIGIN\b/.test(source)) {
        violations.push(`${rel}: fetch() uses PUBLIC_SITE_ORIGIN`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("scans the server tree rather than a single helper", () => {
    expect(files.some((file) => file.endsWith("lib/api-client.ts"))).toBe(true);
    expect(files.some((file) => file.endsWith("app/search/page.tsx"))).toBe(
      true,
    );
  });
});
