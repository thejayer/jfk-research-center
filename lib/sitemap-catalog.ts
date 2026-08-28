import { PUBLIC_SITE_ORIGIN, RECORD_ID_RE } from "./constants";
import { listMediaAssets } from "./media-assets";

export type SitemapUrlEntry = {
  url: string;
};

/**
 * Static public pages that exist as App Router routes and are allowed
 * for Google. /search, /api, and /admin are omitted on purpose.
 */
export const SITEMAP_STATIC_PATHS = [
  "/",
  "/about",
  "/about/methodology",
  "/about/editorial-policy",
  "/about/roadmap",
  "/entities",
  "/topics",
  "/evidence",
  "/timeline",
  "/dealey-plaza",
  "/dealey-plaza/trajectory",
  "/compare",
  "/releases",
  "/bibliography",
  "/established-facts",
  "/open-questions",
  "/graph",
  "/tensions",
  "/corrections",
  "/media",
  "/research-paths",
  "/research/brief",
] as const;

/**
 * Topic slugs that render a public /topic/[slug] page.
 * physical-evidence redirects to /evidence, so it is omitted.
 */
export const SITEMAP_TOPIC_SLUGS = [
  "warren-commission",
  "hsca",
  "mexico-city",
  "cia",
  "fbi",
  "cuba",
  "tippit-murder",
  "dealey-plaza",
  "church-committee",
  "arrb-releases",
  "mob-castro-plots",
] as const;

/**
 * Open-questions topic pages that have generated articles/threads.
 * tippit-murder produced no questions (the page 404s); physical-evidence
 * is redirect-only.
 */
export const SITEMAP_OPEN_QUESTION_SLUGS = [
  "warren-commission",
  "hsca",
  "mexico-city",
  "cia",
  "fbi",
  "cuba",
  "dealey-plaza",
  "church-committee",
  "arrb-releases",
  "mob-castro-plots",
] as const;

/** Entity slugs seeded in sql/12_curated_jfk_entities.sql. */
export const SITEMAP_ENTITY_SLUGS = [
  "oswald",
  "ruby",
  "marina-oswald",
  "hoover",
  "angleton",
  "cia",
  "fbi",
  "warren-commission",
  "hsca",
  "tippit",
  "zapruder",
  "connally",
  "earl-warren",
  "dulles",
  "blakey",
  "church-committee",
  "arrb",
  "duran",
  "phillips",
  "win-scott",
  "kostikov",
  "de-mohrenschildt",
  "cubela",
  "specter",
  "marcello",
  "trafficante",
  "giancana",
  "roselli",
  "garrison",
  "clay-shaw",
  "goodpasture",
  "jane-roman",
] as const;

/** Evidence IDs seeded in sql/17_physical_evidence.sql. */
export const SITEMAP_EVIDENCE_IDS = [
  "CE-399",
  "CE-567",
  "CE-569",
  "CE-840",
  "CE-1717",
  "CE-139",
  "CE-543-545",
  "CE-143",
  "tippit-service-revolver",
  "tippit-shells",
  "CE-133-A",
  "CE-133-B",
  "zapruder-film",
  "moorman-polaroid",
  "nix-film",
  "muchmore-film",
  "altgens-6",
  "CE-387",
  "autopsy-photos",
  "autopsy-xrays",
  "parkland-notes",
  "CE-1",
  "hidell-pobox",
  "minox-camera",
  "oswald-diary",
  "curtain-rod-bag",
  "CE-393",
  "CE-394",
  "CE-391",
  "tippit-uniform",
  "snipers-nest",
  "6th-floor-window",
  "tague-curb",
] as const;

/** Timeline event IDs seeded in sql/22_timeline_events.sql. */
export const SITEMAP_TIMELINE_EVENT_IDS = [
  "tl-1939-10-18-oswald-born",
  "tl-1947-09-18-cia-founded",
  "tl-1956-10-24-oswald-enlists",
  "tl-1959-10-31-oswald-moscow",
  "tl-1961-04-17-bay-of-pigs",
  "tl-1961-04-30-oswald-marries",
  "tl-1962-06-13-oswald-returns",
  "tl-1962-10-16-cuban-missile-crisis",
  "tl-1963-04-10-walker-shooting",
  "tl-1963-09-27-oswald-mexico-city",
  "tl-1963-10-16-oswald-tsbd",
  "tl-1963-11-18-motorcade-published",
  "tl-1963-11-22-air-force-one-dallas",
  "tl-1963-11-22-motorcade-departs",
  "tl-1963-11-22-shots-fired",
  "tl-1963-11-22-parkland-1pm",
  "tl-1963-11-22-tippit",
  "tl-1963-11-22-theatre-arrest",
  "tl-1963-11-22-lbj-sworn",
  "tl-1963-11-22-amlash-paris",
  "tl-1963-11-23-backyard-photos",
  "tl-1963-11-24-ruby-shoots-oswald",
  "tl-1963-11-24-oswald-dies",
  "tl-1963-11-25-jfk-funeral",
  "tl-1963-11-29-wc-established",
  "tl-1964-02-03-wc-marina-testimony",
  "tl-1964-09-24-wc-report",
  "tl-1964-11-23-wc-hearings-published",
  "tl-1965-11-08-kilgallen-death",
  "tl-1966-10-05-ruby-conviction-reversed",
  "tl-1967-01-03-ruby-dies",
  "tl-1968-01-01-clark-panel",
  "tl-1975-06-19-giancana-killed",
  "tl-1975-06-30-rockefeller-commission",
  "tl-1976-04-23-church-report",
  "tl-1976-08-07-roselli-found",
  "tl-1976-09-17-hsca-established",
  "tl-1977-03-29-demohrenschildt-death",
  "tl-1978-12-29-hsca-acoustic",
  "tl-1979-03-29-hsca-report",
  "tl-1982-05-14-nas-ramsey",
  "tl-1988-03-28-doj-decline",
  "tl-1991-12-18-jfk-film",
  "tl-1992-10-26-jfk-act",
  "tl-1994-04-11-arrb-sworn",
  "tl-1997-04-24-zapruder-taken",
  "tl-1998-09-30-arrb-report",
  "tl-2017-07-24-release-1",
  "tl-2018-04-26-release-2",
  "tl-2021-12-15-release-3",
  "tl-2022-12-15-release-4",
  "tl-2023-06-27-release-5",
  "tl-2025-01-23-eo-14176",
  "tl-2025-03-18-release-6a",
  "tl-2025-03-26-release-6b",
  "tl-2025-04-03-release-6c",
  "tl-2026-01-30-release-7",
  "tl-1964-03-16-specter-joins-wc",
  "tl-1964-04-21-specter-autopsy-depositions",
  "tl-2000-04-01-specter-passion-for-truth",
  "tl-2012-10-14-specter-dies",
  "tl-1961-04-04-marcello-deported",
  "tl-1962-09-01-marcello-alleged-threat",
  "tl-1978-01-11-marcello-hsca-testimony",
  "tl-1993-03-02-marcello-dies",
  "tl-1959-06-08-trafficante-detained",
  "tl-1961-03-12-fontainebleau-meeting",
  "tl-1975-10-01-trafficante-church-testimony",
  "tl-1978-09-28-trafficante-hsca-testimony",
  "tl-1987-03-17-trafficante-dies",
  "tl-1975-06-24-roselli-church-testimony",
  "tl-1975-09-22-roselli-church-testimony-2",
  "tl-1976-07-28-roselli-disappears",
  "tl-1977-02-25-roselli-nyt-investigation",
  "tl-1966-11-01-garrison-opens-investigation",
  "tl-1967-03-01-shaw-arrested",
  "tl-1969-01-31-shaw-trial-begins",
  "tl-1969-03-01-shaw-acquitted",
  "tl-1974-08-15-clay-shaw-dies",
  "tl-1979-05-01-helms-shaw-cia",
  "tl-1988-10-01-garrison-memoir",
  "tl-1992-10-21-garrison-dies",
  "tl-1978-11-22-goodpasture-hsca",
  "tl-1995-12-15-goodpasture-arrb-1",
  "tl-1998-04-23-goodpasture-arrb-2",
  "tl-2011-12-04-goodpasture-dies",
  "tl-1963-10-04-roman-reads-fbi-report",
  "tl-1963-10-10-roman-signs-cable",
  "tl-1994-11-01-roman-newman-interview",
  "tl-1995-03-01-roman-newman-interview-2",
  "tl-2008-01-01-roman-dies",
] as const;

const DISALLOWED_SITEMAP_PATH_RE = /^\/(?:search|api|admin)(?:\/|$)/i;

/**
 * Builds an apex sitemap URL from a site-relative path.
 *
 * @param pathname Site-relative path beginning with /.
 * @returns Absolute https://researchjfk.ai URL with no trailing slash except home.
 */
export function publicSitemapUrl(pathname: string): string {
  const trimmed = pathname.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withSlash === "/" ? "/" : withSlash.replace(/\/+$/, "");
  return `${PUBLIC_SITE_ORIGIN}${normalized}`;
}

/**
 * Builds an apex sitemap URL from unencoded path segments.
 *
 * @param segments Raw path segments such as "document" and a record id.
 * @returns Absolute apex URL with each segment URI-encoded.
 */
export function publicSitemapUrlFromSegments(...segments: string[]): string {
  const encoded = segments
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${PUBLIC_SITE_ORIGIN}/${encoded}`;
}

/**
 * Returns true when a path is disallowed for the public sitemap.
 *
 * @param pathname Site-relative path.
 * @returns Whether the path is /search, /api, or /admin.
 */
export function isDisallowedSitemapPath(pathname: string): boolean {
  return DISALLOWED_SITEMAP_PATH_RE.test(pathname);
}

function entry(pathname: string): SitemapUrlEntry {
  return { url: publicSitemapUrl(pathname) };
}

function prefixedEntries(
  prefix: string,
  ids: readonly string[],
): SitemapUrlEntry[] {
  const prefixPath = prefix
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return ids.map((id) => ({
    url: `${PUBLIC_SITE_ORIGIN}/${prefixPath}/${encodeURIComponent(id)}`,
  }));
}

/**
 * Editorial and locally known public URLs. No BigQuery.
 *
 * Lastmod is omitted: these catalogs have no honest page-update timestamp.
 *
 * @returns Deduplicated apex sitemap entries for static, topic, entity,
 *   evidence, timeline, open-question, and media pages.
 */
export function buildCatalogSitemapEntries(): SitemapUrlEntry[] {
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];

  const add = (item: SitemapUrlEntry) => {
    if (seen.has(item.url)) return;
    const path = item.url.slice(PUBLIC_SITE_ORIGIN.length) || "/";
    if (isDisallowedSitemapPath(path)) return;
    seen.add(item.url);
    entries.push(item);
  };

  for (const path of SITEMAP_STATIC_PATHS) add(entry(path));
  for (const item of prefixedEntries("topic", SITEMAP_TOPIC_SLUGS)) add(item);
  for (const item of prefixedEntries("entity", SITEMAP_ENTITY_SLUGS)) add(item);
  for (const item of prefixedEntries("evidence", SITEMAP_EVIDENCE_IDS)) add(item);
  for (const item of prefixedEntries("timeline/event", SITEMAP_TIMELINE_EVENT_IDS)) {
    add(item);
  }
  for (const item of prefixedEntries(
    "open-questions",
    SITEMAP_OPEN_QUESTION_SLUGS,
  )) {
    add(item);
  }
  for (const asset of listMediaAssets()) {
    add({ url: publicSitemapUrlFromSegments("media", asset.id) });
  }

  return entries;
}

/**
 * Maps warehouse document IDs to /document/[id] sitemap entries.
 *
 * @param ids Record IDs from jfk_records (or the mock seed).
 * @returns Apex document URLs; invalid or disallowed IDs are dropped.
 */
export function buildDocumentSitemapEntries(
  ids: readonly string[],
): SitemapUrlEntry[] {
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !RECORD_ID_RE.test(id)) continue;
    const url = publicSitemapUrlFromSegments("document", id);
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url });
  }
  return entries;
}
