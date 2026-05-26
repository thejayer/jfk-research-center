import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { fetchMediaIndex } from "@/lib/api-client";
import type { MediaAsset } from "@/lib/api-types";
import {
  buildMediaFacets,
  filterMediaAssets,
  type MediaAssetFilters,
} from "@/lib/media-assets";
import { mediaRightsKeys, type MediaRightsStatus } from "@/lib/constants";
import {
  MediaAssetCard,
  rightsTone,
  storageLabel,
} from "@/components/media/media-asset-card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official media",
  description:
    "Rights-aware index of official JFK Library photographs and media candidates for the JFK Research Center.",
};

const storageKeys = [
  "metadata_only",
  "external_reference",
  "eligible_for_cache",
  "cached",
] as const satisfies readonly MediaAsset["storageStatus"][];

export default async function MediaIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await fetchMediaIndex();
  const filters = parseMediaFilters(params);
  const filteredAssets = filterMediaAssets(data.assets, filters);
  const facets = buildMediaFacets(data.assets);
  const cacheReady = data.assets.filter(
    (asset) => asset.storageStatus === "eligible_for_cache",
  );
  const protectedAssets = data.assets.filter(
    (asset) => asset.rightsStatus !== "public_domain_likely",
  );

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={heroGridStyle}>
        <div style={{ maxWidth: "72ch" }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Official media
          </div>
          <h1 style={heroTitleStyle}>
            A rights-aware image lane for the archive
          </h1>
          <p className="muted" style={heroCopyStyle}>
            This explorer starts with official JFK Library media records and
            keeps rights status visible before any image files are copied into
            local storage. Public-domain candidates can move into a later cache
            job after item-level review; permission-required and unknown-rights
            material remains metadata-only.
          </p>
        </div>
        <aside aria-label="Media ingest status" style={statusPanelStyle}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Ingest status
          </div>
          <div style={metricGridStyle}>
            {[
              ["Assets", data.totalAssets],
              ["Review", cacheReady.length],
              ["Cached", data.cachedCount],
            ].map(([label, value]) => (
              <div key={label} style={metricBoxStyle}>
                <div className="num" style={metricValueStyle}>
                  {value}
                </div>
                <div className="muted" style={metricLabelStyle}>
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            The first version stores metadata and official source links. Local
            thumbnails should be added only when an asset is cleared.
          </p>
          <Link href="/admin/media" style={adminLinkStyle}>
            Open rights review queue
          </Link>
        </aside>
      </header>

      <section style={{ marginBottom: 42 }}>
        <SectionHeading
          eyebrow="Rights model"
          title="Every media item carries a reuse decision"
          description="The gallery separates source discovery from binary storage so a copyright-unknown photograph cannot quietly become a hosted asset."
        />
        <div style={rightsGridStyle}>
          {data.rightsSummary.map((summary) => (
            <article key={summary.status} className="surface-card" style={rightsCardStyle}>
              <Badge tone={rightsTone[summary.status]} size="sm">
                {summary.label}
              </Badge>
              <div className="num" style={rightsCountStyle}>
                {summary.count}
              </div>
              <p className="muted" style={rightsCopyStyle}>
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
        <div className="surface-card" style={policyPanelStyle}>
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

      <section aria-label="Media filters" style={{ marginBottom: 30 }}>
        <form action="/media" style={filterPanelStyle}>
          <label style={fieldStyle}>
            <span className="eyebrow" style={fieldLabelStyle}>
              Search
            </span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search title, identifier, tag..."
              style={inputStyle}
            />
          </label>
          <SelectField
            name="collection"
            label="Collection"
            value={filters.collection ?? ""}
            options={facets.collections}
          />
          <label style={fieldStyle}>
            <span className="eyebrow" style={fieldLabelStyle}>
              Rights
            </span>
            <select name="rights" defaultValue={filters.rights ?? ""} style={inputStyle}>
              <option value="">All rights</option>
              {mediaRightsKeys.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span className="eyebrow" style={fieldLabelStyle}>
              Storage
            </span>
            <select name="storage" defaultValue={filters.storage ?? ""} style={inputStyle}>
              <option value="">All storage</option>
              {storageKeys.map((status) => (
                <option key={status} value={status}>
                  {storageLabel[status]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={submitStyle}>
            Apply filters
          </button>
          {hasActiveFilters(filters) && (
            <Link href="/media" style={resetStyle}>
              Reset
            </Link>
          )}
        </form>
        <FacetChips title="Tags" items={facets.tags.slice(0, 12)} param="tag" filters={filters} />
        <FacetChips
          title="Topics"
          items={facets.topics.slice(0, 8)}
          param="topic"
          filters={filters}
        />
      </section>

      <section>
        <SectionHeading
          eyebrow="Seed manifest"
          title="Official media candidates"
          description={`${filteredAssets.length.toLocaleString()} of ${data.totalAssets.toLocaleString()} JFK Library records match the current view.`}
        />
        {filteredAssets.length > 0 ? (
          <ul style={assetGridStyle}>
            {filteredAssets.map((asset) => (
              <li key={asset.id}>
                <MediaAssetCard asset={asset} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="surface-card" style={emptyStyle}>
            <h2 style={{ fontSize: "1.2rem", letterSpacing: 0 }}>
              No media records match those filters.
            </h2>
            <p className="muted" style={{ lineHeight: 1.55 }}>
              Clear one or more filters, or search the official JFK Library
              source catalog for additional candidate records.
            </p>
          </div>
        )}
      </section>

      {protectedAssets.length > 0 && (
        <section aria-label="Protected media note" style={protectedNoteStyle}>
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

function SelectField({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
}) {
  return (
    <label style={fieldStyle}>
      <span className="eyebrow" style={fieldLabelStyle}>
        {label}
      </span>
      <select name={name} defaultValue={value} style={inputStyle}>
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function FacetChips({
  title,
  items,
  param,
  filters,
}: {
  title: string;
  items: Array<{ value: string; label: string; count: number }>;
  param: "tag" | "topic" | "entity";
  filters: MediaAssetFilters;
}) {
  if (items.length === 0) return null;
  return (
    <div style={facetRowStyle}>
      <span className="eyebrow" style={{ color: "var(--text-muted)" }}>
        {title}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => {
          const active = filters[param] === item.value;
          return (
            <Link
              key={item.value}
              href={buildFilterHref(filters, { [param]: active ? "" : item.value })}
              style={{
                ...chipStyle,
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              {item.label}
              <span className="num muted">{item.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function parseMediaFilters(
  params: Record<string, string | string[] | undefined>,
): MediaAssetFilters {
  const rights = firstParam(params.rights);
  const storage = firstParam(params.storage);
  return {
    q: firstParam(params.q),
    collection: firstParam(params.collection),
    rights: mediaRightsKeys.includes(rights as MediaRightsStatus)
      ? (rights as MediaRightsStatus)
      : null,
    storage: storageKeys.includes(storage as MediaAsset["storageStatus"])
      ? (storage as MediaAsset["storageStatus"])
      : null,
    tag: firstParam(params.tag),
    entity: firstParam(params.entity),
    topic: firstParam(params.topic),
  };
}

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

function hasActiveFilters(filters: MediaAssetFilters): boolean {
  return Boolean(
    filters.q ||
      filters.collection ||
      filters.rights ||
      filters.storage ||
      filters.tag ||
      filters.entity ||
      filters.topic,
  );
}

function buildFilterHref(
  filters: MediaAssetFilters,
  next: Partial<Record<keyof MediaAssetFilters, string | null>>,
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...next };
  for (const key of ["q", "collection", "rights", "storage", "tag", "entity", "topic"] as const) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/media?${query}` : "/media";
}

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 28,
  alignItems: "start",
  marginBottom: 38,
};

const heroTitleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "2.25rem",
  letterSpacing: 0,
  lineHeight: 1.1,
  marginTop: 8,
  marginBottom: 18,
};

const heroCopyStyle: CSSProperties = {
  fontSize: "1.02rem",
  lineHeight: 1.65,
};

const statusPanelStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 18,
  display: "grid",
  gap: 14,
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
};

const metricBoxStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 8px",
  textAlign: "center",
};

const metricValueStyle: CSSProperties = {
  fontSize: "1.25rem",
  color: "var(--text)",
};

const metricLabelStyle: CSSProperties = {
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 2,
};

const adminLinkStyle: CSSProperties = {
  color: "var(--link)",
  fontWeight: 650,
  fontSize: "0.9rem",
};

const rightsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
};

const rightsCardStyle: CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const rightsCountStyle: CSSProperties = {
  fontSize: "1.45rem",
  color: "var(--text)",
};

const rightsCopyStyle: CSSProperties = {
  fontSize: "0.86rem",
  lineHeight: 1.55,
};

const policyPanelStyle: CSSProperties = {
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 16,
  alignItems: "center",
};

const policyLinkStyle: CSSProperties = {
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
};

const filterPanelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: 10,
  alignItems: "end",
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
};

const fieldStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 38,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--background)",
  color: "var(--text)",
  padding: "8px 10px",
  font: "inherit",
};

const submitStyle: CSSProperties = {
  minHeight: 38,
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "#fff",
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const resetStyle: CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  color: "var(--text)",
};

const facetRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  marginTop: 12,
};

const chipStyle: CSSProperties = {
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 9px",
  color: "var(--text)",
  fontSize: "0.83rem",
  textDecoration: "none",
};

const assetGridStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 14,
};

const emptyStyle: CSSProperties = {
  padding: 24,
  display: "grid",
  gap: 8,
};

const protectedNoteStyle: CSSProperties = {
  marginTop: 42,
  borderTop: "1px solid var(--border)",
  paddingTop: 24,
};
