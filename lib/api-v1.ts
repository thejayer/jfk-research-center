/**
 * Shared helpers for `/api/v1/*` public endpoints.
 *
 * The public API intentionally re-exposes the same warehouse-backed
 * responses the private `/api/*` routes use; it just adds permissive
 * CORS so researchers and scripts can consume the data from anywhere,
 * plus conservative cache headers since the underlying data changes
 * slowly (per-release cadence, not per-request).
 *
 * Rate limiting and API keys (ticket PW-5E-2) are deferred to a later
 * session. All endpoints are currently unauthenticated and open.
 */

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function jsonResponse<T>(
  data: T,
  opts: { cacheSeconds?: number; status?: number } = {},
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  };
  if (opts.cacheSeconds && opts.cacheSeconds > 0) {
    headers["cache-control"] =
      `public, s-maxage=${opts.cacheSeconds}, stale-while-revalidate=${opts.cacheSeconds * 5}`;
  } else {
    headers["cache-control"] = "no-store";
  }
  return new Response(JSON.stringify(data), {
    status: opts.status ?? 200,
    headers,
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, { status });
}

export function notFoundResponse(message = "not found"): Response {
  return errorResponse(message, 404);
}

/** Preflight handler. Apply as `export const OPTIONS = preflight;` per route. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function parseIntOrNull(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
