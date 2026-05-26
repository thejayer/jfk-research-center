import { describe, expect, it } from "vitest";
import { mediaRightsKeys } from "../constants";
import {
  buildMediaIndexResponse,
  buildMediaFacets,
  canCacheMediaAsset,
  filterMediaAssets,
  findRelatedMediaAssets,
  getMediaAsset,
  listMediaAssets,
  mediaAssetHref,
  mediaRightsDescription,
  mediaRightsLabel,
} from "../media-assets";

describe("media assets", () => {
  it("builds a rights summary for every canonical rights status", () => {
    const response = buildMediaIndexResponse();

    expect(response.rightsSummary.map((summary) => summary.status)).toEqual(
      mediaRightsKeys,
    );
    expect(response.totalAssets).toBe(response.assets.length);
    expect(
      response.rightsSummary.reduce((sum, summary) => sum + summary.count, 0),
    ).toBe(response.assets.length);
  });

  it("only marks reviewed public-domain candidates as cache eligible", () => {
    const response = buildMediaIndexResponse();
    const cacheable = response.assets.filter(canCacheMediaAsset);

    expect(response.cacheEligibleCount).toBe(cacheable.length);
    expect(
      cacheable.every(
        (asset) =>
          asset.rightsStatus === "public_domain_likely" &&
          asset.storageStatus === "eligible_for_cache",
      ),
    ).toBe(true);
    expect(
      response.assets
        .filter((asset) => asset.rightsStatus === "permission_required")
        .every((asset) => !canCacheMediaAsset(asset)),
    ).toBe(true);
  });

  it("sorts assets newest first and exposes human rights labels", () => {
    const assets = listMediaAssets();

    expect(assets[0]?.date).toBe("1963-11-25");
    expect(mediaRightsLabel("permission_required")).toBe("Permission required");
    expect(mediaRightsDescription("permission_required")).toBe(
      "Collection policy or known rights ownership requires written permission before image reuse or local storage.",
    );
  });

  it("loads curated seed assets into the public media index", () => {
    const response = buildMediaIndexResponse();

    expect(response.totalAssets).toBeGreaterThan(10);
    expect(getMediaAsset("jfkl-jfkwhp-1963-11-22-b")?.title).toContain(
      "Love Field",
    );
    expect(mediaAssetHref("jfkl-jfkwhp-1963-11-22-b")).toBe(
      "/media/jfkl-jfkwhp-1963-11-22-b",
    );
  });

  it("filters media assets and builds relationship facets", () => {
    const assets = listMediaAssets();
    const dallas = filterMediaAssets(assets, {
      q: "dallas",
      topic: "dealey-plaza",
    });
    const related = findRelatedMediaAssets(assets, {
      topics: ["dealey-plaza"],
      entities: ["oswald"],
      limit: 3,
    });
    const facets = buildMediaFacets(assets);

    expect(dallas.some((asset) => asset.title.includes("Love Field"))).toBe(true);
    expect(related).toHaveLength(3);
    expect(
      related.some((asset) => asset.relatedTopics.includes("dealey-plaza")),
    ).toBe(true);
    expect(
      findRelatedMediaAssets(assets, {
        topics: ["dealey-plaza"],
        limit: -1,
      }),
    ).toEqual([]);
    expect(
      findRelatedMediaAssets(assets, {
        topics: ["dealey-plaza"],
        limit: 1.8,
      }),
    ).toHaveLength(1);
    expect(facets.tags.some((tag) => tag.value === "state funeral")).toBe(true);
  });
});
