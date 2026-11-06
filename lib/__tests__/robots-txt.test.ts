import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Group = {
  userAgents: string[];
  rules: Record<string, string[]>;
};

function parseGroups(robots: string): Group[] {
  const groups: Group[] = [];
  let current: Group | undefined;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (directive === "user-agent") {
      if (!current || Object.keys(current.rules).length > 0) {
        current = { userAgents: [], rules: {} };
        groups.push(current);
      }
      current.userAgents.push(value);
    } else if (directive !== "sitemap" && current) {
      (current.rules[directive] ??= []).push(value);
    }
  }

  return groups;
}

describe("public/robots.txt", () => {
  const robots = readFileSync(
    path.join(process.cwd(), "public/robots.txt"),
    "utf8",
  );

  const groups = parseGroups(robots);
  const groupFor = (userAgent: string) => {
    const matches = groups.filter((group) => group.userAgents.includes(userAgent));
    expect(matches).toHaveLength(1);
    return matches[0];
  };
  const wildcardDisallows = ["/api/", "/search", "/admin", "/admin/"];

  it.each(["Applebot", "ElevenlabsCrawler"])(
    "restricts %s documents, delays crawling, and repeats wildcard rules",
    (userAgent) => {
      const group = groupFor(userAgent);
      expect(group.rules).toEqual({
        disallow: ["/document/", ...wildcardDisallows],
        "crawl-delay": ["10"],
      });
      expect(groups.indexOf(group)).toBeLessThan(groups.indexOf(groupFor("*")));
    },
  );

  it("preserves the wildcard rules without disallowing documents", () => {
    expect(groupFor("*").rules).toEqual({ disallow: wildcardDisallows });
    expect(groupFor("*").rules.disallow).not.toContain("/document/");
  });

  it.each([
    "GPTBot",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-SearchBot",
    "anthropic-ai",
    "Bytespider",
    "PerplexityBot",
    "CCBot",
  ])("preserves the %s block", (userAgent) => {
    expect(groupFor(userAgent).rules).toEqual({ disallow: ["/"] });
  });

  it("preserves the ChatGPT-User rules", () => {
    expect(groupFor("ChatGPT-User").rules).toEqual({
      disallow: ["/search", "/api/", "/document", "/compare", "/admin", "/admin/"],
    });
  });

  it("ends with the apex sitemap line", () => {
    expect(robots.trimEnd().split(/\r?\n/).at(-1)).toBe(
      "Sitemap: https://researchjfk.ai/sitemap.xml",
    );
    expect(robots).not.toContain("www.researchjfk.ai");
  });
});
