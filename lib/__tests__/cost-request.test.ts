import { describe, expect, it } from "vitest";
import {
  buildCostRequestFingerprint,
  normalizeRequestFingerprint,
  normalizeRequestId,
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
});
