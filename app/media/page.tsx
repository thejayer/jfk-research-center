import type { Metadata } from "next";
import { fetchMediaIndex } from "@/lib/api-client";
import type { MediaAsset } from "@/lib/api-types";
import type { MediaRightsStatus } from "@/lib/constants";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official media",
  description:
    "Rights-aware index of official JFK Library photographs and media candidates for the JFK Research Center.",
};

const rightsTone: Record<MediaRightsStatus, BadgeTone> = {
  public_domain_likely: "high",
  permission_required: "medium",
  copyright_unknown: "low",
  metadata_only: "muted",
};

const storageLabel: Record<MediaAsset["storageStatus"], string> = {
  metadata_only: "Metadata only",
  external_reference: "External reference",
  eligible_for_cache: "Eligible after review",
  cached: "Cached locally",
};

export default async function MediaIndexPage() {
  const data = await fetchMediaIndex();
  const cacheReady = data.assets.filter(
    (asset) => asset.storageStatus === "eligible_for_cache",
  );
  const protectedAssets = data.assets.filter(
    (asset) => asset.rightsStatus !== "public_domain_likely",
  );

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 28,
          alignItems: "start",
          marginBottom: 38,
        }}
      >
        <div style={{ maxWidth: "72ch" }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Official media
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.25rem",
              letterSpacing: 0,
              lineHeight: 1.1,
              marginTop: 8,
              marginBottom: 18,
            }}
          >
            A rights-aware image lane for the archive
          </h1>
          <p
            className="muted"
            style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
          >
            This index starts with official JFK Library media records and keeps
            rights status visible before any image files are copied into our
            storage. Public-domain candidates can move into a later cache job
            after item-level review; permission-required and unknown-rights
            material remains metadata-only.
          </p>
        </div>
        <aside
          aria-label="Media ingest status"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Ingest status
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["Assets", data.totalAssets],
              ["Review", cacheReady.length],
              ["Cached", data.cachedCount],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  className="num"
                  style={{ fontSize: "1.25rem", color: "var(--text)" }}
                >
                  {value}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.68rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginTop: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            The first version stores metadata and official source links. Local
            thumbnails should be added only when an asset is cleared.
          </p>
        </aside>
      </header>

      <section style={{ marginBottom: 42 }}>
        <SectionHeading
          eyebrow="Rights model"
          title="Every media item carries a reuse decision"
          description="The gallery separates source discovery from binary storage so a copyright-unknown photograph cannot quietly become a hosted asset."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 12,
          }}
        >
          {data.rightsSummary.map((summary) => (
            <article
              key={summary.status}
              className="surface-card"
              style={{
                padding: 16,
                display: "grid",
                gap: 10,
                alignContent: "start",
              }}
            >
              <Badge tone={rightsTone[summary.status]} size="sm">
                {summary.label}
              </Badge>
              <div
                className="num"
                style={{ fontSize: "1.45rem", color: "var(--text)" }}
              >
                {summary.count}
              </div>
              <p
                className="muted"
                style={{ fontSize: "0.86rem", lineHeight: 1.55 }}
              >
                {summary.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 46 }}>
        <SectionHeading
          eyebrow="Source policy"
          title="Metadata first, storage second"
          description="The JFK Library remains the system of record. We capture enough metadata to curate and cite assets, then add local files only after review."
        />
        <div
          className="surface-card"
          style={{
            padding: 18,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 16,
            alignItems: "center",
          }}
        >
          <p className="muted" style={{ lineHeight: 1.6 }}>
            {data.sourcePolicy.note}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a href={data.sourcePolicy.searchUrl} style={policyLinkStyle}>
              JFK Library search
            </a>
            <a href={data.sourcePolicy.copyrightUrl} style={policyLinkStyle}>
              Copyright guidance
            </a>
            <a href={data.sourcePolicy.reproductionsUrl} style={policyLinkStyle}>
              Reproductions
            </a>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Seed manifest"
          title="Official media candidates"
          description={`${data.totalAssets.toLocaleString()} JFK Library records are now represented in the rights-aware manifest.`}
        />
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {data.assets.map((asset) => (
            <li key={asset.id}>
              <MediaAssetCard asset={asset} />
            </li>
          ))}
        </ul>
      </section>

      {protectedAssets.length > 0 && (
        <section
          aria-label="Protected media note"
          style={{
            marginTop: 42,
            borderTop: "1px solid var(--border)",
            paddingTop: 24,
          }}
        >
          <p className="muted" style={{ maxWidth: "74ch", lineHeight: 1.65 }}>
            Protected or uncertain material is still useful as a source pointer.
            It should remain linked to the official JFK Library record until
            permission or public-domain status is documented.
          </p>
        </section>
      )}
    </div>
  );
}

function MediaAssetCard({ asset }: { asset: MediaAsset }) {
  return (
    <article
      className="surface-card"
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "170px auto",
        overflow: "hidden",
      }}
    >
      <div
        aria-label={asset.thumbnailUrl ? asset.title : "Image not cached"}
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          padding: 18,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--surface-2) 82%, transparent), var(--surface))",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 14,
          }}
        >
          <div>
            <div
              className="eyebrow"
              style={{ color: "var(--text-muted)", marginBottom: 8 }}
            >
              {asset.collection}
            </div>
            <div
              className="muted"
              style={{ fontSize: "0.82rem", lineHeight: 1.45 }}
            >
              {asset.storageStatus === "cached"
                ? "Cached image"
                : "Metadata-only preview"}
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 11 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge tone={rightsTone[asset.rightsStatus]} size="sm">
            {asset.rightsStatus.replaceAll("_", " ")}
          </Badge>
          <Badge tone="muted" size="sm">
            {storageLabel[asset.storageStatus]}
          </Badge>
        </div>
        <div>
          <h2
            style={{
              fontSize: "1.18rem",
              letterSpacing: 0,
              lineHeight: 1.22,
              marginBottom: 6,
            }}
          >
            {asset.title}
          </h2>
          <div
            className="muted num"
            style={{ fontSize: "0.78rem", lineHeight: 1.45 }}
          >
            {asset.digitalIdentifier}
            {asset.dateLabel ? ` / ${asset.dateLabel}` : ""}
          </div>
        </div>
        <p className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
          {asset.description}
        </p>
        <dl
          style={{
            display: "grid",
            gap: 6,
            margin: 0,
            fontSize: "0.8rem",
            lineHeight: 1.45,
          }}
        >
          <div>
            <dt className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Credit
            </dt>
            <dd className="muted" style={{ margin: "4px 0 0" }}>
              {asset.creditLine}
            </dd>
          </div>
          <div>
            <dt className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Storage note
            </dt>
            <dd className="muted" style={{ margin: "4px 0 0" }}>
              {asset.storageNote}
            </dd>
          </div>
        </dl>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href={asset.sourceUrl} style={sourceLinkStyle}>
            Open official record
          </a>
        </div>
      </div>
    </article>
  );
}

const policyLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  background: "var(--surface)",
  fontSize: "0.84rem",
  fontWeight: 650,
} as const;

const sourceLinkStyle = {
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
} as const;
