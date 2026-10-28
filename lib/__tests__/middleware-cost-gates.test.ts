import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const middlewareSource = readFileSync(
  new URL("../../middleware.ts", import.meta.url),
  "utf8",
);

describe("middleware cost gates", () => {
  it("matches document and entity warehouse routes for fingerprint labeling", () => {
    expect(middlewareSource).toContain('"/document/:path*"');
    expect(middlewareSource).toContain('"/api/document/:path*"');
    expect(middlewareSource).toContain('"/entity/:path*"');
    expect(middlewareSource).toContain('"/api/entity/:path*"');
    expect(middlewareSource).toContain("readAutomatedTrafficBlockReason");
    expect(middlewareSource).toContain("pathname");
    expect(middlewareSource).toContain("buildCostRequestFingerprint");
    expect(middlewareSource).toContain("JFK_TRAFFIC_CLASS_HEADER");
  });

  it("passes the request path and search-bot verification into the block", () => {
    expect(middlewareSource).toContain("verifyDeclaredSearchBot");
    expect(middlewareSource).toContain("readTrustedClientIp");
    expect(middlewareSource).toContain("searchBotVerified");
    expect(middlewareSource).toMatch(
      /readAutomatedTrafficBlockReason\(\s*userAgent,\s*undefined,\s*pathname,\s*\{\s*searchBotVerified,/,
    );
  });
});
