import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_ORIGIN } from "../constants";
import { listMediaAssets } from "../media-assets";
import {
  SITEMAP_ENTITY_SLUGS,
  SITEMAP_EVIDENCE_IDS,
  SITEMAP_OPEN_QUESTION_SLUGS,
  SITEMAP_STATIC_PATHS,
  SITEMAP_TIMELINE_EVENT_IDS,
  SITEMAP_TOPIC_SLUGS,
  buildCatalogSitemapEntries,
  buildDocumentSitemapEntries,
  isDisallowedSitemapPath,
  publicSitemapUrl,
  publicSitemapUrlFromSegments,
} from "../sitemap-catalog";

function readSql(name: string): string {
  return readFileSync(path.join(process.cwd(), "sql", name), "utf8");
}

function firstStructId(sql: string): string | null {
  const start = sql.search(/>\(/);
  if (start < 0) return null;
  const cleaned = sql.slice(start).replace(/--[^\n]*/g, "");
  return cleaned.match(/'([^']+)'/)?.[1] ?? null;
}

function leadingTupleIds(sql: string): string[] {
  return [...sql.matchAll(/^\s+\('([^']+)'/gm)].map((match) => match[1]);
}

function seedIdsFromSql(sql: string): string[] {
  const first = firstStructId(sql);
  const rest = leadingTupleIds(sql);
  return first ? [first, ...rest] : rest;
}

describe("public sitemap catalog", () => {
  it("emits only apex researchjfk.ai URLs and omits lastmod", () => {
    const entries = buildCatalogSitemapEntries();
    expect(entries.length).toBeGreaterThan(50);
    for (const entry of entries) {
      expect(entry.url.startsWith(`${PUBLIC_SITE_ORIGIN}/`) || entry.url === PUBLIC_SITE_ORIGIN).toBe(
        true,
      );
      expect(entry.url).not.toContain("www.");
      expect(entry).toEqual({ url: entry.url });
    }
  });

  it("includes the editorial surfaces that are meant to be crawled", () => {
    const urls = new Set(buildCatalogSitemapEntries().map((entry) => entry.url));
    for (const path of [
      "/",
      "/about/methodology",
      "/entities",
      "/topics",
      "/evidence",
      "/timeline",
      "/dealey-plaza",
      "/compare",
      "/releases",
    ] as const) {
      expect(urls.has(publicSitemapUrl(path))).toBe(true);
    }
  });

  it("does not include search, api, or admin URLs", () => {
    const urls = [
      ...buildCatalogSitemapEntries().map((entry) => entry.url),
      ...buildDocumentSitemapEntries(["104-10004-10143"]).map(
        (entry) => entry.url,
      ),
    ];
    const paths = urls.map((url) => url.slice(PUBLIC_SITE_ORIGIN.length) || "/");
    expect(paths.some((path) => isDisallowedSitemapPath(path))).toBe(false);
    expect(paths.some((path) => path.startsWith("/search"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/api/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/admin"))).toBe(false);
    expect(isDisallowedSitemapPath("/search")).toBe(true);
    expect(isDisallowedSitemapPath("/api/v1/documents")).toBe(true);
    expect(isDisallowedSitemapPath("/admin/redactions")).toBe(true);
    expect(isDisallowedSitemapPath("/document/104-10004-10143")).toBe(false);
  });

  it("stays aligned with the SQL entity, evidence, and timeline seeds", () => {
    expect(SITEMAP_ENTITY_SLUGS).toEqual(
      seedIdsFromSql(readSql("12_curated_jfk_entities.sql")),
    );
    expect(SITEMAP_EVIDENCE_IDS).toEqual(
      seedIdsFromSql(readSql("17_physical_evidence.sql")),
    );
    expect([...SITEMAP_TIMELINE_EVENT_IDS]).toEqual(
      [...readSql("22_timeline_events.sql").matchAll(/'(tl-[a-z0-9-]+)'/g)].map(
        (match) => match[1],
      ),
    );
  });

  it("covers local media assets and known topic/open-question pages", () => {
    const urls = new Set(buildCatalogSitemapEntries().map((entry) => entry.url));
    for (const slug of SITEMAP_TOPIC_SLUGS) {
      expect(urls.has(publicSitemapUrl(`/topic/${slug}`))).toBe(true);
    }
    for (const slug of SITEMAP_OPEN_QUESTION_SLUGS) {
      expect(urls.has(publicSitemapUrl(`/open-questions/${slug}`))).toBe(true);
    }
    expect(urls.has(publicSitemapUrl("/topic/physical-evidence"))).toBe(false);
    expect(urls.has(publicSitemapUrl("/open-questions/tippit-murder"))).toBe(
      false,
    );
    for (const asset of listMediaAssets()) {
      expect(urls.has(publicSitemapUrlFromSegments("media", asset.id))).toBe(
        true,
      );
    }
  });

  it("encodes document IDs and drops invalid ones", () => {
    const entries = buildDocumentSitemapEntries([
      "104-10004-10143",
      "ps-warren-report",
      "not a valid id",
      "",
      "104-10004-10143",
    ]);
    expect(entries).toEqual([
      { url: "https://researchjfk.ai/document/104-10004-10143" },
      { url: "https://researchjfk.ai/document/ps-warren-report" },
    ]);
  });

  it("lists every static public page.tsx except disallowed routes", () => {
    expect((SITEMAP_STATIC_PATHS as readonly string[]).includes("/search")).toBe(
      false,
    );
    expect(
      SITEMAP_STATIC_PATHS.every((path) => !isDisallowedSitemapPath(path)),
    ).toBe(true);
  });
});
