import Link from "next/link";
import type { CSSProperties } from "react";
import { fetchMediaIndex } from "@/lib/warehouse";
import { canCacheMediaAsset, mediaAssetHref } from "@/lib/media-assets";
import { mediaRightsLabel } from "@/lib/media-assets";
import { storageLabel } from "@/components/media/media-asset-card";

export const dynamic = "force-dynamic";

export default async function AdminMediaReviewPage() {
  const data = await fetchMediaIndex();
  const reviewQueue = data.assets.filter(
    (asset) =>
      asset.storageStatus === "external_reference" ||
      asset.storageStatus === "eligible_for_cache" ||
      asset.rightsStatus !== "public_domain_likely",
  );
  const cacheEligible = data.assets.filter(canCacheMediaAsset);

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Admin
        </p>
        <h1 style={titleStyle}>Media rights review</h1>
        <p className="muted" style={{ maxWidth: "76ch", lineHeight: 1.55 }}>
          Review JFK Library media candidates before local image storage. This
          queue is intentionally read-only: update the seed or generated
          manifest after item-level rights review, then rerun the media ingest.
        </p>
      </header>

      <section aria-label="Media review metrics" style={metricGridStyle}>
        <Metric label="Assets" value={data.totalAssets} />
        <Metric label="Needs review" value={reviewQueue.length} />
        <Metric label="Cache eligible" value={cacheEligible.length} />
        <Metric label="Cached" value={data.cachedCount} />
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Queue
            </p>
            <h2 style={sectionTitleStyle}>Candidate records</h2>
          </div>
          <Link href="/media" style={adminLinkStyle}>
            View public explorer
          </Link>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                <th style={thStyle}>Asset</th>
                <th style={thStyle}>Rights</th>
                <th style={thStyle}>Storage</th>
                <th style={thStyle}>Collection</th>
                <th style={thStyle}>Decision note</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((asset) => (
                <tr key={asset.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={tdStyle}>
                    <Link href={mediaAssetHref(asset.id)} style={assetLinkStyle}>
                      {asset.title}
                    </Link>
                    <div className="muted num" style={{ marginTop: 3, fontSize: 12 }}>
                      {asset.digitalIdentifier}
                    </div>
                  </td>
                  <td style={tdStyle}>{mediaRightsLabel(asset.rightsStatus)}</td>
                  <td style={tdStyle}>{storageLabel[asset.storageStatus]}</td>
                  <td style={tdStyle}>{asset.collection}</td>
                  <td style={{ ...tdStyle, maxWidth: 360 }}>
                    <span className="muted" style={{ lineHeight: 1.45 }}>
                      {asset.storageNote}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={adminLinkStyle}
                    >
                      Official record
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <div className="num" style={{ fontSize: "1.45rem", color: "var(--text)" }}>
        {value.toLocaleString()}
      </div>
      <div className="muted" style={metricLabelStyle}>
        {label}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "40px auto 96px",
  padding: "0 20px",
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 650,
  letterSpacing: 0,
  margin: "6px 0 8px",
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const metricStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 16,
};

const metricLabelStyle: CSSProperties = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 4,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 14,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  letterSpacing: 0,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: "10px 12px",
  fontWeight: 650,
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  verticalAlign: "top",
};

const assetLinkStyle: CSSProperties = {
  color: "var(--text)",
  fontWeight: 650,
  textDecoration: "none",
};

const adminLinkStyle: CSSProperties = {
  color: "var(--link)",
  fontSize: 13,
  fontWeight: 650,
  whiteSpace: "nowrap",
};
