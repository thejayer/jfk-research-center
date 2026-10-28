import { describe, expect, it } from "vitest";
import {
  clientFromForwardedFor,
  clientIpOrUnknown,
  normalizeClientAddress,
  readTrustedClientIp,
} from "../client-ip";

describe("client IP behind a Google load balancer", () => {
  it("prefers platform req.ip over spoofable forwarded headers", () => {
    const ip = readTrustedClientIp(
      {
        ip: "203.0.113.9",
        headers: new Headers({
          "x-forwarded-for": "198.51.100.1, 203.0.113.9, 35.191.0.1",
        }),
      },
      { JFK_TRUSTED_PROXY_HOPS: "1" },
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("takes the hop left of the load balancer when hops=1", () => {
    const ip = readTrustedClientIp(
      {
        headers: new Headers({
          "x-forwarded-for": "198.51.100.1, 203.0.113.10, 35.191.0.1",
        }),
      },
      { JFK_TRUSTED_PROXY_HOPS: "1" },
    );
    expect(ip).toBe("203.0.113.10");
  });

  it("does not trust a lone caller-supplied X-Forwarded-For when hops=1", () => {
    const ip = readTrustedClientIp(
      {
        headers: new Headers({
          "x-forwarded-for": "198.51.100.1",
        }),
      },
      { JFK_TRUSTED_PROXY_HOPS: "1" },
    );
    expect(ip).toBe("");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is too short", () => {
    const ip = readTrustedClientIp(
      {
        headers: new Headers({
          "x-forwarded-for": "35.191.0.1",
          "x-real-ip": "203.0.113.20",
        }),
      },
      { JFK_TRUSTED_PROXY_HOPS: "1" },
    );
    expect(ip).toBe("203.0.113.20");
  });

  it("ignores forwarded headers when trusted hops are unset", () => {
    const ip = readTrustedClientIp({
      headers: new Headers({
        "x-forwarded-for": "203.0.113.10, 35.191.0.1",
        "x-real-ip": "203.0.113.10",
      }),
    });
    expect(ip).toBe("");
    expect(clientIpOrUnknown({ headers: new Headers() })).toBe("unknown");
  });

  it("normalizes IPv4-mapped IPv6, brackets, and IPv4:port", () => {
    expect(normalizeClientAddress("::ffff:203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeClientAddress("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normalizeClientAddress("203.0.113.10:8080")).toBe("203.0.113.10");
    expect(
      clientFromForwardedFor("198.51.100.1, ::ffff:203.0.113.10, 35.191.0.1", 1),
    ).toBe("203.0.113.10");
  });
});
