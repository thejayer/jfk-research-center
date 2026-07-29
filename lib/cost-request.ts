export const JFK_REQUEST_ID_HEADER = "x-jfk-request-id";
export const JFK_REQUEST_FINGERPRINT_HEADER = "x-jfk-request-fingerprint";
export const JFK_TRAFFIC_CLASS_HEADER = "x-jfk-traffic-class";

const REQUEST_ID_PATTERN = /^[a-z0-9_-]{8,63}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{16,64}$/;

export function normalizeRequestId(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeRequestFingerprint(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return FINGERPRINT_PATTERN.test(normalized) ? normalized : "";
}

export function createRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Hashes the cost-relevant route and query shape without retaining raw query
 * text, document ids, filters, or client addresses.
 */
export async function buildCostRequestFingerprint(url: URL): Promise<string> {
  const params = Array.from(url.searchParams.entries())
    .filter(([key]) =>
      [
        "q",
        "mode",
        "agency",
        "yearFrom",
        "yearTo",
        "entity",
        "topic",
        "confidence",
        "offset",
        "record",
      ].includes(key)
    )
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    );
  const input = JSON.stringify([url.pathname, params]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
