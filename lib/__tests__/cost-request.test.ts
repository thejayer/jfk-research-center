import { describe, expect, it } from "vitest";
import {
  buildCostRequestFingerprint,
  createInternalRequestMarker,
  JFK_INTERNAL_REQUEST_MARKER_HEADER,
  normalizeRequestFingerprint,
  normalizeRequestId,
  validateInternalRequestMarker,
} from "../cost-request";

describe("cost request signals", () => {
  it("accepts only bounded request ids and fingerprints", () => {
    expect(normalizeRequestId(" Request_123 ")).toBe("request_123");
    expect(normalizeRequestId("short")).toBe("");
    expect(normalizeRequestId("contains spaces")).toBe("");
    expect(normalizeRequestFingerprint("ABCDEF0123456789")).toBe(
      "abcdef0123456789",
    );
    expect(normalizeRequestFingerprint("not-a-hash")).toBe("");
  });

  it("creates a stable, privacy-safe fingerprint for equivalent queries", async () => {
    const left = await buildCostRequestFingerprint(
      new URL(
        "https://researchjfk.ai/search?mode=mention&q=Oswald&topic=cuba&utm_source=test",
      ),
    );
    const right = await buildCostRequestFingerprint(
      new URL(
        "https://researchjfk.ai/search?topic=cuba&q=Oswald&mode=mention&utm_source=other",
      ),
    );
    const changed = await buildCostRequestFingerprint(
      new URL(
        "https://researchjfk.ai/search?topic=cuba&q=Ruby&mode=mention",
      ),
    );

    expect(left).toMatch(/^[a-f0-9]{24}$/);
    expect(right).toBe(left);
    expect(changed).not.toBe(left);
    expect(left).not.toContain("oswald");
  });

  it("accepts attribution only with a valid server-generated marker", async () => {
    const secret = "test-internal-marker-secret";
    const headers = new Headers({
      "x-jfk-request-id": "request_123",
      "x-jfk-request-fingerprint": "abcdef0123456789",
      "x-jfk-traffic-class": "browser",
    });
    headers.set(
      JFK_INTERNAL_REQUEST_MARKER_HEADER,
      await createInternalRequestMarker(headers, secret),
    );

    expect(await validateInternalRequestMarker(headers, secret)).toBe(true);
    headers.set("x-jfk-traffic-class", "known_crawler");
    expect(await validateInternalRequestMarker(headers, secret)).toBe(false);
    expect(
      await validateInternalRequestMarker(headers, "different-server-secret"),
    ).toBe(false);
  });
});
