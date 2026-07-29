export const JFK_REQUEST_ID_HEADER = "x-jfk-request-id";
export const JFK_REQUEST_FINGERPRINT_HEADER = "x-jfk-request-fingerprint";
export const JFK_TRAFFIC_CLASS_HEADER = "x-jfk-traffic-class";
export const JFK_INTERNAL_REQUEST_MARKER_HEADER =
  "x-jfk-internal-request-marker";

const REQUEST_ID_PATTERN = /^[a-z0-9_-]{8,63}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{16,64}$/;
const INTERNAL_MARKER_PATTERN = /^[a-f0-9]{64}$/;
const INTERNAL_MARKER_DOMAIN = "jfk-cost-attribution-v1";

type HeaderReader = Pick<Headers, "get">;

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
 * Signs attribution headers for server-generated loopback requests. External
 * callers can send the marker header, but cannot create a valid signature.
 */
export async function createInternalRequestMarker(
  headers: HeaderReader,
  secret = readInternalRequestSecret(),
): Promise<string> {
  if (!isUsableSecret(secret)) return "";
  const signature = await crypto.subtle.sign(
    "HMAC",
    await internalMarkerKey(secret),
    new TextEncoder().encode(internalMarkerPayload(headers)),
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function validateInternalRequestMarker(
  headers: HeaderReader,
  secret = readInternalRequestSecret(),
): Promise<boolean> {
  const marker = headers
    .get(JFK_INTERNAL_REQUEST_MARKER_HEADER)
    ?.trim()
    .toLowerCase() ?? "";
  if (!isUsableSecret(secret) || !INTERNAL_MARKER_PATTERN.test(marker)) {
    return false;
  }

  return crypto.subtle.verify(
    "HMAC",
    await internalMarkerKey(secret),
    hexToBytes(marker),
    new TextEncoder().encode(internalMarkerPayload(headers)),
  );
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

function internalMarkerPayload(headers: HeaderReader): string {
  return [
    INTERNAL_MARKER_DOMAIN,
    normalizeRequestId(headers.get(JFK_REQUEST_ID_HEADER)),
    normalizeRequestFingerprint(
      headers.get(JFK_REQUEST_FINGERPRINT_HEADER),
    ),
    headers.get(JFK_TRAFFIC_CLASS_HEADER)?.trim().toLowerCase() ?? "",
  ].join("\n");
}

async function internalMarkerKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function readInternalRequestSecret(): string {
  if (typeof process === "undefined") return "";
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

function isUsableSecret(secret: string): boolean {
  return secret.length >= 16;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(value: string): Uint8Array {
  return Uint8Array.from(
    value.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
  );
}
