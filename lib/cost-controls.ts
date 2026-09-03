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
  "/api/v1/documents",
  "/api/v1/search/semantic",
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

const LEGACY_MOBILE_AUTOMATION_PATTERN =
  /Mozilla\/5\.0 \(Linux; Android 6(?:\.0(?:\.1)?)?; Nexus 5(?: Build\/[^)]+)?\).*Chrome\/65(?:\.\d+){0,3}.*Mobile Safari\/537\.36/i;

const COST_RATE_LIMIT_RULES = [
  { prefix: "/api/v1/search/semantic", key: "api-v1-semantic", maxRequests: 10 },
  { prefix: "/api/v1/documents", key: "api-v1-documents", maxRequests: 20 },
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

export type CostTrafficClass =
  | "known_crawler"
  | "legacy_mobile_automation"
  | "server_fetch"
  | "browser"
  | "unknown";

export type AutomatedTrafficBlockReason =
  | "known-crawler"
  | "legacy-mobile-fingerprint";

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
 * Public document/search JSON (and the HTML document page) may be reused
 * by Cloud CDN / browsers. Middleware still rate-limits and blocks
 * crawlers; it just omits the per-request id from the *response* so a
 * unique header cannot bust a shared cache. Admin / redaction routes are
 * never matched here.
 */
export function isPubliclyCacheableCostApi(pathname: string): boolean {
  if (
    pathname === "/api/search" ||
    pathname === "/api/v1/documents" ||
    pathname === "/api/v1/search/semantic"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/document/")) return true;
  if (pathMatchesPrefix(pathname, "/document")) return true;
  return /^\/api\/v1\/documents\/[^/]+$/.test(pathname);
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
 * Detects the exact legacy mobile browser family used by the July 2026
 * rotating enumeration campaign.
 *
 * The signal is intentionally narrow: Android 6, Nexus 5, and Chrome 65 must
 * all be present. Broader old-browser blocking would create unnecessary false
 * positives for legitimate researchers.
 */
export function isLegacyMobileAutomationUserAgent(
  userAgent: string | null,
): boolean {
  if (!userAgent) return false;
  return LEGACY_MOBILE_AUTOMATION_PATTERN.test(userAgent);
}

/**
 * Returns a privacy-safe traffic class for request and BigQuery attribution.
 */
export function classifyCostTrafficUserAgent(
  userAgent: string | null,
): CostTrafficClass {
  if (isBlockedCrawlerUserAgent(userAgent)) return "known_crawler";
  if (isLegacyMobileAutomationUserAgent(userAgent)) {
    return "legacy_mobile_automation";
  }
  if (!userAgent) return "unknown";
  if (/^(?:node|undici)(?:\/|$)/i.test(userAgent.trim())) return "server_fetch";
  if (/mozilla\/5\.0/i.test(userAgent)) return "browser";
  return "unknown";
}

/**
 * Identifies high-confidence automated traffic that should never reach a
 * warehouse-backed route.
 */
export function readAutomatedTrafficBlockReason(
  userAgent: string | null,
  env: Record<string, string | undefined> = readProcessEnv(),
): AutomatedTrafficBlockReason | null {
  if (isBlockedCrawlerUserAgent(userAgent)) return "known-crawler";
  if (env.JFK_LEGACY_MOBILE_BLOCK_DISABLED === "1") return null;
  if (isLegacyMobileAutomationUserAgent(userAgent)) {
    return "legacy-mobile-fingerprint";
  }
  return null;
}

/**
 * Returns true for archive identifiers that can be resolved with direct
 * equality predicates instead of full text/OCR scans.
 */
export function isArchiveIdentifierQuery(value: string): boolean {
  const query = value.trim();
  return (
    /^\d{3}-\d{4,6}-\d{3,6}$/.test(query) ||
    /^\d{7,12}$/.test(query)
  );
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
