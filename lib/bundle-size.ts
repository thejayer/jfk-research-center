export const TRAJECTORY_ROUTE = "/dealey-plaza/trajectory" as const;

// Baseline on 0ae8477d (before the Three.js split): trajectory First Load JS
// 267 kB, shared 103 kB. Shared limit is that baseline plus 5 kB. Trajectory
// limit is filled from the post-split measurement plus ~10% headroom — not an
// inflated ceiling. Target after split is ~130 kB First Load JS.
export const BUNDLE_BUDGETS = {
  trajectoryRoute: TRAJECTORY_ROUTE,
  // Post-split measurement: 121 kB First Load JS. Limit is that value plus
  // 10% headroom (133.1 kB), not an inflated ceiling. Target was ~130 kB.
  trajectoryFirstLoadJsMaxBytes: 133100,
  // Pre-split shared First Load JS was 103 kB; limit is baseline + 5 kB.
  sharedFirstLoadJsMaxBytes: 108000,
};

export type BundleBudgets = {
  trajectoryRoute: string;
  trajectoryFirstLoadJsMaxBytes: number;
  sharedFirstLoadJsMaxBytes: number;
};

export type ParsedRoute = {
  route: string;
  sizeBytes: number;
  firstLoadJsBytes: number;
};

export type SharedChunk = {
  file: string;
  bytes: number;
};

export type ParsedBuildTable = {
  routes: Map<string, ParsedRoute>;
  sharedFirstLoadJsBytes: number;
  sharedChunks: SharedChunk[];
};

export const THREE_LEAK_PATTERNS: readonly RegExp[] = [
  /node_modules\/three(?:\/|$)/,
  /from\s*["']three(?:\/[^"']*)?["']/,
  /["']three\/addons/,
  /@react-three/,
  /\bOrbitControls\b/,
  /\bWebGLRenderer\b/,
];

const SIZE_PATTERN = String.raw`(\d+(?:\.\d+)?)\s*(B|kB|KB|MB)`;
const ROUTE_LINE = new RegExp(
  String.raw`(\/[A-Za-z0-9._\-\[\]\/]*)\s+${SIZE_PATTERN}\s+${SIZE_PATTERN}\s*$`,
  "i",
);
const SHARED_LINE = new RegExp(
  String.raw`First Load JS shared by all\s+${SIZE_PATTERN}`,
  "i",
);
const SHARED_CHUNK_LINE = new RegExp(
  String.raw`chunks\/([^\s]+)\s+${SIZE_PATTERN}\s*$`,
  "i",
);

export function parseByteSize(value: string, unit: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid size value: ${value} ${unit}`);
  }
  switch (unit.toLowerCase()) {
    case "b":
      return amount;
    case "kb":
      return amount * 1000;
    case "mb":
      return amount * 1000 * 1000;
    default:
      throw new Error(`Unknown size unit: ${unit}`);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) {
    const kb = bytes / 1000;
    return `${kb} kB`;
  }
  return `${bytes / 1_000_000} MB`;
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "");
}

export function parseNextBuildTable(text: string): ParsedBuildTable {
  const normalized = stripAnsi(String(text ?? "")).replace(/\r\n/g, "\n");
  const routes = new Map<string, ParsedRoute>();
  const sharedChunks: SharedChunk[] = [];
  let sharedFirstLoadJsBytes: number | null = null;

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.replace(/[\u0000-\u001F]/g, "").trimEnd();
    const shared = line.match(SHARED_LINE);
    if (shared) {
      sharedFirstLoadJsBytes = parseByteSize(shared[1], shared[2]);
      continue;
    }

    const chunk = line.match(SHARED_CHUNK_LINE);
    if (chunk && !/other shared chunks/i.test(line)) {
      sharedChunks.push({
        file: `static/chunks/${chunk[1]}`,
        bytes: parseByteSize(chunk[2], chunk[3]),
      });
      continue;
    }

    const route = line.match(ROUTE_LINE);
    if (!route) continue;
    const routePath = route[1];
    if (routePath.startsWith("/api/")) continue;
    routes.set(routePath, {
      route: routePath,
      sizeBytes: parseByteSize(route[2], route[3]),
      firstLoadJsBytes: parseByteSize(route[4], route[5]),
    });
  }

  if (sharedFirstLoadJsBytes == null) {
    throw new Error(
      'Could not parse "First Load JS shared by all" from the Next.js build table.',
    );
  }

  return { routes, sharedFirstLoadJsBytes, sharedChunks };
}

export function requireRoute(
  parsed: ParsedBuildTable,
  route: string,
): ParsedRoute {
  const row = parsed.routes.get(route);
  if (!row) {
    const available = [...parsed.routes.keys()].sort().join(", ");
    throw new Error(
      `Route ${route} was not found in the Next.js build table. Parsed routes: ${available}`,
    );
  }
  return row;
}

export function assertBundleBudgets(
  parsed: ParsedBuildTable,
  budgets: BundleBudgets,
): { trajectory: ParsedRoute; sharedFirstLoadJsBytes: number } {
  const failures: string[] = [];
  const route = budgets.trajectoryRoute;
  const row = requireRoute(parsed, route);

  if (row.firstLoadJsBytes > budgets.trajectoryFirstLoadJsMaxBytes) {
    failures.push(
      `${route} First Load JS ${formatBytes(row.firstLoadJsBytes)} exceeds budget ${formatBytes(budgets.trajectoryFirstLoadJsMaxBytes)}`,
    );
  }

  if (parsed.sharedFirstLoadJsBytes > budgets.sharedFirstLoadJsMaxBytes) {
    failures.push(
      `First Load JS shared by all ${formatBytes(parsed.sharedFirstLoadJsBytes)} exceeds budget ${formatBytes(budgets.sharedFirstLoadJsMaxBytes)}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Bundle size budget failed:\n- ${failures.join("\n- ")}`);
  }

  return {
    trajectory: row,
    sharedFirstLoadJsBytes: parsed.sharedFirstLoadJsBytes,
  };
}

export function findThreeLeaks(
  contentsByPath: Record<string, string>,
): { filePath: string; pattern: string }[] {
  const leaks: { filePath: string; pattern: string }[] = [];
  for (const [filePath, source] of Object.entries(contentsByPath)) {
    const text = String(source);
    for (const pattern of THREE_LEAK_PATTERNS) {
      if (pattern.test(text)) {
        leaks.push({ filePath, pattern: pattern.source });
        break;
      }
    }
  }
  return leaks;
}

export function collectOtherRouteClientFiles(appBuildManifest: {
  pages?: Record<string, string[]>;
}): string[] {
  const files = new Set<string>();
  for (const [page, pageFiles] of Object.entries(appBuildManifest.pages ?? {})) {
    if (page === "/dealey-plaza/trajectory/page") continue;
    for (const file of pageFiles) {
      if (typeof file === "string" && file.endsWith(".js")) files.add(file);
    }
  }
  return [...files];
}

export function findNamedThreeChunks(files: string[]): string[] {
  return files.filter((file) => /three-vendor/.test(file));
}

export function checkProductionArtifacts(options: {
  buildLogText: string;
  budgets?: BundleBudgets;
  listedFiles: string[];
  readFile: (relativePath: string) => string;
}): { trajectory: ParsedRoute; sharedFirstLoadJsBytes: number } {
  const budgets = options.budgets ?? BUNDLE_BUDGETS;
  const parsed = parseNextBuildTable(options.buildLogText);
  const result = assertBundleBudgets(parsed, budgets);
  const named = findNamedThreeChunks(options.listedFiles);
  if (named.length > 0) {
    throw new Error(
      `three-vendor chunk listed on a non-trajectory first-load file list:\n- ${named.join("\n- ")}`,
    );
  }
  const contentsByPath: Record<string, string> = {};
  for (const relative of options.listedFiles) {
    contentsByPath[relative] = options.readFile(relative);
  }
  const leaks = findThreeLeaks(contentsByPath);
  if (leaks.length > 0) {
    throw new Error(
      `three/r3f/drei signatures found in shared or non-trajectory first-load chunks:\n${leaks
        .map((leak) => `- ${leak.filePath} (${leak.pattern})`)
        .join("\n")}`,
    );
  }
  return result;
}
