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

  it("passes the request path into the automated-traffic block", () => {
    expect(middlewareSource).toMatch(
      /readAutomatedTrafficBlockReason\(\s*req\.headers\.get\("user-agent"\),\s*undefined,\s*pathname,\s*\)/,
    );
  });
});
