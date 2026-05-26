import Link from "next/link";
import type { MediaAsset } from "@/lib/api-types";
import { MediaAssetCard } from "@/components/media/media-asset-card";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Renders related official JFK Library media near a research page.
 *
 * @param props.assets Media assets to show; returns null when the list is empty.
 * @param props.title Optional panel title, defaulting to "Official media nearby".
 * @param props.description Optional panel description, defaulting to metadata-relationship copy.
 * @returns Related media section or null.
 */
export function RelatedMediaPanel({
  assets,
  title = "Official media nearby",
  description = "JFK Library media records connected by the same topic or entity metadata.",
}: {
  assets: MediaAsset[];
  title?: string;
  description?: string;
}) {
  if (assets.length === 0) return null;

  return (
    <section
      id="related-media"
      aria-label={title}
      style={{ marginTop: 40, scrollMarginTop: 24 }}
    >
      <SectionHeading eyebrow="Official media" title={title} description={description} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 14,
        }}
      >
        {assets.map((asset) => (
          <MediaAssetCard key={asset.id} asset={asset} compact />
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Link
          href="/media"
          style={{
            color: "var(--link)",
            fontSize: "0.92rem",
            fontWeight: 650,
          }}
        >
          Browse all official media
        </Link>
      </div>
    </section>
  );
}
