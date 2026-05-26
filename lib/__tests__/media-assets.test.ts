import { describe, expect, it } from "vitest";
import { mediaRightsKeys } from "../constants";
import {
  buildMediaIndexResponse,
  canCacheMediaAsset,
  listMediaAssets,
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

    expect(assets[0]?.date).toBe("1963-11-24");
    expect(mediaRightsLabel("permission_required")).toBe("Permission required");
    expect(mediaRightsDescription("permission_required")).toBe(
      "Collection policy or known rights ownership requires written permission before image reuse or local storage.",
    );
  });
});
