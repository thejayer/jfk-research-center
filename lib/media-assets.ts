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
    id: "jfkl-jfkwhp-kn-30618",
    title: "State Funeral of President Kennedy: body returns to the White House",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-30618",
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
    id: "jfkl-jfkwhp-kn-23401",
    title: "President Kennedy in the Treaty Room",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-23401",
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
    id: "jfkl-kfc-004-018-p0004",
    title: "New York City, Kathleen Kennedy, portrait photographs, 1927",
    sourceName: "John F. Kennedy Presidential Library and Museum",
    sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/kfc-004-018-p0004",
    collection: "Kennedy Family Collection",
    digitalIdentifier: "KFC-004-018-p0004",
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

export function mediaRightsLabel(status: MediaRightsStatus): string {
  return mediaRightsDefinitions[status].label;
}

export function mediaRightsDescription(status: MediaRightsStatus): string {
  return mediaRightsDefinitions[status].description;
}

export function canCacheMediaAsset(asset: MediaAsset): boolean {
  return (
    asset.rightsStatus === "public_domain_likely" &&
    asset.storageStatus === "eligible_for_cache"
  );
}

export function listMediaAssets(): MediaAsset[] {
  return [...MEDIA_ASSETS].sort(
    (a, b) =>
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.title.localeCompare(b.title),
  );
}

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
