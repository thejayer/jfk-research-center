const DEFAULT_BIGQUERY_MAX_BYTES_BILLED = 256 * 1024 * 1024;
const DEFAULT_COST_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_COST_RATE_LIMIT_MAX_REQUESTS = 60;

const COST_SENSITIVE_PATH_PREFIXES = [
  "/search",
  "/api/search",
  "/document",
  "/api/document",
  "/compare",
  "/api/compare",
] as const;

const BLOCKED_CRAWLER_PATTERNS = [
  /gptbot/i,
  /oai-searchbot/i,
  /chatgpt-user/i,
  /claudebot/i,
  /claude-searchbot/i,
  /anthropic-ai/i,
  /bytespider/i,
  /perplexitybot/i,
  /ccbot/i,
  /google-extended/i,
  /applebot-extended/i,
  /meta-externalagent/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /petalbot/i,
] as const;

const COST_RATE_LIMIT_RULES = [
  { prefix: "/api/search", key: "api-search", maxRequests: 20 },
  { prefix: "/search", key: "search", maxRequests: 30 },
  { prefix: "/api/compare", key: "api-compare", maxRequests: 30 },
  { prefix: "/compare", key: "compare", maxRequests: 30 },
  { prefix: "/api/document", key: "api-document", maxRequests: 60 },
  { prefix: "/document", key: "document", maxRequests: 60 },
] as const;

export type CostRateLimitRule = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

/**
 * Returns true when the pathname can fan out into live warehouse work.
 *
 * @param pathname Request pathname from Next.js routing.
 * @returns Whether crawler traffic should be cost-gated before rendering.
 */
export function isCostSensitivePath(pathname: string): boolean {
  return COST_SENSITIVE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Matches known high-volume crawler user agents that should not hit costly routes.
 *
 * @param userAgent Raw User-Agent header value, or null when absent.
 * @returns Whether the request should receive the crawler cost-control block.
 */
export function isBlockedCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BLOCKED_CRAWLER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Reads the route-level cost throttle for a warehouse-backed path.
 *
 * @param pathname Request pathname from Next.js routing.
 * @param env Environment object; defaults to process.env.
 * @returns A throttle rule for cost-sensitive routes, or null when disabled/not applicable.
 */
export function readCostRateLimitRule(
  pathname: string,
  env: Record<string, string | undefined> = readProcessEnv(),
): CostRateLimitRule | null {
  if (env.JFK_COST_RATE_LIMIT_DISABLED === "1") return null;

  const rule = COST_RATE_LIMIT_RULES.find((item) => pathMatchesPrefix(pathname, item.prefix));
  if (!rule && !isCostSensitivePath(pathname)) return null;

  const maxRequests =
    readPositiveInt(env.JFK_COST_RATE_LIMIT_MAX_REQUESTS) ??
    rule?.maxRequests ??
    DEFAULT_COST_RATE_LIMIT_MAX_REQUESTS;
  const windowSeconds =
    readPositiveInt(env.JFK_COST_RATE_LIMIT_WINDOW_SECONDS) ??
    DEFAULT_COST_RATE_LIMIT_WINDOW_SECONDS;

  return {
    key: rule?.key ?? "cost-sensitive",
    maxRequests,
    windowMs: windowSeconds * 1000,
  };
}

/**
 * Reads the semantic-search kill switch from the provided environment.
 *
 * @param env Environment object; defaults to process.env.
 * @returns True only when JFK_API_DISABLE_SEMANTIC_SEARCH is set to "1".
 */
export function isSemanticSearchDisabled(
  env: Record<string, string | undefined> = readProcessEnv(),
): boolean {
  return env.JFK_API_DISABLE_SEMANTIC_SEARCH === "1";
}

/**
 * Reads the BigQuery per-job maximum bytes cap in fail-closed form.
 *
 * @param env Environment object; defaults to process.env.
 * @returns Numeric string for BigQuery maximumBytesBilled; invalid values use the safe default.
 */
export function readBigQueryMaximumBytesBilled(
  env: Record<string, string | undefined> = readProcessEnv(),
): string {
  const raw = env.JFK_BQ_MAX_BYTES_BILLED;
  if (raw == null || raw.trim() === "") {
    return String(DEFAULT_BIGQUERY_MAX_BYTES_BILLED);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return String(DEFAULT_BIGQUERY_MAX_BYTES_BILLED);
  }
  return String(Math.floor(parsed));
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function readPositiveInt(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
