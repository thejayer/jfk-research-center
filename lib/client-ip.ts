/**
 * Trusted client-IP extraction for Cloud Run behind a Google HTTPS load
 * balancer.
 *
 * Platform `req.ip` wins when the runtime provides it. Otherwise
 * `JFK_TRUSTED_PROXY_HOPS` must be set before X-Forwarded-For / X-Real-IP
 * are trusted. With hops=1 the client is the address immediately left of
 * the last (load-balancer) hop, so a caller-supplied prefix cannot win.
 */

export type ClientIpRequest = {
  ip?: string;
  headers: Pick<Headers, "get">;
};

/**
 * Returns the normalized client address, or "" when it cannot be trusted.
 *
 * @param req Incoming request (NextRequest-compatible).
 * @param env Environment object; defaults to process.env.
 */
export function readTrustedClientIp(
  req: ClientIpRequest,
  env: Record<string, string | undefined> = readProcessEnv(),
): string {
  const platformIp = normalizeClientAddress(req.ip);
  if (platformIp) return platformIp;

  const trustedProxyHops = readTrustedProxyHops(env);
  if (trustedProxyHops > 0) {
    const forwardedFor = clientFromForwardedFor(
      req.headers.get("x-forwarded-for"),
      trustedProxyHops,
    );
    if (forwardedFor) return forwardedFor;

    const realIp = normalizeClientAddress(req.headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  return "";
}

/**
 * Rate-limit / log key: trusted IP, or "unknown" when none can be trusted.
 */
export function clientIpOrUnknown(
  req: ClientIpRequest,
  env: Record<string, string | undefined> = readProcessEnv(),
): string {
  return readTrustedClientIp(req, env) || "unknown";
}

/**
 * Picks the client address from X-Forwarded-For counting hops from the
 * right (trusted proxy side).
 *
 * Example with hops=1 and `spoofed, client, load-balancer`: returns client.
 */
export function clientFromForwardedFor(
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

/**
 * Trims, strips brackets/ports, and collapses IPv4-mapped IPv6 to IPv4.
 */
export function normalizeClientAddress(
  value: string | null | undefined,
): string {
  if (typeof value !== "string") return "";
  let address = value.trim();
  if (!address) return "";

  if (address.startsWith("\"") && address.endsWith("\"") && address.length > 1) {
    address = address.slice(1, -1).trim();
  }

  if (address.startsWith("[")) {
    const end = address.indexOf("]");
    if (end > 1) address = address.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(address)) {
    address = address.slice(0, address.lastIndexOf(":"));
  }

  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) address = mapped[1];

  return address;
}

export function readTrustedProxyHops(
  env: Record<string, string | undefined> = readProcessEnv(),
): number {
  const raw = env.JFK_TRUSTED_PROXY_HOPS;
  if (raw == null || raw.trim() === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
