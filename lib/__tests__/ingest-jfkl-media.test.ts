import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

type IngestModule = {
  buildAssetFromSeed: (seed: unknown, metadata?: Record<string, unknown>) => Record<string, unknown>;
  buildManifest: (assets: Array<Record<string, unknown>>, warnings?: unknown[]) => Record<string, unknown>;
  canDownloadAsset: (asset: Record<string, unknown>) => boolean;
  deriveAssetId: (sourceUrl: string) => string;
  normalizeSeed: (seed: unknown) => Record<string, unknown>;
  parseAssetMetadata: (html: string, sourceUrl: string) => Record<string, unknown>;
  run: (argv?: string[], fetchImpl?: typeof fetch) => Promise<Record<string, unknown> | null>;
};

const sampleHtml = `
  <!doctype html>
  <html>
    <head>
      <title>State Funeral of President Kennedy | JFK Library</title>
      <meta property="og:description" content="Official photograph record." />
      <meta property="og:image" content="/media/test-image.jpg" />
    </head>
    <body>
      <dl>
        <dt>Collection</dt><dd>White House Photographs</dd>
        <dt>Digital Identifier</dt><dd>JFKWHP-1963-11-24-A</dd>
        <dt>Media Type</dt><dd>Negative</dd>
        <dt>Date</dt><dd>1963-11-24</dd>
        <dt>Credit Line</dt><dd>Cecil Stoughton. White House Photographs.</dd>
      </dl>
    </body>
  </html>
`;

let ingest: IngestModule;
const tempDirs: string[] = [];

beforeAll(async () => {
  const scriptPath = "../../scripts/ingest-jfkl-media.mjs";
  ingest = (await import(scriptPath)) as IngestModule;
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("ingest-jfkl-media helpers", () => {
  it("derives stable asset ids from JFK Library asset URLs", () => {
    expect(
      ingest.deriveAssetId(
        "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-30618",
      ),
    ).toBe("jfkl-jfkwhp-kn-30618");
  });

  it("normalizes seed defaults without granting cache permission", () => {
    const seed = ingest.normalizeSeed({
      sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/unknown-item",
      tags: ["  funeral ", "funeral", ""],
    });

    expect(seed.rightsStatus).toBe("copyright_unknown");
    expect(seed.storageStatus).toBe("metadata_only");
    expect(seed.tags).toEqual(["funeral"]);
  });

  it("rejects non-JFK Library source hosts before fetch", () => {
    expect(() =>
      ingest.normalizeSeed({
        sourceUrl: "https://example.com/asset-viewer/archives/unknown-item",
      }),
    ).toThrow("Untrusted JFK Library source host");
  });

  it("extracts page metadata and merges it with explicit rights review", () => {
    const metadata = ingest.parseAssetMetadata(
      sampleHtml,
      "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-c30665",
    );
    const asset = ingest.buildAssetFromSeed(
      {
        sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-c30665",
        rightsStatus: "public_domain_likely",
        storageStatus: "eligible_for_cache",
      },
      metadata,
    );

    expect(asset.title).toBe("State Funeral of President Kennedy");
    expect(asset.collection).toBe("White House Photographs");
    expect(asset.digitalIdentifier).toBe("JFKWHP-1963-11-24-A");
    expect(asset.thumbnailUrl).toBe("https://www.jfklibrary.org/media/test-image.jpg");
    expect(ingest.canDownloadAsset(asset)).toBe(true);
  });

  it("counts cache eligibility from the canonical download rule", () => {
    const allowed = ingest.buildAssetFromSeed({
      sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-c30665",
      rightsStatus: "public_domain_likely",
      storageStatus: "eligible_for_cache",
    });
    const blocked = ingest.buildAssetFromSeed({
      sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/kfc-004-018-p0004",
      rightsStatus: "permission_required",
      storageStatus: "metadata_only",
    });
    const manifest = ingest.buildManifest([allowed, blocked], []);

    expect(manifest.cacheEligibleCount).toBe(1);
    expect(manifest.cachedCount).toBe(0);
    expect(ingest.canDownloadAsset(blocked)).toBe(false);
  });

  it("does not download cache-eligible images during dry runs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "jfkl-media-ingest-"));
    tempDirs.push(dir);
    const input = path.join(dir, "seeds.json");
    await writeFile(
      input,
      JSON.stringify([
        {
          sourceUrl: "https://www.jfklibrary.org/asset-viewer/archives/jfkwhp-kn-c30665",
          rightsStatus: "public_domain_likely",
          storageStatus: "eligible_for_cache",
          imageUrl: "https://www.jfklibrary.org/media/test-image.jpg",
        },
      ]),
      "utf8",
    );

    let fetchCount = 0;
    const manifest = await ingest.run(
      [
        "--input",
        input,
        "--output",
        path.join(dir, "manifest.json"),
        "--dry-run",
        "--no-fetch",
        "--download-cleared",
      ],
      (async () => {
        fetchCount += 1;
        throw new Error("fetch should not run during dry-run downloads");
      }) as unknown as typeof fetch,
    );

    const assets = manifest?.assets as Array<Record<string, unknown>>;
    expect(fetchCount).toBe(0);
    expect(assets[0]?.storageStatus).toBe("eligible_for_cache");
    expect(assets[0]?.localImagePath).toBeNull();
  });
});
