/**
 * Verifies declared search-engine crawlers instead of trusting User-Agent.
 *
 * Allowlisted UAs (Googlebot, Bingbot, DuckDuckBot, …) must present a
 * client IP that matches the vendor's published CIDR list or that passes
 * reverse-then-forward DNS against the vendor's hostname suffixes.
 * Results (positive and negative) are cached with a TTL and a hard size
 * cap so verification stays cheap on the Edge/Node middleware runtime.
 *
 * CIDR matching is sync and works on Edge. Reverse-then-forward DNS uses
 * DNS-over-HTTPS (no node:dns, so the Edge middleware bundle stays valid);
 * tests inject a resolver. Missing IP or failed verification is fail-closed.
 */

import { isAllowedSearchBotUserAgent } from "./cost-controls";
import publishedRanges from "./search-bot-ip-ranges.json";

export type SearchBotFamilyId =
  | "google"
  | "bing"
  | "duckduck"
  | "apple"
  | "yandex"
  | "baidu"
  | "yahoo";

export type DnsResolver = {
  reverse(ip: string): Promise<string[]>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
};

export type SearchBotVerifyInput = {
  userAgent: string | null;
  clientIp: string;
  now?: number;
  resolver?: DnsResolver | null;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
};

export type SearchBotVerifyCacheOptions = {
  now?: number;
  ttlMs?: number;
  maxEntries?: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 2048;
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DOH_TIMEOUT_MS = 1500;
const DNS_TYPE_A = 1;
const DNS_TYPE_PTR = 12;
const DNS_TYPE_AAAA = 28;

const FAMILY_UA_PATTERNS: ReadonlyArray<{
  id: SearchBotFamilyId;
  pattern: RegExp;
}> = [
  { id: "google", pattern: /googlebot/i },
  { id: "bing", pattern: /bingbot|msnbot|adidxbot/i },
  { id: "duckduck", pattern: /duckduckbot/i },
  { id: "apple", pattern: /applebot/i },
  { id: "yandex", pattern: /yandex(?:bot|images|mobile)?/i },
  { id: "baidu", pattern: /baiduspider/i },
  { id: "yahoo", pattern: /slurp/i },
];

type CacheEntry = {
  verified: boolean;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

type FamilySpec = {
  id: SearchBotFamilyId;
  suffixes: readonly string[];
  cidrs: readonly string[];
};

const FAMILIES: Record<SearchBotFamilyId, FamilySpec> = {
  google: familyFromSnapshot("google"),
  bing: familyFromSnapshot("bing"),
  duckduck: familyFromSnapshot("duckduck"),
  apple: familyFromSnapshot("apple"),
  yandex: familyFromSnapshot("yandex"),
  baidu: familyFromSnapshot("baidu"),
  yahoo: familyFromSnapshot("yahoo"),
};

/**
 * True only when the UA is an allowlisted search bot *and* the client IP
 * matches that vendor (CIDR or reverse+forward DNS).
 */
export async function verifyDeclaredSearchBot(
  input: SearchBotVerifyInput,
): Promise<boolean> {
  if (!isAllowedSearchBotUserAgent(input.userAgent)) return false;

  const family = matchSearchBotFamily(input.userAgent);
  const ip = normalizeLookupAddress(input.clientIp);
  if (!family || !ip) return false;

  const now = input.now ?? Date.now();
  const cacheKey = `${family.id}:${ip}`;
  const cached = readCache(cacheKey, now);
  if (cached !== undefined) return cached;

  let verified = ipMatchesPublishedCidrs(ip, family.cidrs);
  if (!verified) {
    const resolver =
      input.resolver === undefined ? createDohResolver() : input.resolver;
    if (resolver) {
      const dnsResult = await reverseForwardVerify(
        ip,
        family.suffixes,
        resolver,
      );
      if (dnsResult === "verified") {
        verified = true;
      } else if (dnsResult === "error") {
        // Transient DoH/DNS failures must not become a 30-minute 403.
        return false;
      }
    }
  }

  writeCache(cacheKey, verified, {
    now,
    ttlMs: input.cacheTtlMs,
    maxEntries: input.cacheMaxEntries,
  });
  return verified;
}

export function matchSearchBotFamily(
  userAgent: string | null,
): FamilySpec | null {
  if (!userAgent) return null;
  for (const { id, pattern } of FAMILY_UA_PATTERNS) {
    if (pattern.test(userAgent)) return FAMILIES[id];
  }
  return null;
}

export function ipMatchesPublishedCidrs(
  ip: string,
  cidrs: readonly string[],
): boolean {
  const normalized = normalizeLookupAddress(ip);
  if (!normalized) return false;
  return cidrs.some((cidr) => ipInCidr(normalized, cidr));
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf("/");
  if (slash <= 0) return false;
  const network = cidr.slice(0, slash);
  const prefix = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0) return false;

  const ipIsV6 = normalizedIsIpv6(ip);
  const netIsV6 = normalizedIsIpv6(network);
  if (ipIsV6 !== netIsV6) return false;

  if (ipIsV6) {
    if (prefix > 128) return false;
    const ipN = ipv6ToBigInt(ip);
    const netN = ipv6ToBigInt(network);
    if (ipN == null || netN == null) return false;
    const shift = 128n - BigInt(prefix);
    return (ipN >> shift) === (netN >> shift);
  }

  if (prefix > 32) return false;
  const ipN = ipv4ToInt(ip);
  const netN = ipv4ToInt(network);
  if (ipN == null || netN == null) return false;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipN & mask) === (netN & mask);
}

export function clearSearchBotVerifyCacheForTests(): void {
  cache.clear();
}

export function searchBotVerifyCacheSizeForTests(): number {
  return cache.size;
}

function readCache(key: string, now: number): boolean | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.verified;
}

function writeCache(
  key: string,
  verified: boolean,
  options: SearchBotVerifyCacheOptions = {},
): void {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  pruneCache(now, maxEntries);
  cache.delete(key);
  cache.set(key, { verified, expiresAt: now + ttlMs });
}

function pruneCache(now: number, maxEntries: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= maxEntries) {
    const oldest = cache.keys().next().value;
    if (!oldest) return;
    cache.delete(oldest);
  }
}

type DnsVerifyResult = "verified" | "denied" | "error";

async function reverseForwardVerify(
  ip: string,
  suffixes: readonly string[],
  resolver: DnsResolver,
): Promise<DnsVerifyResult> {
  let hostnames: string[];
  try {
    hostnames = await resolver.reverse(ip);
  } catch {
    return "error";
  }

  let forwardError = false;
  for (const rawHost of hostnames) {
    const hostname = rawHost.replace(/\.$/, "").toLowerCase();
    if (!hostnameMatchesSuffix(hostname, suffixes)) continue;

    let forwards: string[] = [];
    try {
      forwards = normalizedIsIpv6(ip)
        ? await resolver.resolve6(hostname)
        : await resolver.resolve4(hostname);
    } catch {
      forwardError = true;
      continue;
    }

    if (
      forwards.some((candidate) => normalizeLookupAddress(candidate) === ip)
    ) {
      return "verified";
    }
  }
  return forwardError ? "error" : "denied";
}

export function hostnameMatchesSuffix(
  hostname: string,
  suffixes: readonly string[],
): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  return suffixes.some((suffix) => {
    const needle = suffix.replace(/^\./, "").toLowerCase();
    return host === needle || host.endsWith(`.${needle}`);
  });
}

export function createDohResolver(
  fetchImpl: typeof fetch = fetch,
  endpoint = DOH_ENDPOINT,
  timeoutMs = DOH_TIMEOUT_MS,
): DnsResolver {
  return {
    reverse: async (ip) => {
      const records = await dohLookup(
        fetchImpl,
        endpoint,
        ptrNameForIp(ip),
        "PTR",
        timeoutMs,
      );
      return records.map((value) => value.replace(/\.$/, ""));
    },
    resolve4: (hostname) =>
      dohLookup(fetchImpl, endpoint, hostname, "A", timeoutMs),
    resolve6: (hostname) =>
      dohLookup(fetchImpl, endpoint, hostname, "AAAA", timeoutMs),
  };
}

export function ptrNameForIp(ip: string): string {
  const normalized = normalizeLookupAddress(ip);
  if (!normalized) return "";
  if (!normalizedIsIpv6(normalized)) {
    return `${normalized.split(".").reverse().join(".")}.in-addr.arpa`;
  }
  const nibbles = expandIpv6(normalized).replace(/:/g, "").split("");
  return `${nibbles.reverse().join(".")}.ip6.arpa`;
}

async function dohLookup(
  fetchImpl: typeof fetch,
  endpoint: string,
  name: string,
  type: "PTR" | "A" | "AAAA",
  timeoutMs: number,
): Promise<string[]> {
  if (!name) throw new Error("empty dns name");
  const url = new URL(endpoint);
  url.searchParams.set("name", name);
  url.searchParams.set("type", type);
  const response = await fetchImpl(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`doh ${response.status}`);
  const body = (await response.json()) as {
    Answer?: Array<{ type?: number; data?: string }>;
  };
  const wanted =
    type === "PTR" ? DNS_TYPE_PTR : type === "A" ? DNS_TYPE_A : DNS_TYPE_AAAA;
  return (body.Answer ?? [])
    .filter((answer) => answer.type === wanted && typeof answer.data === "string")
    .map((answer) => answer.data as string);
}

function familyFromSnapshot(id: SearchBotFamilyId): FamilySpec {
  const snapshot = (
    publishedRanges as {
      families: Record<string, { suffixes: string[]; cidrs: string[] }>;
    }
  ).families[id];
  return {
    id,
    suffixes: snapshot?.suffixes ?? [],
    cidrs: snapshot?.cidrs ?? [],
  };
}

function normalizeLookupAddress(value: string): string {
  let address = value.trim();
  if (!address) return "";
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.slice(1, -1);
  }
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) address = mapped[1];
  if (ipv4ToInt(address) != null) return address;
  if (ipv6ToBigInt(address) != null) return expandIpv6(address);
  return "";
}

function normalizedIsIpv6(ip: string): boolean {
  return ip.includes(":");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  const expanded = expandIpv6(ip);
  if (!expanded) return null;
  const groups = expanded.split(":");
  if (groups.length !== 8) return null;
  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{4}$/.test(group)) return null;
    value = (value << 16n) + BigInt(Number.parseInt(group, 16));
  }
  return value;
}

function expandIpv6(ip: string): string {
  const dotted = ip.match(/^(.+)::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  let input = ip;
  if (dotted) {
    const octets = dotted[2].split(".").map(Number);
    if (octets.length !== 4 || octets.some((n) => n > 255)) return "";
    input = `${dotted[1]}::ffff:${((octets[0] << 8) + octets[1]).toString(16)}:${(
      (octets[2] << 8) +
      octets[3]
    ).toString(16)}`;
  }

  if (!input.includes(":")) return "";
  const [head, tail] = input.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  if (input.includes("::")) {
    if (headGroups.length + tailGroups.length > 8) return "";
    const missing = 8 - headGroups.length - tailGroups.length;
    const groups = [
      ...headGroups,
      ...Array.from({ length: missing }, () => "0"),
      ...tailGroups,
    ];
    return groups.map(padIpv6Group).join(":");
  }
  if (input.split(":").length !== 8) return "";
  return input.split(":").map(padIpv6Group).join(":");
}

function padIpv6Group(group: string): string {
  return group.toLowerCase().padStart(4, "0");
}
