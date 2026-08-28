import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public/robots.txt", () => {
  const robots = readFileSync(
    path.join(process.cwd(), "public/robots.txt"),
    "utf8",
  );

  it("advertises the apex sitemap without changing crawler rules", () => {
    expect(robots).toContain("Sitemap: https://researchjfk.ai/sitemap.xml");
    expect(robots).not.toContain("www.researchjfk.ai");

    expect(robots).toMatch(/User-agent:\s+GPTBot\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+OAI-SearchBot\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+ChatGPT-User[\s\S]*Disallow:\s+\/document/);
    expect(robots).toMatch(/User-agent:\s+ClaudeBot\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+Claude-SearchBot\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+anthropic-ai\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+Bytespider\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+PerplexityBot\s+Disallow:\s+\//);
    expect(robots).toMatch(/User-agent:\s+CCBot\s+Disallow:\s+\//);

    expect(robots).toMatch(
      /User-agent:\s+\*\s+Disallow:\s+\/api\/\s+Disallow:\s+\/search\s+Disallow:\s+\/admin\s+Disallow:\s+\/admin\//,
    );
  });
});
