#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export const rightsStatuses = [
  "public_domain_likely",
  "permission_required",
  "copyright_unknown",
  "metadata_only",
];

export const storageStatuses = [
  "metadata_only",
  "external_reference",
  "eligible_for_cache",
  "cached",
];

const defaultOptions = {
  input: "data/media/jfkl-media-seeds.json",
  output: "data/media/jfkl-media-manifest.json",
  downloadDir: "public/media/jfkl",
  delayMs: 600,
  dryRun: false,
  noFetch: false,
  downloadCleared: false,
  limit: null,
};

const sourcePolicy = {
  name: "JFK Library rights-aware media policy",
  copyrightUrl:
    "https://www.jfklibrary.org/archives/research-support-services/copyright",
  reproductionsUrl:
    "https://www.jfklibrary.org/archives/research-support-services/reproductions",
  searchUrl:
    "https://www.jfklibrary.org/search?items_per_page=25&sort_by=search_api_relevance&sort_order=DESC",
  note:
    "Store metadata and official source links first. Download binaries only when item-level rights review marks an asset cache eligible.",
};

const monthNumber = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

export function parseArgs(argv) {
  const options = { ...defaultOptions };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      return { ...options, help: true };
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-fetch") {
      options.noFetch = true;
    } else if (arg === "--download-cleared") {
      options.downloadCleared = true;
    } else if (arg === "--input") {
      options.input = readNext(argv, ++i, arg);
    } else if (arg === "--output") {
      options.output = readNext(argv, ++i, arg);
    } else if (arg === "--download-dir") {
      options.downloadDir = readNext(argv, ++i, arg);
    } else if (arg === "--delay-ms") {
      options.delayMs = parsePositiveInt(readNext(argv, ++i, arg), arg);
    } else if (arg === "--limit") {
      options.limit = parsePositiveInt(readNext(argv, ++i, arg), arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function deriveAssetId(sourceUrl) {
  const url = new URL(sourceUrl);
  const archiveId = url.pathname
    .split("/")
    .filter(Boolean)
    .pop();
  if (!archiveId) {
    throw new Error(`Cannot derive asset id from ${sourceUrl}`);
  }
  return `jfkl-${archiveId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function normalizeSeed(seed) {
  if (!seed || typeof seed !== "object") {
    throw new Error("Seed must be an object");
  }

  const sourceUrl = normalizeUrl(seed.sourceUrl);
  const rightsStatus = normalizeEnum(
    seed.rightsStatus,
    rightsStatuses,
    "copyright_unknown",
  );
  const storageStatus = normalizeEnum(
    seed.storageStatus,
    storageStatuses,
    rightsStatus === "public_domain_likely"
      ? "external_reference"
      : "metadata_only",
  );

  return {
    id: normalizeString(seed.id) || deriveAssetId(sourceUrl),
    sourceUrl,
    rightsStatus,
    storageStatus,
    rightsNote: normalizeString(seed.rightsNote),
    storageNote: normalizeString(seed.storageNote),
    title: normalizeString(seed.title),
    collection: normalizeString(seed.collection),
    digitalIdentifier: normalizeString(seed.digitalIdentifier),
    mediaType: normalizeString(seed.mediaType),
    date: normalizeString(seed.date),
    dateLabel: normalizeString(seed.dateLabel),
    description: normalizeString(seed.description),
    creditLine: normalizeString(seed.creditLine),
    thumbnailUrl: normalizeNullableUrl(seed.thumbnailUrl, sourceUrl),
    imageUrl: normalizeNullableUrl(seed.imageUrl, sourceUrl),
    tags: normalizeStringArray(seed.tags),
    relatedEntities: normalizeStringArray(seed.relatedEntities),
    relatedTopics: normalizeStringArray(seed.relatedTopics),
  };
}

export function parseAssetMetadata(html, sourceUrl) {
  const meta = parseMetaTags(html);
  const text = htmlToText(html);
  const title =
    stripJfkTitle(meta["og:title"] ?? meta.title ?? extractTitle(html)) ?? null;
  const description =
    meta["og:description"] ??
    meta.description ??
    extractLabeledValue(text, "Folder Description") ??
    extractLabeledValue(text, "Description");
  const image =
    meta["og:image"] ??
    meta["twitter:image"] ??
    extractLinkHref(html, "image_src") ??
    null;

  return {
    title,
    description: normalizeString(description),
    collection: extractLabeledValue(text, "Collection"),
    digitalIdentifier:
      extractLabeledValue(text, "Digital Identifier") ??
      extractLabeledValue(text, "Identifier") ??
      deriveIdentifierFromUrl(sourceUrl),
    mediaType:
      extractLabeledValue(text, "Media Type") ??
      extractLabeledValue(text, "Extent / Physical Description") ??
      extractLabeledValue(text, "Type"),
    date:
      normalizeDate(extractLabeledValue(text, "Date(s) of Materials")) ??
      normalizeDate(extractLabeledValue(text, "Date")) ??
      normalizeDate(extractLabeledValue(text, "Date(s)")),
    dateLabel:
      extractLabeledValue(text, "Date(s) of Materials") ??
      extractLabeledValue(text, "Date") ??
      extractLabeledValue(text, "Date(s)"),
    creditLine:
      extractLabeledValue(text, "Credit Line") ??
      extractLabeledValue(text, "Preferred Citation") ??
      extractLabeledValue(text, "Credit"),
    thumbnailUrl: normalizeNullableUrl(image, sourceUrl),
    imageUrl: normalizeNullableUrl(image, sourceUrl),
  };
}

export function buildAssetFromSeed(seed, metadata = {}) {
  const normalized = normalizeSeed(seed);
  const title =
    normalized.title ||
    metadata.title ||
    normalized.digitalIdentifier ||
    metadata.digitalIdentifier ||
    normalized.id;
  const collection =
    normalized.collection ||
    metadata.collection ||
    inferCollection(normalized.sourceUrl);

  return {
    id: normalized.id,
    title,
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: normalized.sourceUrl,
    collection,
    digitalIdentifier:
      normalized.digitalIdentifier ||
      metadata.digitalIdentifier ||
      deriveIdentifierFromUrl(normalized.sourceUrl),
    mediaType: normalized.mediaType || metadata.mediaType || "Media asset",
    date: normalized.date || metadata.date || null,
    dateLabel: normalized.dateLabel || metadata.dateLabel || normalized.date || null,
    description:
      normalized.description ||
      metadata.description ||
      "Official JFK Library media record pending item-level metadata review.",
    creditLine:
      normalized.creditLine ||
      metadata.creditLine ||
      `${collection}. John F. Kennedy Presidential Library and Museum, Boston.`,
    rightsStatus: normalized.rightsStatus,
    rightsNote:
      normalized.rightsNote ||
      defaultRightsNote(normalized.rightsStatus),
    storageStatus: normalized.storageStatus,
    storageNote:
      normalized.storageNote ||
      defaultStorageNote(normalized.storageStatus),
    thumbnailUrl: normalized.thumbnailUrl || metadata.thumbnailUrl || null,
    imageUrl: normalized.imageUrl || metadata.imageUrl || null,
    localImagePath: null,
    tags: normalized.tags,
    relatedEntities: normalized.relatedEntities,
    relatedTopics: normalized.relatedTopics,
  };
}

export function canDownloadAsset(asset) {
  return (
    asset.rightsStatus === "public_domain_likely" &&
    asset.storageStatus === "eligible_for_cache"
  );
}

export function buildManifest(assets, warnings = []) {
  const sortedAssets = [...assets].sort(
    (a, b) =>
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.title.localeCompare(b.title),
  );

  return {
    generatedAt: new Date().toISOString(),
    sourcePolicy,
    totalAssets: sortedAssets.length,
    cacheEligibleCount: sortedAssets.filter(canDownloadAsset).length,
    cachedCount: sortedAssets.filter((asset) => asset.storageStatus === "cached").length,
    assets: sortedAssets,
    warnings,
  };
}

export async function run(argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(helpText());
    return null;
  }

  const seeds = await readJson(resolveRepoPath(options.input));
  if (!Array.isArray(seeds)) {
    throw new Error(`Expected ${options.input} to contain a JSON array`);
  }

  const limitedSeeds = options.limit == null ? seeds : seeds.slice(0, options.limit);
  const warnings = [];
  const assets = [];

  for (const seed of limitedSeeds) {
    const normalizedSeed = normalizeSeed(seed);
    let metadata = {};

    if (!options.noFetch) {
      try {
        const html = await fetchText(fetchImpl, normalizedSeed.sourceUrl);
        metadata = parseAssetMetadata(html, normalizedSeed.sourceUrl);
      } catch (err) {
        warnings.push({
          sourceUrl: normalizedSeed.sourceUrl,
          warning: `metadata fetch failed: ${errorMessage(err)}`,
        });
      }
      await sleep(options.delayMs);
    }

    let asset = buildAssetFromSeed(normalizedSeed, metadata);
    if (options.downloadCleared) {
      asset = await maybeDownloadAsset(asset, options, fetchImpl, warnings);
    }
    assets.push(asset);
  }

  const manifest = buildManifest(assets, warnings);
  if (!options.dryRun) {
    const outPath = resolveRepoPath(options.output);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(
    [
      `JFK Library media ingest: ${manifest.totalAssets} assets`,
      `cache eligible: ${manifest.cacheEligibleCount}`,
      `cached: ${manifest.cachedCount}`,
      `warnings: ${manifest.warnings.length}`,
      options.dryRun ? "dry run: no manifest written" : `wrote: ${options.output}`,
    ].join("\n"),
  );
  if (manifest.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of manifest.warnings) {
      console.warn(`- ${warning.sourceUrl}: ${warning.warning}`);
    }
  }
  return manifest;
}

function helpText() {
  return `Usage: node scripts/ingest-jfkl-media.mjs [options]

Options:
  --input <file>          Seed JSON array. Default: ${defaultOptions.input}
  --output <file>         Manifest output path. Default: ${defaultOptions.output}
  --download-dir <dir>    Local binary cache directory. Default: ${defaultOptions.downloadDir}
  --delay-ms <ms>         Delay between remote metadata fetches. Default: ${defaultOptions.delayMs}
  --limit <n>             Process only the first n seeds.
  --no-fetch              Build manifest from seed data only.
  --download-cleared      Download image binaries only for cache-eligible assets.
  --dry-run               Do not write manifest or images.
  --help                  Show this message.`;
}

async function maybeDownloadAsset(asset, options, fetchImpl, warnings) {
  if (!canDownloadAsset(asset)) return asset;
  const imageUrl = asset.imageUrl ?? asset.thumbnailUrl;
  if (!imageUrl) {
    warnings.push({
      sourceUrl: asset.sourceUrl,
      warning: "cache-eligible asset has no image URL candidate",
    });
    return asset;
  }
  if (!isTrustedJfkLibraryUrl(imageUrl)) {
    warnings.push({
      sourceUrl: asset.sourceUrl,
      warning: `skipped untrusted image host: ${imageUrl}`,
    });
    return asset;
  }

  const res = await fetchImpl(imageUrl, {
    headers: { "user-agent": userAgent() },
  });
  if (!res.ok) {
    warnings.push({
      sourceUrl: asset.sourceUrl,
      warning: `image fetch failed: ${res.status}`,
    });
    return asset;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    warnings.push({
      sourceUrl: asset.sourceUrl,
      warning: `image fetch returned non-image content-type: ${contentType || "unknown"}`,
    });
    return asset;
  }

  const ext = extensionForContentType(contentType);
  const downloadDir = resolveRepoPath(options.downloadDir);
  const filePath = path.join(downloadDir, `${asset.id}${ext}`);
  await mkdir(downloadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));

  return {
    ...asset,
    storageStatus: "cached",
    localImagePath: `/${path.relative(path.join(repoRoot, "public"), filePath).replace(/\\/g, "/")}`,
    storageNote:
      "Cached by the rights-aware JFK Library media ingest after explicit download-cleared approval.",
  };
}

async function fetchText(fetchImpl, url) {
  const res = await fetchImpl(url, {
    headers: { "user-agent": userAgent() },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

function parseMetaTags(html) {
  const out = {};
  for (const match of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1] ?? "");
    const key = attrs.property ?? attrs.name;
    if (!key || !attrs.content) continue;
    out[key.toLowerCase()] = decodeHtml(attrs.content);
  }
  return out;
}

function parseAttributes(input) {
  const attrs = {};
  for (const match of input.matchAll(
    /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
  )) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function extractLinkHref(html, rel) {
  for (const match of html.matchAll(/<link\s+([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1] ?? "");
    if (attrs.rel?.toLowerCase() === rel.toLowerCase() && attrs.href) {
      return decodeHtml(attrs.href);
    }
  }
  return null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(stripTags(match[1])) : null;
}

function stripJfkTitle(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized
    .replace(/\s*\|\s*JFK Library.*$/i, "")
    .replace(/\s*-\s*John F\. Kennedy Presidential Library.*$/i, "")
    .trim();
}

function htmlToText(html) {
  return decodeHtml(
    stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<(br|\/p|\/div|\/li|\/dt|\/dd|\/h[1-6])\b[^>]*>/gi, "\n"),
    ),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractLabeledValue(text, label) {
  const escaped = escapeRegExp(label);
  const patterns = [
    new RegExp(`^${escaped}\\s*[:\\-]?\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}\\s*$\\n([^\\n]+)`, "im"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = normalizeString(match?.[1]);
    if (value && !value.match(/^(description|collection|date|credit)$/i)) {
      return value;
    }
  }
  return null;
}

function stripTags(input) {
  return input.replace(/<[^>]+>/g, " ");
}

function decodeHtml(input) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = normalizeString(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(normalizeString)
        .filter(Boolean),
    ),
  ];
}

function normalizeUrl(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error("sourceUrl is required");
  }
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported URL protocol for ${normalized}`);
  }
  return url.toString();
}

function normalizeNullableUrl(value, baseUrl) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeDate(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const iso = normalized.match(/\b((18|19|20)\d{2})-(\d{2})-(\d{2})\b/)?.[0];
  if (iso) return iso;

  const yearMonthDay = normalized.match(
    /\b((18|19|20)\d{2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i,
  );
  if (yearMonthDay) {
    return formatDateParts(yearMonthDay[1], yearMonthDay[3], yearMonthDay[4]);
  }

  const dayMonthYear = normalized.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+((18|19|20)\d{2})\b/i,
  );
  if (dayMonthYear) {
    return formatDateParts(dayMonthYear[3], dayMonthYear[2], dayMonthYear[1]);
  }

  const year = normalized.match(/\b(18|19|20)\d{2}\b/)?.[0];
  return year ? `${year}-01-01` : null;
}

function formatDateParts(year, month, day) {
  const mm = monthNumber[month.toLowerCase()];
  const dd = String(Number(day)).padStart(2, "0");
  return mm ? `${year}-${mm}-${dd}` : null;
}

function deriveIdentifierFromUrl(sourceUrl) {
  const last = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop();
  return last ? last.toUpperCase() : "JFKL-MEDIA";
}

function inferCollection(sourceUrl) {
  const id = deriveIdentifierFromUrl(sourceUrl).toLowerCase();
  if (id.startsWith("kfc-")) return "Kennedy Family Collection";
  if (id.startsWith("jfkwhp-")) return "White House Photographs";
  return "JFK Library media collection";
}

function defaultRightsNote(status) {
  if (status === "public_domain_likely") {
    return "Review the official asset record before local image storage; public-domain status is inferred, not assumed.";
  }
  if (status === "permission_required") {
    return "Written permission or licensing may be required before reuse.";
  }
  return "Rights status is not cleared; keep metadata and official links only.";
}

function defaultStorageNote(status) {
  if (status === "eligible_for_cache") {
    return "Eligible for a later cache/download job after item-level rights review.";
  }
  if (status === "cached") {
    return "Local file path should point to a reviewed cached image.";
  }
  return "Metadata-only source pointer; do not download binaries.";
}

function isTrustedJfkLibraryUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "jfklibrary.org" || hostname.endsWith(".jfklibrary.org");
  } catch {
    return false;
  }
}

function extensionForContentType(contentType) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return ".jpg";
}

function readNext(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
}

function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userAgent() {
  return "jfk-research-center-media-ingest/0.1 (+https://github.com/thejayer/jfk-research-center)";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
