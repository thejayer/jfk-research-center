/**
 * Admin session cookie — shared-token gate for /admin/*.
 *
 * Uses Web Crypto API (available in both Node and the Edge runtime)
 * so middleware.ts can import verifySessionValue directly.
 *
 * Why this and not OAuth: this surface has one user (the site owner). A
 * password-equivalent token set via env var is fast to ship and secure
 * enough. Rotate by changing ADMIN_TOKEN + ADMIN_SESSION_SECRET on Cloud Run.
 */

const SESSION_COOKIE = "jfk_admin_session";
const SESSION_LIFETIME_SEC = 7 * 24 * 60 * 60;

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET is unset or too short; refuse to sign",
    );
  }
  return s;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(getSecret());
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(sig));
}

async function verifySig(payload: string, sigB64: string): Promise<boolean> {
  let sig: Uint8Array;
  try {
    sig = fromBase64Url(sigB64);
  } catch {
    return false;
  }
  const key = await hmacKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(payload),
  );
}

export function expectedToken(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= 8 ? t : null;
}

export function tokenMatches(submitted: string): boolean {
  const expected = expectedToken();
  if (!expected) return false;
  const enc = new TextEncoder();
  return constantTimeEqual(enc.encode(submitted), enc.encode(expected));
}

export async function issueSessionCookie(): Promise<{
  name: string;
  value: string;
  maxAge: number;
}> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SEC;
  const payload = `admin:${exp}`;
  const sig = await sign(payload);
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${sig}`,
    maxAge: SESSION_LIFETIME_SEC,
  };
}

export function clearedSessionCookie(): {
  name: string;
  value: string;
  maxAge: number;
} {
  return { name: SESSION_COOKIE, value: "", maxAge: 0 };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export async function verifySessionValue(
  raw: string | undefined,
): Promise<boolean> {
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  let ok: boolean;
  try {
    ok = await verifySig(payload, sig);
  } catch {
    return false;
  }
  if (!ok) return false;

  const parts = payload.split(":");
  if (parts.length !== 2 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp)) return false;
  return Math.floor(Date.now() / 1000) < exp;
}

// Reviewer identity written into docai_redactions. Single-admin MVP.
export const ADMIN_REVIEWER_ID = "admin";
