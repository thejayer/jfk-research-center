import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/admin-auth";
import {
  classifyCostTrafficUserAgent,
  isCostSensitivePath,
  isPubliclyCacheableCostApi,
  readAutomatedTrafficBlockReason,
  readCostRateLimitRule,
} from "@/lib/cost-controls";
import {
  buildCostRequestFingerprint,
  createRequestId,
  JFK_INTERNAL_REQUEST_MARKER_HEADER,
  JFK_REQUEST_FINGERPRINT_HEADER,
  JFK_REQUEST_ID_HEADER,
  JFK_TRAFFIC_CLASS_HEADER,
  normalizeRequestFingerprint,
  normalizeRequestId,
  validateInternalRequestMarker,
} from "@/lib/cost-request";

type CostRateLimitBucket = {
  count: number;
  resetAt: number;
};

type CostRequestSignals = {
  requestId: string;
  requestFingerprint: string;
  trafficClass: ReturnType<typeof classifyCostTrafficUserAgent>;
};

const COST_TRAFFIC_CLASSES = new Set<CostRequestSignals["trafficClass"]>([
  "known_crawler",
  "legacy_mobile_automation",
  "server_fetch",
  "browser",
  "unknown",
]);

const MAX_COST_RATE_LIMIT_BUCKETS = 5000;
const costRateLimitBuckets = new Map<string, CostRateLimitBucket>();

// Gate /admin/* on a valid session cookie. /admin/login is excluded so the
// user can reach it unauthenticated; /api/admin/login is similarly excluded.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const costSensitive = isCostSensitivePath(pathname);
  const costSignals = costSensitive ? await buildCostRequestSignals(req) : null;

  // Emergency cost-control gate: named crawlers and the high-confidence
  // rotating legacy-mobile campaign get a 403 before route rendering.
  const blockReason = costSensitive
    ? readAutomatedTrafficBlockReason(req.headers.get("user-agent"))
    : null;
  if (blockReason) {
    logCostControlEvent("cost_control_block", req, costSignals, blockReason);
    return new NextResponse("automated access disabled for cost control", {
      status: 403,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "x-jfk-cost-control": blockReason,
        ...(costSignals
          ? { [JFK_REQUEST_ID_HEADER]: costSignals.requestId }
          : {}),
      },
    });
  }

  const rateLimitResponse = rateLimitCostSensitiveRequest(req, pathname);
  if (rateLimitResponse) {
    logCostControlEvent("cost_control_rate_limit", req, costSignals);
    if (costSignals) {
      rateLimitResponse.headers.set(
        JFK_REQUEST_ID_HEADER,
        costSignals.requestId,
      );
    }
    return rateLimitResponse;
  }

  const isAdmin = pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
  if (!isAdmin) {
    return costSignals
      ? nextResponseWithCostSignals(req, costSignals)
      : NextResponse.next();
  }

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

async function buildCostRequestSignals(
  req: NextRequest,
): Promise<CostRequestSignals> {
  const trustIncomingSignals = await validateInternalRequestMarker(req.headers);
  return {
    requestId:
      (trustIncomingSignals
        ? normalizeRequestId(req.headers.get(JFK_REQUEST_ID_HEADER))
        : "") ||
      createRequestId(),
    requestFingerprint:
      (trustIncomingSignals
        ? normalizeRequestFingerprint(
            req.headers.get(JFK_REQUEST_FINGERPRINT_HEADER),
          )
        : "") || (await buildCostRequestFingerprint(new URL(req.url))),
    trafficClass:
      (trustIncomingSignals
        ? normalizeTrafficClass(req.headers.get(JFK_TRAFFIC_CLASS_HEADER))
        : null) ??
      classifyCostTrafficUserAgent(req.headers.get("user-agent")),
  };
}

function normalizeTrafficClass(
  value: string | null,
): CostRequestSignals["trafficClass"] | null {
  return COST_TRAFFIC_CLASSES.has(value as CostRequestSignals["trafficClass"])
    ? (value as CostRequestSignals["trafficClass"])
    : null;
}

function nextResponseWithCostSignals(
  req: NextRequest,
  signals: CostRequestSignals,
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(JFK_INTERNAL_REQUEST_MARKER_HEADER);
  requestHeaders.set(JFK_REQUEST_ID_HEADER, signals.requestId);
  requestHeaders.set(
    JFK_REQUEST_FINGERPRINT_HEADER,
    signals.requestFingerprint,
  );
  requestHeaders.set(JFK_TRAFFIC_CLASS_HEADER, signals.trafficClass);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (!isPubliclyCacheableCostApi(req.nextUrl.pathname)) {
    response.headers.set(JFK_REQUEST_ID_HEADER, signals.requestId);
  }
  return response;
}

function logCostControlEvent(
  event: "cost_control_block" | "cost_control_rate_limit",
  req: NextRequest,
  signals: CostRequestSignals | null,
  reason?: string,
): void {
  console.info(
    JSON.stringify({
      event,
      path: req.nextUrl.pathname,
      requestId: signals?.requestId ?? null,
      requestFingerprint: signals?.requestFingerprint ?? null,
      trafficClass: signals?.trafficClass ?? "unknown",
      ...(reason ? { reason } : {}),
    }),
  );
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
    "/api/v1/:path*",
  ],
};
