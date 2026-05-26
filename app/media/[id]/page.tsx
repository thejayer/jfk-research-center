import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { fetchMediaAsset, fetchMediaIndex } from "@/lib/api-client";
import {
  findRelatedMediaAssets,
  mediaAssetHref,
} from "@/lib/media-assets";
import {
  MediaRightsNote,
  MediaSaveButton,
  MediaStatusBadges,
  storageLabel,
} from "@/components/media/media-asset-card";
import { RelatedMediaPanel } from "@/components/media/related-media-panel";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await fetchMediaAsset(id);
  if (!asset) return { title: "Media asset not found" };
  return {
    title: asset.title,
    description: asset.description,
  };
}

export default async function MediaAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [asset, index] = await Promise.all([
    fetchMediaAsset(id),
    fetchMediaIndex(),
  ]);
  if (!asset) notFound();

  const relatedAssets = findRelatedMediaAssets(index.assets, {
    entities: asset.relatedEntities,
    topics: asset.relatedTopics,
    limit: 4,
  }).filter((related) => related.id !== asset.id);
  const primaryImageAlt = asset.title
    ? `Media asset: ${asset.title}`
    : `Media asset: ${asset.id}`;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "media",
          sourceId: asset.id,
          title: asset.title,
          href: mediaAssetHref(asset.id),
          context: storageLabel[asset.storageStatus],
        }}
      />
      <nav aria-label="Breadcrumb" style={breadcrumbStyle}>
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <Link href="/media" style={{ color: "var(--text-muted)" }}>
          Official media
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{asset.digitalIdentifier}</span>
      </nav>

      <header style={heroStyle}>
        <div style={previewStyle}>
          {asset.localImagePath ? (
            <img
              src={asset.localImagePath}
              alt={primaryImageAlt}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div style={placeholderStyle}>
              <div>
                <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
                  {asset.collection}
                </div>
                <p className="muted" style={{ margin: "10px 0 0", lineHeight: 1.55 }}>
                  Image binary is not hosted here. Use the official JFK Library
                  record until rights review clears local storage.
                </p>
              </div>
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            {asset.mediaType}
          </div>
          <h1 style={titleStyle}>{asset.title}</h1>
          <div style={{ marginBottom: 14 }}>
            <MediaStatusBadges asset={asset} />
          </div>
          <p className="muted" style={{ fontSize: "1rem", lineHeight: 1.65 }}>
            {asset.description}
          </p>
          <div style={actionRowStyle}>
            <a
              href={asset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryActionStyle}
            >
              Open official JFK Library record
            </a>
            <MediaSaveButton asset={asset} />
          </div>
        </div>
      </header>

      <div style={contentGridStyle}>
        <main style={{ minWidth: 0 }}>
          <section aria-labelledby="media-citation">
            <SectionHeading
              eyebrow="Citation"
              title="Source and catalog details"
              description="Use the official record as the source of truth for image inspection, reproduction requests, and rights review."
            />
            <dl style={detailGridStyle}>
              <DetailRow label="Digital identifier" value={asset.digitalIdentifier} />
              <DetailRow label="Collection" value={asset.collection} />
              <DetailRow label="Date" value={asset.dateLabel ?? asset.date ?? "Unknown"} />
              <DetailRow label="Credit line" value={asset.creditLine} />
              <DetailRow label="Storage status" value={storageLabel[asset.storageStatus]} />
            </dl>
          </section>

          <section style={{ marginTop: 40 }} aria-labelledby="media-relationships">
            <SectionHeading
              eyebrow="Relationships"
              title="Where this media connects"
              description="Relationship tags are editorial pointers into site topics and entities; they do not imply copyright clearance."
            />
            <div style={relationshipGridStyle}>
              <RelationshipList
                title="Topics"
                items={asset.relatedTopics}
                hrefFor={(value) => `/topic/${encodeURIComponent(value)}`}
              />
              <RelationshipList
                title="Entities"
                items={asset.relatedEntities}
                hrefFor={(value) => `/entity/${encodeURIComponent(value)}`}
              />
              <RelationshipList
                title="Tags"
                items={asset.tags}
                hrefFor={(value) => `/media?tag=${encodeURIComponent(value)}`}
              />
            </div>
          </section>

          <RelatedMediaPanel
            assets={relatedAssets}
            title="Related official media"
            description="More JFK Library media records connected by shared topic or entity tags."
          />
        </main>

        <aside style={asideStyle}>
          <MediaRightsNote asset={asset} />
          <div style={sideCardStyle}>
            <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Review stance
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              This page is a citation and workflow surface. It does not host
              external images unless the manifest marks an asset cached after
              explicit rights review.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailRowStyle}>
      <dt className="eyebrow" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="muted" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>
        {value}
      </dd>
    </div>
  );
}

function RelationshipList({
  title,
  items,
  hrefFor,
}: {
  title: string;
  items: string[];
  hrefFor: (value: string) => string;
}) {
  return (
    <div style={sideCardStyle}>
      <h2 style={smallHeadingStyle}>{title}</h2>
      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((item) => (
            <Link key={item} href={hrefFor(item)} style={chipStyle}>
              {item}
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No {title.toLowerCase()} assigned yet.
        </p>
      )}
    </div>
  );
}

const breadcrumbStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  marginBottom: 22,
};

const heroStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: 30,
  alignItems: "center",
  marginBottom: 46,
};

const previewStyle: CSSProperties = {
  minHeight: 320,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--surface-2) 84%, transparent), var(--surface))",
  overflow: "hidden",
  display: "grid",
  placeItems: "center",
  padding: 22,
};

const placeholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 260,
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  padding: 24,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(2rem, 1.5rem + 1.2vw, 3rem)",
  letterSpacing: 0,
  lineHeight: 1.08,
  marginTop: 8,
  marginBottom: 14,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  marginTop: 18,
};

const primaryActionStyle: CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  padding: "8px 12px",
  fontWeight: 700,
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
  gap: 30,
  alignItems: "start",
};

const detailGridStyle: CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 12,
};

const detailRowStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: 13,
  background: "var(--surface)",
};

const relationshipGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 12,
};

const asideStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const sideCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 16,
  display: "grid",
  gap: 10,
};

const smallHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.92rem",
  letterSpacing: 0,
};

const chipStyle: CSSProperties = {
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 9px",
  color: "var(--text)",
  background: "var(--surface-2)",
  fontSize: "0.83rem",
};
