import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueSessionCookie,
  SESSION_COOKIE_NAME,
  tokenMatches,
  verifySessionValue,
} from "../admin-auth";
import { middleware } from "../../middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin auth", () => {
  it("requires the configured admin token before issuing sessions", () => {
    vi.stubEnv("ADMIN_TOKEN", "local-admin-token");

    expect(tokenMatches("local-admin-token")).toBe(true);
    expect(tokenMatches("wrong-token")).toBe(false);
  });

  it("issues signed session cookies and rejects tampering", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "0123456789abcdef0123456789abcdef");

    const cookie = await issueSessionCookie();

    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    await expect(verifySessionValue(cookie.value)).resolves.toBe(true);
    await expect(verifySessionValue(`${cookie.value}tampered`)).resolves.toBe(false);
    await expect(verifySessionValue(undefined)).resolves.toBe(false);
  });
});

describe("admin middleware", () => {
  it("rejects unauthenticated admin API requests", async () => {
    const res = await middleware(mockRequest("https://jfk.local/api/admin/redactions"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("redirects unauthenticated admin pages to login with a return path", async () => {
    const res = await middleware(mockRequest("https://jfk.local/admin/redactions"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://jfk.local/admin/login?next=%2Fadmin%2Fredactions",
    );
  });
});

function mockRequest(url: string) {
  const nextUrl = new URL(url) as URL & { clone: () => URL };
  nextUrl.clone = () => new URL(nextUrl.toString());

  return {
    nextUrl,
    cookies: {
      get: () => undefined,
    },
  } as never;
}
