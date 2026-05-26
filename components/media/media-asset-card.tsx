import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SaveResearchButton } from "@/components/research/save-research-button";
import type { MediaAsset } from "@/lib/api-types";
import type { MediaRightsStatus } from "@/lib/constants";
import {
  mediaAssetHref,
  mediaRightsDescription,
  mediaRightsLabel,
} from "@/lib/media-assets";

/** Maps canonical media rights statuses to badge tones for media status UI. */
export const rightsTone: Record<MediaRightsStatus, BadgeTone> = {
  public_domain_likely: "high",
  permission_required: "medium",
  copyright_unknown: "low",
  metadata_only: "muted",
};

/** Maps media storage statuses to compact human labels for badges and summaries. */
export const storageLabel: Record<MediaAsset["storageStatus"], string> = {
  metadata_only: "Metadata only",
  external_reference: "External reference",
  eligible_for_cache: "Eligible after review",
  cached: "Cached locally",
};

/**
 * Renders a media asset card with status badges, metadata, and source links.
 *
 * @param props.asset Media asset to display.
 * @param props.compact When true, uses a shorter preview and omits description copy.
 * @returns A linked card suitable for media grids and related-media panels.
 */
export function MediaAssetCard({
  asset,
  compact = false,
}: {
  asset: MediaAsset;
  compact?: boolean;
}) {
  const href = mediaAssetHref(asset.id);
  return (
    <article
      style={{
        ...surfaceCardStyle,
        height: "100%",
        display: "grid",
        gridTemplateRows: compact ? "120px auto" : "170px auto",
        overflow: "hidden",
      }}
    >
      <Link href={href} aria-label={`Open ${asset.title}`} style={previewStyle}>
        {asset.localImagePath ? (
          <img
            src={asset.localImagePath}
            alt=""
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
              <div
                className="eyebrow"
                style={{ color: "var(--text-muted)", marginBottom: 8 }}
              >
                {asset.collection}
              </div>
              <div className="muted" style={placeholderCopyStyle}>
                {asset.storageStatus === "cached"
                  ? "Cached image"
                  : "Metadata-only preview"}
              </div>
            </div>
          </div>
        )}
      </Link>
      <div style={{ padding: compact ? 14 : 16, display: "grid", gap: 11 }}>
        <MediaStatusBadges asset={asset} />
        <div>
          <h2 style={compact ? compactTitleStyle : titleStyle}>
            <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
              {asset.title}
            </Link>
          </h2>
          <div className="muted num" style={identifierStyle}>
            {asset.digitalIdentifier}
            {asset.dateLabel ? ` / ${asset.dateLabel}` : ""}
          </div>
        </div>
        {!compact && (
          <p className="muted" style={descriptionStyle}>
            {asset.description}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href={href} style={sourceLinkStyle}>
            Inspect asset
          </Link>
          <a
            href={asset.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={secondaryLinkStyle}
          >
            Official record
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * Renders rights and storage badges for a media asset.
 *
 * @param props.asset Media asset whose rightsStatus and storageStatus drive labels.
 * @returns Inline badge group.
 */
export function MediaStatusBadges({ asset }: { asset: MediaAsset }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Badge tone={rightsTone[asset.rightsStatus]} size="sm">
        {mediaRightsLabel(asset.rightsStatus)}
      </Badge>
      <Badge tone="muted" size="sm">
        {storageLabel[asset.storageStatus]}
      </Badge>
    </div>
  );
}

/**
 * Renders explanatory rights/storage copy for a media asset.
 *
 * @param props.asset Media asset whose rights status and storage note are shown.
 * @returns Compact policy note block.
 */
export function MediaRightsNote({ asset }: { asset: MediaAsset }) {
  return (
    <div style={rightsNoteStyle}>
      <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
        Rights and storage
      </div>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
        {mediaRightsDescription(asset.rightsStatus)}
      </p>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
        {asset.storageNote}
      </p>
    </div>
  );
}

/**
 * Converts a media asset into a saved-research payload.
 *
 * @param asset Media asset to save.
 * @returns Saved item with media type, media href, and context from rights/storage labels.
 */
export function mediaSaveItem(asset: MediaAsset) {
  return {
    type: "media" as const,
    sourceId: asset.id,
    title: asset.title,
    href: mediaAssetHref(asset.id),
    context: `${mediaRightsLabel(asset.rightsStatus)} / ${storageLabel[asset.storageStatus]}`,
  };
}

/**
 * Renders the saved-research action for a media asset.
 *
 * @param props.asset Media asset to save or unsave.
 * @returns Compact SaveResearchButton wired to mediaSaveItem.
 */
export function MediaSaveButton({ asset }: { asset: MediaAsset }) {
  return <SaveResearchButton item={mediaSaveItem(asset)} compact />;
}

const previewStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  padding: 18,
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--surface-2) 82%, transparent), var(--surface))",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  textDecoration: "none",
};

const surfaceCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
};

const placeholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: 14,
};

const placeholderCopyStyle: CSSProperties = {
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const titleStyle: CSSProperties = {
  fontSize: "1.18rem",
  letterSpacing: 0,
  lineHeight: 1.22,
  marginBottom: 6,
};

const compactTitleStyle: CSSProperties = {
  ...titleStyle,
  fontSize: "1rem",
};

const identifierStyle: CSSProperties = {
  fontSize: "0.78rem",
  lineHeight: 1.45,
};

const descriptionStyle: CSSProperties = {
  fontSize: "0.88rem",
  lineHeight: 1.55,
};

const sourceLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  background: "var(--surface-2)",
  fontSize: "0.84rem",
  fontWeight: 650,
};

const secondaryLinkStyle: CSSProperties = {
  ...sourceLinkStyle,
  borderColor: "var(--border)",
  background: "var(--surface)",
};

const rightsNoteStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 16,
  display: "grid",
  gap: 8,
};
