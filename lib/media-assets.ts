import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MediaAsset, MediaIndexResponse } from "./api-types";
import {
  mediaRightsDefinitions,
  mediaRightsKeys,
  type MediaRightsStatus,
} from "./constants";

const JFK_LIBRARY_COPYRIGHT_URL =
  "https://www.jfklibrary.org/archives/research-support-services/copyright";
const JFK_LIBRARY_REPRODUCTIONS_URL =
  "https://www.jfklibrary.org/archives/research-support-services/reproductions";
const JFK_LIBRARY_SEARCH_URL =
  "https://www.jfklibrary.org/search?items_per_page=25&sort_by=search_api_relevance&sort_order=DESC";

const officialDutyRightsNote =
  "Metadata points to the JFK Library's White House Photographs collection. The Library notes that documents prepared by U.S. officials as part of official duties are public domain, but item-level restrictions still need review before local image storage.";

const metadataOnlyStorageNote =
  "Indexed as metadata and an official source link only. Do not cache image binaries until rights review marks the item cleared.";

const eligibleStorageNote =
  "Eligible for a later cache/download job after item-level rights review confirms the public-domain path.";

const MEDIA_ASSETS: readonly MediaAsset[] = [
  {
    id: "jfkl-jfkwhp-1963-11-23-a",
    title: "State Funeral of President Kennedy: body returns to the White House",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-1963-11-23-a",
    collection: "White House Photographs",
    digitalIdentifier: "JFKWHP-1963-11-23-A",
    mediaType: "Negative",
    date: "1963-11-23",
    dateLabel: "1963 November 23",
    description:
      "Official White House photograph folder documenting the return of President Kennedy's body to the White House after the assassination.",
    creditLine:
      "Cecil Stoughton. White House Photographs. John F. Kennedy Presidential Library and Museum, Boston.",
    rightsStatus: "public_domain_likely",
    rightsNote: officialDutyRightsNote,
    storageStatus: "eligible_for_cache",
    storageNote: eligibleStorageNote,
    thumbnailUrl: null,
    imageUrl: null,
    localImagePath: null,
    tags: ["state funeral", "white house", "death"],
    relatedEntities: ["kennedy-family"],
    relatedTopics: ["warren-commission"],
  },
  {
    id: "jfkl-jfkwhp-kn-c30665",
    title: "State Funeral of President Kennedy: departure from the White House",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-c30665",
    collection: "White House Photographs",
    digitalIdentifier: "JFKWHP-1963-11-24-A",
    mediaType: "Negative",
    date: "1963-11-24",
    dateLabel: "1963 November 24",
    description:
      "Official White House photograph folder for the funeral departure and procession from the White House toward the United States Capitol.",
    creditLine:
      "Cecil Stoughton. White House Photographs. John F. Kennedy Presidential Library and Museum, Boston.",
    rightsStatus: "public_domain_likely",
    rightsNote: officialDutyRightsNote,
    storageStatus: "eligible_for_cache",
    storageNote: eligibleStorageNote,
    thumbnailUrl: null,
    imageUrl: null,
    localImagePath: null,
    tags: ["state funeral", "procession", "white house"],
    relatedEntities: ["kennedy-family"],
    relatedTopics: ["warren-commission"],
  },
  {
    id: "jfkl-jfkwhp-1962-08-24-d",
    title: "President Kennedy in the Treaty Room",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-1962-08-24-d",
    collection: "White House Photographs",
    digitalIdentifier: "JFKWHP-1962-08-24-D",
    mediaType: "Negative",
    date: "1962-08-24",
    dateLabel: "1962 August 24",
    description:
      "Official White House photograph record that can support broader biographical and White House context pages.",
    creditLine:
      "Robert Knudsen. White House Photographs. John F. Kennedy Presidential Library and Museum, Boston.",
    rightsStatus: "public_domain_likely",
    rightsNote: officialDutyRightsNote,
    storageStatus: "eligible_for_cache",
    storageNote: eligibleStorageNote,
    thumbnailUrl: null,
    imageUrl: null,
    localImagePath: null,
    tags: ["white house", "presidency", "treaty room"],
    relatedEntities: ["oswald"],
    relatedTopics: ["warren-commission"],
  },
  {
    id: "jfkl-jfkwhp-kn-23498",
    title: "White House, exteriors",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-23498",
    collection: "White House Photographs",
    digitalIdentifier: "JFKWHP-1962-08-29-F",
    mediaType: "Negative",
    date: "1962-08-29",
    dateLabel: "1962 August 29",
    description:
      "Exterior White House photo folder useful as official contextual media for Kennedy administration pages.",
    creditLine:
      "Robert Knudsen. White House Photographs. John F. Kennedy Presidential Library and Museum, Boston.",
    rightsStatus: "public_domain_likely",
    rightsNote: officialDutyRightsNote,
    storageStatus: "eligible_for_cache",
    storageNote: eligibleStorageNote,
    thumbnailUrl: null,
    imageUrl: null,
    localImagePath: null,
    tags: ["white house", "context"],
    relatedEntities: ["oswald"],
    relatedTopics: ["fbi"],
  },
  {
    id: "jfkl-kfc-004-018-p0003",
    title: "New York City, Kathleen Kennedy, portrait photographs, 1927",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/kfc-004-018-p0003",
    collection: "Kennedy Family Collection",
    digitalIdentifier: "KFC-004-018",
    mediaType: "Photograph",
    date: "1927-01-01",
    dateLabel: "1927",
    description:
      "Kennedy Family Collection example kept in the manifest to model permission-required material and prevent accidental local storage.",
    creditLine:
      "Kennedy Family Collection. John F. Kennedy Presidential Library and Museum, Boston.",
    rightsStatus: "permission_required",
    rightsNote:
      "The JFK Library Foundation states that photographs in the Kennedy Family Collection generally require written permission and a license fee before use.",
    storageStatus: "metadata_only",
    storageNote: metadataOnlyStorageNote,
    thumbnailUrl: null,
    imageUrl: null,
    localImagePath: null,
    tags: ["kennedy family collection", "licensing required"],
    relatedEntities: ["kennedy-family"],
    relatedTopics: ["warren-commission"],
  },
];

const manifestPath = path.join(process.cwd(), "data/media/jfkl-media-manifest.json");
const seedPath = path.join(process.cwd(), "data/media/jfkl-media-seeds.json");
let cachedMediaAssets: MediaAsset[] | null = null;
const storageStatuses = [
  "metadata_only",
  "external_reference",
  "eligible_for_cache",
  "cached",
] as const satisfies readonly MediaAsset["storageStatus"][];

export type MediaAssetFilters = {
  q?: string;
  collection?: string;
  rights?: MediaRightsStatus | null;
  storage?: MediaAsset["storageStatus"] | null;
  tag?: string;
  entity?: string;
  topic?: string;
};

export type MediaFacetItem = {
  value: string;
  label: string;
  count: number;
};

export type MediaFacets = {
  collections: MediaFacetItem[];
  tags: MediaFacetItem[];
  entities: MediaFacetItem[];
  topics: MediaFacetItem[];
};

/**
 * Returns the user-facing label for a canonical media rights status.
 *
 * @param status Media rights status key from the shared rights definitions.
 * @returns Short human-readable label for badges and summaries.
 */
export function mediaRightsLabel(status: MediaRightsStatus): string {
  return mediaRightsDefinitions[status].label;
}

/**
 * Returns explanatory copy for a canonical media rights status.
 *
 * @param status Media rights status key from the shared rights definitions.
 * @returns Description of the reuse/storage implication for the status.
 */
export function mediaRightsDescription(status: MediaRightsStatus): string {
  return mediaRightsDefinitions[status].description;
}

/**
 * Determines whether an asset can enter a later local-cache workflow.
 *
 * @param asset Media manifest entry being evaluated.
 * @returns True only when rightsStatus is public_domain_likely and storageStatus is eligible_for_cache.
 */
export function canCacheMediaAsset(asset: MediaAsset): boolean {
  return (
    asset.rightsStatus === "public_domain_likely" &&
    asset.storageStatus === "eligible_for_cache"
  );
}

function mediaAssetsSnapshot(): MediaAsset[] {
  if (!cachedMediaAssets) {
    const source = readManifestAssets() ?? readSeedAssets() ?? [...MEDIA_ASSETS];
    cachedMediaAssets = sortMediaAssets(
      cloneMediaAssets(source),
    );
  }
  return cloneMediaAssets(cachedMediaAssets);
}

/**
 * Clears the memoized media manifest snapshot after an ingest or admin update.
 *
 * @returns Nothing; the next list/get call will re-read the manifest or seeds.
 */
export function invalidateMediaAssetsCache(): void {
  cachedMediaAssets = null;
}

/**
 * Lists the rights-aware media candidates in display order.
 *
 * @returns Manifest assets when generated, curated seed assets when present, otherwise static fallback assets; sorted newest first by date and then title.
 */
export function listMediaAssets(): MediaAsset[] {
  return mediaAssetsSnapshot();
}

/**
 * Builds the canonical public URL for a media asset detail page.
 *
 * @param id Media asset id to encode into the route segment.
 * @returns Site-relative media detail URL.
 */
export function mediaAssetHref(id: string): string {
  return `/media/${encodeURIComponent(id)}`;
}

/**
 * Finds one media asset by id from the memoized manifest snapshot.
 *
 * @param id Canonical media asset id.
 * @returns Matching MediaAsset, or null when the id is absent.
 */
export function getMediaAsset(id: string): MediaAsset | null {
  return mediaAssetsSnapshot().find((asset) => asset.id === id) ?? null;
}

/**
 * Applies the public media explorer filters to a media asset list.
 *
 * @param assets Candidate assets to filter.
 * @param filters Optional query, collection, rights, storage, tag, entity, and topic filters.
 * @returns Assets matching every supplied filter; q is trimmed and lowercased before matching.
 */
export function filterMediaAssets(
  assets: readonly MediaAsset[],
  filters: MediaAssetFilters,
): MediaAsset[] {
  const query = normalizeString(filters.q).toLowerCase();
  return assets.filter((asset) => {
    if (query && !mediaSearchText(asset).includes(query)) return false;
    if (filters.collection && asset.collection !== filters.collection) return false;
    if (filters.rights && asset.rightsStatus !== filters.rights) return false;
    if (filters.storage && asset.storageStatus !== filters.storage) return false;
    if (filters.tag && !asset.tags.includes(filters.tag)) return false;
    if (filters.entity && !asset.relatedEntities.includes(filters.entity)) return false;
    if (filters.topic && !asset.relatedTopics.includes(filters.topic)) return false;
    return true;
  });
}

/**
 * Builds relationship facets for the media explorer filter controls.
 *
 * @param assets Assets to summarize.
 * @returns Counted collection, tag, entity, and topic facet arrays sorted by count then label.
 */
export function buildMediaFacets(assets: readonly MediaAsset[]): MediaFacets {
  return {
    collections: countFacet(assets.map((asset) => asset.collection)),
    tags: countFacet(assets.flatMap((asset) => asset.tags)),
    entities: countFacet(assets.flatMap((asset) => asset.relatedEntities)),
    topics: countFacet(assets.flatMap((asset) => asset.relatedTopics)),
  };
}

/**
 * Finds media assets related to a page by entity/topic overlap.
 *
 * @param assets Candidate media assets.
 * @param options Related entity/topic slugs plus optional result limit, defaulting to 4.
 * @returns Highest-scoring related assets; entity matches score higher than topic matches and invalid limits return no items.
 */
export function findRelatedMediaAssets(
  assets: readonly MediaAsset[],
  {
    entities = [],
    topics = [],
    limit = 4,
  }: {
    entities?: readonly string[];
    topics?: readonly string[];
    limit?: number;
  },
): MediaAsset[] {
  const safeLimit = Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 0);
  const entitySet = new Set(entities.filter(Boolean));
  const topicSet = new Set(topics.filter(Boolean));
  if (safeLimit === 0 || (entitySet.size === 0 && topicSet.size === 0)) return [];

  return assets
    .map((asset) => ({
      asset,
      score:
        asset.relatedEntities.filter((entity) => entitySet.has(entity)).length * 2 +
        asset.relatedTopics.filter((topic) => topicSet.has(topic)).length,
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.asset.date ?? "").localeCompare(a.asset.date ?? "") ||
        a.asset.title.localeCompare(b.asset.title),
    )
    .slice(0, safeLimit)
    .map((item) => item.asset);
}

/**
 * Builds the API response for the rights-aware media index.
 *
 * @returns MediaIndexResponse with sorted assets, per-status rightsSummary counts, cache eligibility derived through canCacheMediaAsset, cached count from storageStatus, and JFK Library source-policy links.
 */
export function buildMediaIndexResponse(): MediaIndexResponse {
  const assets = listMediaAssets();
  const rightsSummary = mediaRightsKeys.map((status) => ({
    status,
    label: mediaRightsLabel(status),
    description: mediaRightsDescription(status),
    count: assets.filter((asset) => asset.rightsStatus === status).length,
  }));

  return {
    assets,
    rightsSummary,
    totalAssets: assets.length,
    cacheEligibleCount: assets.filter(canCacheMediaAsset).length,
    cachedCount: assets.filter((asset) => asset.storageStatus === "cached").length,
    sourcePolicy: {
      name: "JFK Library rights-aware media policy",
      copyrightUrl: JFK_LIBRARY_COPYRIGHT_URL,
      reproductionsUrl: JFK_LIBRARY_REPRODUCTIONS_URL,
      searchUrl: JFK_LIBRARY_SEARCH_URL,
      note:
        "Keep metadata and official source links for all candidate media. Store or serve local image files only after item-level rights review clears the asset.",
    },
  };
}

function readManifestAssets(): MediaAsset[] | null {
  const raw = readJsonFile(manifestPath);
  if (!raw || typeof raw !== "object") return null;
  const assets = Array.isArray((raw as { assets?: unknown }).assets)
    ? (raw as { assets: unknown[] }).assets
    : [];
  const normalized = assets
    .map((asset) => normalizeMediaAsset(asset))
    .filter((asset): asset is MediaAsset => asset != null);
  return normalized.length > 0 ? normalized : null;
}

function readSeedAssets(): MediaAsset[] | null {
  const raw = readJsonFile(seedPath);
  if (!Array.isArray(raw)) return null;
  const normalized = raw
    .map((seed) => normalizeMediaAsset(seed))
    .filter((asset): asset is MediaAsset => asset != null);
  return normalized.length > 0 ? normalized : null;
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function normalizeMediaAsset(raw: unknown): MediaAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<MediaAsset>;
  const sourceUrl = normalizeString(input.sourceUrl);
  if (!sourceUrl) return null;
  const id = normalizeString(input.id) || deriveAssetId(sourceUrl);
  const digitalIdentifier =
    normalizeString(input.digitalIdentifier) || deriveIdentifierFromUrl(sourceUrl);
  const collection =
    normalizeString(input.collection) || inferCollection(sourceUrl);
  const rightsStatus = normalizeRightsStatus(input.rightsStatus);
  const storageStatus = normalizeStorageStatus(input.storageStatus, rightsStatus);

  return {
    id,
    title: normalizeString(input.title) || digitalIdentifier || id,
    sourceName:
      normalizeString(input.sourceName) ||
      "John F. Kennedy Presidential Library and Museum",
    sourceUrl,
    collection,
    digitalIdentifier,
    mediaType: normalizeString(input.mediaType) || "Media asset",
    date: normalizeNullableString(input.date),
    dateLabel: normalizeNullableString(input.dateLabel),
    description:
      normalizeString(input.description) ||
      "Official JFK Library media record pending item-level metadata review.",
    creditLine:
      normalizeString(input.creditLine) ||
      `${collection}. John F. Kennedy Presidential Library and Museum, Boston.`,
    rightsStatus,
    rightsNote:
      normalizeString(input.rightsNote) ||
      defaultRightsNote(rightsStatus),
    storageStatus,
    storageNote:
      normalizeString(input.storageNote) ||
      defaultStorageNote(storageStatus),
    thumbnailUrl: normalizeNullableString(input.thumbnailUrl),
    imageUrl: normalizeNullableString(input.imageUrl),
    localImagePath: normalizeNullableString(input.localImagePath),
    tags: normalizeStringArray(input.tags),
    relatedEntities: normalizeStringArray(input.relatedEntities),
    relatedTopics: normalizeStringArray(input.relatedTopics),
  };
}

function sortMediaAssets(assets: MediaAsset[]): MediaAsset[] {
  return [...assets].sort(
    (a, b) =>
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.title.localeCompare(b.title),
  );
}

function cloneMediaAssets(assets: readonly MediaAsset[]): MediaAsset[] {
  return assets.map(cloneMediaAsset);
}

function cloneMediaAsset(asset: MediaAsset): MediaAsset {
  return {
    ...asset,
    tags: [...asset.tags],
    relatedEntities: [...asset.relatedEntities],
    relatedTopics: [...asset.relatedTopics],
  };
}

function mediaSearchText(asset: MediaAsset): string {
  return [
    asset.title,
    asset.description,
    asset.collection,
    asset.digitalIdentifier,
    asset.mediaType,
    asset.creditLine,
    ...asset.tags,
    ...asset.relatedEntities,
    ...asset.relatedTopics,
  ]
    .join(" ")
    .toLowerCase();
}

function countFacet(values: readonly string[]): MediaFacetItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: facetLabel(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function normalizeRightsStatus(value: unknown): MediaRightsStatus {
  const normalized = normalizeString(value);
  return mediaRightsKeys.includes(normalized as MediaRightsStatus)
    ? (normalized as MediaRightsStatus)
    : "copyright_unknown";
}

function normalizeStorageStatus(
  value: unknown,
  rightsStatus: MediaRightsStatus,
): MediaAsset["storageStatus"] {
  const normalized = normalizeString(value);
  return storageStatuses.includes(normalized as MediaAsset["storageStatus"])
    ? (normalized as MediaAsset["storageStatus"])
    : rightsStatus === "public_domain_likely"
      ? "external_reference"
      : "metadata_only";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown): string | null {
  return normalizeString(value) || null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(normalizeString)
        .filter(Boolean),
    ),
  ];
}

function deriveAssetId(sourceUrl: string): string {
  const slug = sourceUrl.split("/").filter(Boolean).pop() ?? "media";
  return `jfkl-${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function deriveIdentifierFromUrl(sourceUrl: string): string {
  const slug = sourceUrl.split("/").filter(Boolean).pop();
  return slug ? slug.toUpperCase() : "JFKL-MEDIA";
}

function inferCollection(sourceUrl: string): string {
  const id = deriveIdentifierFromUrl(sourceUrl).toLowerCase();
  if (id.startsWith("kfc-")) return "Kennedy Family Collection";
  if (id.startsWith("jfkwhp-")) return "White House Photographs";
  return "JFK Library media collection";
}

function defaultRightsNote(status: MediaRightsStatus): string {
  if (status === "public_domain_likely") {
    return "Review the official asset record before local image storage; public-domain status is inferred, not assumed.";
  }
  if (status === "permission_required") {
    return "Written permission or licensing may be required before reuse.";
  }
  return "Rights status is not cleared; keep metadata and official links only.";
}

function defaultStorageNote(status: MediaAsset["storageStatus"]): string {
  if (status === "eligible_for_cache") {
    return "Eligible for a later cache/download job after item-level rights review.";
  }
  if (status === "cached") {
    return "Local file path should point to a reviewed cached image.";
  }
  if (status === "external_reference") {
    return "Indexed as an official external reference until rights review marks the item cache eligible.";
  }
  return "Metadata-only source pointer; do not download binaries.";
}

function facetLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
