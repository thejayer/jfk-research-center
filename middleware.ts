import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/admin-auth";
import {
  isBlockedCrawlerUserAgent,
  isCostSensitivePath,
  readCostRateLimitRule,
} from "@/lib/cost-controls";

type CostRateLimitBucket = {
  count: number;
  resetAt: number;
};

const MAX_COST_RATE_LIMIT_BUCKETS = 5000;
const costRateLimitBuckets = new Map<string, CostRateLimitBucket>();

// Gate /admin/* on a valid session cookie. /admin/login is excluded so the
// user can reach it unauthenticated; /api/admin/login is similarly excluded.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Emergency cost-control gate: known crawlers get an intentional 403
  // NextResponse before they can trigger expensive search/document work.
  if (
    isCostSensitivePath(pathname) &&
    isBlockedCrawlerUserAgent(req.headers.get("user-agent"))
  ) {
    return new NextResponse("crawler access disabled for cost control", {
      status: 403,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  const rateLimitResponse = rateLimitCostSensitiveRequest(req, pathname);
  if (rateLimitResponse) return rateLimitResponse;

  const isAdmin = pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
  if (!isAdmin) return NextResponse.next();

  const isLogin =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login";

  if (isLogin) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!(await verifySessionValue(cookie?.value))) {
    // For API routes, return 401 JSON so the client can react.
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      );
    }
    // For pages, bounce to login with a return-to hint.
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/**
 * Enforces the configured throttle for warehouse-backed routes.
 *
 * @param req Incoming Next.js request used to derive a client bucket key.
 * @param pathname Request pathname used by readCostRateLimitRule.
 * @returns A 429 response with retry-after/x-ratelimit headers, or null when allowed.
 */
function rateLimitCostSensitiveRequest(
  req: NextRequest,
  pathname: string,
): NextResponse | null {
  const rule = readCostRateLimitRule(pathname);
  if (!rule) return null;

  const now = Date.now();
  pruneExpiredCostRateLimitBuckets(now);

  const key = `${clientIdentifier(req)}:${rule.key}`;
  let bucket = costRateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    costRateLimitBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count <= rule.maxRequests) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return new NextResponse("too many requests for cost-controlled route", {
    status: 429,
    headers: {
      "cache-control": "no-store",
      "retry-after": String(retryAfterSeconds),
      "x-ratelimit-limit": String(rule.maxRequests),
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": new Date(bucket.resetAt).toISOString(),
    },
  });
}

/**
 * Builds the rate-limit client key from trusted request metadata.
 *
 * Prefers platform-provided req.ip when available. Forwarded headers are only
 * used when JFK_TRUSTED_PROXY_HOPS is configured; x-forwarded-for is parsed
 * from the trusted proxy side before falling back to x-real-ip or "unknown".
 */
function clientIdentifier(req: NextRequest): string {
  const platformIp = normalizeClientAddress(
    (req as NextRequest & { ip?: string }).ip,
  );
  if (platformIp) return platformIp;

  const trustedProxyHops = readTrustedProxyHops();
  if (trustedProxyHops > 0) {
    const forwardedFor = clientFromForwardedFor(
      req.headers.get("x-forwarded-for"),
      trustedProxyHops,
    );
    if (forwardedFor) return forwardedFor;

    const realIp = normalizeClientAddress(req.headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  return "unknown";
}

/**
 * Keeps the shared in-memory costRateLimitBuckets map bounded.
 *
 * First sweeps expired buckets by comparing bucket.resetAt to now, then deletes
 * oldest Map entries until size is <= MAX_COST_RATE_LIMIT_BUCKETS.
 */
function pruneExpiredCostRateLimitBuckets(now: number): void {
  if (costRateLimitBuckets.size <= MAX_COST_RATE_LIMIT_BUCKETS) return;

  for (const [key, bucket] of costRateLimitBuckets) {
    if (bucket.resetAt <= now) costRateLimitBuckets.delete(key);
  }

  while (costRateLimitBuckets.size > MAX_COST_RATE_LIMIT_BUCKETS) {
    const oldestKey = costRateLimitBuckets.keys().next().value;
    if (!oldestKey) return;
    costRateLimitBuckets.delete(oldestKey);
  }
}

function clientFromForwardedFor(
  forwardedFor: string | null,
  trustedProxyHops: number,
): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map(normalizeClientAddress)
    .filter(Boolean);
  if (parts.length <= trustedProxyHops) return "";
  return parts[parts.length - trustedProxyHops - 1] ?? "";
}

function normalizeClientAddress(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTrustedProxyHops(): number {
  const raw = typeof process === "undefined"
    ? undefined
    : process.env.JFK_TRUSTED_PROXY_HOPS;
  if (raw == null || raw.trim() === "") return 0;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/search/:path*",
    "/api/search/:path*",
    "/document/:path*",
    "/api/document/:path*",
    "/compare/:path*",
    "/api/compare/:path*",
  ],
};
