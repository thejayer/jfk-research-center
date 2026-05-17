import { errorResponse } from "./api-v1";
import type { PublicApiEndpointPolicy, PublicApiRateWindow } from "./public-api-access";

export type PublicApiKeyStatus = "active" | "paused" | "revoked";

export type PublicApiKeyRecord = {
  keyId: string;
  status: PublicApiKeyStatus;
  tier: "researcher" | "partner" | "internal";
};

export type PublicApiCounterResult = {
  count: number;
  resetAt: number;
};

export type PublicApiEnforcementStore = {
  lookupApiKey(rawKey: string): Promise<PublicApiKeyRecord | null>;
  incrementCounter(
    bucket: string,
    window: PublicApiRateWindow,
    now: number,
  ): Promise<PublicApiCounterResult>;
};

export type PublicApiEnforcementResult =
  | {
      ok: true;
      keyRecord: PublicApiKeyRecord | null;
      rateLimit: PublicApiCounterResult | null;
    }
  | {
      ok: false;
      response: Response;
    };

export type PublicApiEnforcementOptions = {
  now?: number;
  clientIp?: string;
  env?: Record<string, string | undefined>;
  store?: PublicApiEnforcementStore;
};

const AUTH_BEARER_RE = /^Bearer\s+(.+)$/i;
const DEFAULT_ANONYMOUS_IP = "unknown";

export async function enforcePublicApiAccess(
  req: Request,
  policy: PublicApiEndpointPolicy,
  opts: PublicApiEnforcementOptions = {},
): Promise<PublicApiEnforcementResult> {
  const env = opts.env ?? readProcessEnv();
  const now = opts.now ?? Date.now();
  const store = opts.store ?? defaultPublicApiEnforcementStore;

  if (policy.killSwitch && env[policy.killSwitch] === "1") {
    return denied("endpoint temporarily disabled", 503);
  }

  const rawKey = readApiKey(req);
  const keyRecord = rawKey ? await store.lookupApiKey(rawKey) : null;

  if (rawKey && !keyRecord) {
    return denied("api key not allowed", 403);
  }

  if (keyRecord && keyRecord.status !== "active") {
    return denied("api key not allowed", 403);
  }

  if (policy.targetAccess === "key_required" && !keyRecord) {
    return denied("api key required", 401);
  }

  const limit = keyRecord ? policy.keyedLimit : policy.anonymousLimit;
  if (!limit) return { ok: true, keyRecord, rateLimit: null };

  const bucket = keyRecord
    ? `key:${keyRecord.keyId}:${policy.path}`
    : `ip:${opts.clientIp ?? readClientIp(req) ?? DEFAULT_ANONYMOUS_IP}:${policy.path}`;
  const rateLimit = await store.incrementCounter(bucket, limit, now);

  if (rateLimit.count > limit.requests) {
    const retryAfter = Math.max(1, Math.ceil((rateLimit.resetAt - now) / 1000));
    return denied("rate limit exceeded", 429, {
      "retry-after": String(retryAfter),
    });
  }

  return { ok: true, keyRecord, rateLimit };
}

export function readApiKey(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  const bearer = authorization?.match(AUTH_BEARER_RE)?.[1]?.trim();
  if (bearer) return bearer;

  const headerKey = req.headers.get("x-jfkrc-api-key")?.trim();
  return headerKey || null;
}

export class InMemoryPublicApiEnforcementStore
  implements PublicApiEnforcementStore
{
  private readonly keys = new Map<string, PublicApiKeyRecord>();
  private readonly counters = new Map<string, PublicApiCounterResult>();

  constructor(keys: Record<string, PublicApiKeyRecord> = {}) {
    for (const [rawKey, record] of Object.entries(keys)) {
      this.keys.set(rawKey, record);
    }
  }

  async lookupApiKey(rawKey: string): Promise<PublicApiKeyRecord | null> {
    return this.keys.get(rawKey) ?? null;
  }

  async incrementCounter(
    bucket: string,
    window: PublicApiRateWindow,
    now: number,
  ): Promise<PublicApiCounterResult> {
    const current = this.counters.get(bucket);
    if (!current || current.resetAt <= now) {
      const next = {
        count: 1,
        resetAt: now + window.windowSeconds * 1000,
      };
      this.counters.set(bucket, next);
      return next;
    }

    const next = { ...current, count: current.count + 1 };
    this.counters.set(bucket, next);
    return next;
  }
}

export const defaultPublicApiEnforcementStore =
  new InMemoryPublicApiEnforcementStore(readConfiguredKeys(readProcessEnv()));

function denied(
  message: string,
  status: number,
  headers?: Record<string, string>,
): PublicApiEnforcementResult {
  return {
    ok: false,
    response: errorResponse(message, status, headers),
  };
}

function readClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function readConfiguredKeys(
  env: Record<string, string | undefined>,
): Record<string, PublicApiKeyRecord> {
  const rawKeys = (env.JFK_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  return Object.fromEntries(
    rawKeys.map((key, index) => [
      key,
      {
        keyId: `env-${index + 1}`,
        status: "active" as const,
        tier: "researcher" as const,
      },
    ]),
  );
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
