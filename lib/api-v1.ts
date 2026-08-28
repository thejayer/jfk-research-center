/**
 * Shared helpers for `/api/v1/*` public endpoints.
 *
 * The public API re-exposes the same warehouse-backed responses the
 * first-party `/api/*` routes use, with permissive CORS so scripts and
 * browser clients can call it from anywhere. Warehouse and Vertex
 * endpoints require an API key; CORS is not anonymous access.
 *
 * Access-control policy lives in docs/public-api-access-control.md and
 * lib/public-api-access.ts. Every v1 route applies that policy before
 * doing warehouse or Vertex work.
 */

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-jfkrc-api-key",
  "access-control-max-age": "86400",
};

export function jsonResponse<T>(
  data: T,
  opts: { cacheSeconds?: number; status?: number; headers?: Record<string, string> } = {},
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
    ...(opts.headers ?? {}),
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

export function errorResponse(
  message: string,
  status = 500,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, { status, headers });
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
