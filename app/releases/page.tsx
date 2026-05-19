import type { Metadata } from "next";
import Link from "next/link";
import { fetchCaseTimeline, fetchCorpusManifest } from "@/lib/api-client";
import {
  buildReleaseExplorer,
  normalizeReleaseStatusFilter,
  releaseStatusDescription,
  releaseStatusLabel,
} from "@/lib/release-explorer";
import type { ReleaseExplorerItem, ReleaseExplorerStatus } from "@/lib/release-explorer";
import { formatDate, formatNumber } from "@/lib/format";
import { normalizeHttpUrl } from "@/lib/safe-url";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Release Explorer",
  description:
    "Browse JFK Assassination Records release batches by year, corpus status, source links, and representative records.",
};

type ReleasesSearchParams = Record<string, string | string[] | undefined>;

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<ReleasesSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const year = one(resolvedSearchParams.year);
  const status = normalizeReleaseStatusFilter(one(resolvedSearchParams.status));
  const topic = one(resolvedSearchParams.topic);
  const [timeline, manifest] = await Promise.all([
    fetchCaseTimeline(),
    fetchCorpusManifest(),
  ]);
  const explorer = buildReleaseExplorer(timeline.events, manifest, {
    year,
    status,
    topic,
  });
  const activeFilterCount = [year, status, topic].filter(Boolean).length;
  const indexedRecords = Object.values(manifest.recordsByRelease).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "topic",
          sourceId: "release-explorer",
          title: "Release explorer",
          href: "/releases",
          context: `${formatNumber(explorer.items.length)} release batches visible`,
        }}
      />
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Releases</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 28,
          alignItems: "start",
          paddingTop: 42,
          paddingBottom: 36,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "72ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Release explorer
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Browse JFK record release batches
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            Scan the release history by year, indexed status, and topic-linked
            milestones. Each batch keeps the timeline context, source links, and
            representative records close together.
          </p>
          <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.65, margin: 0 }}>
            Record counts come from the corpus manifest. Representative records
            come from release timeline links, so this page shows what the local
            metadata can support rather than claiming complete agency coverage.
          </p>
        </div>

        <aside
          aria-label="Release explorer profile"
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
            Corpus status
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            <Metric label="Indexed" value={manifest.releasesIndexed.length} />
            <Metric label="Pending" value={manifest.releasesPending.length} />
            <Metric label="Records" value={indexedRecords} />
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Latest indexed release date:{" "}
            <strong>{manifest.latestIndexedReleaseDate ?? "unknown"}</strong>.
          </p>
        </aside>
      </header>

      <section
        aria-label="Release filters"
        style={{
          marginTop: 28,
          display: "grid",
          gap: 18,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Filter releases
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              Showing {formatNumber(explorer.items.length)} batches
              {activeFilterCount > 0 ? ` with ${activeFilterCount} active filters` : ""}.
            </p>
          </div>
          {activeFilterCount > 0 && (
            <LinkButton href="/releases" variant="secondary" size="sm">
              Clear filters
            </LinkButton>
          )}
        </div>

        <FilterGroup label="Year">
          {explorer.years.map((option) => (
            <FilterChip
              key={option}
              href={filterHref({ year: option, status, topic })}
              active={year === option}
              label={option}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          {(["indexed", "pending", "timeline_only"] as const).map((option) => (
            <FilterChip
              key={option}
              href={filterHref({ year, status: option, topic })}
              active={status === option}
              label={`${releaseStatusLabel(option)} (${explorer.statusCounts[option]})`}
            />
          ))}
        </FilterGroup>

        {explorer.topics.length > 0 ? (
          <FilterGroup label="Topic">
            {explorer.topics.map((option) => (
              <FilterChip
                key={option}
                href={filterHref({ year, status, topic: option })}
                active={topic === option}
                label={labelFromSlug(option)}
              />
            ))}
          </FilterGroup>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55 }}>
            Topic and agency filters appear when release timeline metadata
            contains those relationships. Current local data is strongest for
            year/status browsing.
          </p>
        )}
      </section>

      <section aria-label="Release batches" style={{ marginTop: 34 }}>
        {explorer.items.length > 0 ? (
          <div style={{ display: "grid", gap: 16 }}>
            {explorer.items.map((item) => (
              <ReleaseCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              padding: 24,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            No release batches match these filters. Clear filters or choose a
            broader status.
          </div>
        )}
      </section>
    </div>
  );
}

function ReleaseCard({ item }: { item: ReleaseExplorerItem }) {
  const firstDocumentId = item.documentLinks[0]?.documentId;

  return (
    <article
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          <div className="muted num" style={{ fontSize: "0.82rem", marginBottom: 6 }}>
            {formatDate(item.date)}
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              fontSize: "1.28rem",
              lineHeight: 1.25,
              marginBottom: 8,
            }}
          >
            {item.title}
          </h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: "var(--text)" }}>
            {item.description}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Badge tone="neutral" size="sm">
          {item.releaseSet ?? item.year}
        </Badge>
        {item.recordCount > 0 ? (
          <Badge tone="accent" size="sm">
            {formatNumber(item.recordCount)} records indexed
          </Badge>
        ) : (
          <Badge tone="low" size="sm">
            No indexed count yet
          </Badge>
        )}
        {item.relatedTopicIds.map((topicId) => (
          <Link
            key={topicId}
            href={`/topic/${encodeURIComponent(topicId)}`}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 999,
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: "0.74rem",
            }}
          >
            {labelFromSlug(topicId)}
          </Link>
        ))}
        <SourceReliabilityBadge kind="curated_metadata" />
      </div>

      {item.documentLinks.length > 0 && (
        <section aria-label={`${item.title} representative records`}>
          <div className="eyebrow" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
            Representative records
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {item.documentLinks.slice(0, 3).map((doc) => (
              <div
                key={doc.documentId}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <Link
                  href={`/document/${encodeURIComponent(doc.documentId)}`}
                  style={{
                    color: "var(--text)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {doc.title ?? doc.documentId}
                </Link>
                {doc.note && (
                  <span className="muted" style={{ fontSize: "0.84rem" }}>
                    {doc.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <LinkButton
          href={`/search?q=${encodeURIComponent(item.releaseSet ?? item.year)}`}
          variant="secondary"
          size="sm"
        >
          Search this release
        </LinkButton>
        {firstDocumentId && (
          <LinkButton
            href={`/compare?record=${encodeURIComponent(firstDocumentId)}`}
            variant="secondary"
            size="sm"
          >
            Compare representative record
          </LinkButton>
        )}
        {item.sourceExternal.map((url) => {
          const safeUrl = normalizeHttpUrl(url);
          if (!safeUrl) return null;
          return (
            <a
              key={safeUrl}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-muted)",
                fontSize: "0.84rem",
              }}
            >
              source
            </a>
          );
        })}
      </div>

      <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.84rem" }}>
        {releaseStatusDescription(item.status)}
      </p>
    </article>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        padding: "7px 11px",
        borderRadius: 999,
        border: active
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        textDecoration: "none",
        fontSize: "0.82rem",
      }}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: ReleaseExplorerStatus }) {
  const toneByStatus: Record<ReleaseExplorerStatus, BadgeTone> = {
    indexed: "high",
    pending: "low",
    timeline_only: "muted",
  };

  return (
    <Badge tone={toneByStatus[status]} size="sm">
      {releaseStatusLabel(status)}
    </Badge>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "1.18rem" }}>
        {formatNumber(value)}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.62rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function filterHref({
  year,
  status,
  topic,
}: {
  year?: string | null;
  status?: ReleaseExplorerStatus | null;
  topic?: string | null;
}): string {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (status) params.set("status", status);
  if (topic) params.set("topic", topic);
  const query = params.toString();
  return query ? `/releases?${query}` : "/releases";
}

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function one(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
