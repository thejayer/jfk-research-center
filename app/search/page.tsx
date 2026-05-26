import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest, fetchMediaIndex, fetchSearch } from "@/lib/api-client";
import {
  parseSearchParams,
  buildSearchUrl,
  SEARCH_PAGE_SIZE,
} from "@/lib/search";
import type { MediaAsset } from "@/lib/api-types";
import { searchMediaAssets } from "@/lib/media-assets";
import type { SearchGroup } from "@/lib/constants";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { SavedSearches } from "@/components/search/saved-searches";
import { SearchSidebar } from "@/components/search/search-sidebar";
import { SearchResultCard } from "@/components/search/search-result-card";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { ActiveTopicChip } from "@/components/search/active-topic-chip";
import { PaginationControls } from "@/components/search/pagination-controls";
import { ScopeBanner } from "@/components/layout/scope-banner";
import { formatNumber } from "@/lib/format";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { MediaAssetCard } from "@/components/media/media-asset-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Full-text search across the JFK archival collection, across record titles, descriptions, and OCR passages.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { q, mode, group, filters, page } = parseSearchParams(params);
  // Semantic mode is top-k-capped by Vertex VECTOR_SEARCH; offset ignored.
  const offset = mode === "semantic" ? 0 : (page - 1) * SEARCH_PAGE_SIZE;
  const returnHref = buildSearchUrl(q, mode, filters, page, group);
  const [response, manifest, mediaIndex] = await Promise.all([
    fetchSearch(q, mode, filters, offset),
    fetchCorpusManifest(),
    fetchMediaIndex(),
  ]);
  const triage = buildSearchTriage(response.results);
  const mediaResults = searchMediaAssets(mediaIndex.assets, {
    q,
    entities: filters.entity,
    topics: filters.topic,
  });
  const groupCounts = buildSearchGroupCounts(response, mediaResults.length);
  const trimmedQuery = q.trim();

  return (
    <div>
      {trimmedQuery && (
        <ResearchHistoryTracker
          item={{
            type: "search",
            sourceId: `${mode}:${group}:${trimmedQuery}`,
            title: `Search: ${trimmedQuery}`,
            href: returnHref,
            context:
              group === "results"
                ? `${formatModeLabel(mode)} results`
                : `${formatGroupLabel(group)} research lane`,
          }}
        />
      )}
      {/* Sticky search band */}
      <div
        style={{
          position: "sticky",
          top: "var(--header-height)",
          zIndex: 30,
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "saturate(1.15) blur(10px)",
          WebkitBackdropFilter: "saturate(1.15) blur(10px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sticky-band)",
        }}
      >
        <div
          className="container"
          style={{
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <SearchBar autoFocus />
          <ModeTabs q={q} mode={mode} filters={filters} total={response.total} />
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16 }}>
        <ScopeBanner manifest={manifest} />
      </div>

      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 32,
          marginTop: 28,
          marginBottom: 80,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 28,
            }}
            className="search-layout"
          >
            <div className="search-aside">
              <SearchSidebar>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 18,
                  }}
                >
                  <SearchFilters filters={response.filters} />
                  <SavedSearches />
                </div>
              </SearchSidebar>
            </div>

            <div className="search-main">
              <ActiveTopicChip topicLabels={response.filters.topicLabels} />
              <ResultHeading q={q} mode={mode} total={response.total} manifest={manifest} />
              {(q || hasSelectedFilters(filters)) && (
                <SearchGroupTabs
                  q={q}
                  mode={mode}
                  group={group}
                  filters={filters}
                  counts={groupCounts}
                />
              )}
              {response.total > 0 && mode === "document" && (
                <SearchTriageStrip triage={triage} />
              )}

              {group !== "results" ? (
                <SearchGroupedPanel
                  q={q}
                  group={group}
                  mode={mode}
                  filters={filters}
                  searchFilters={response.filters}
                  mediaResults={mediaResults}
                />
              ) : response.total === 0 ? (
                <SearchEmptyPanel
                  q={q}
                  mode={mode}
                  filters={filters}
                  topicLabels={response.filters.topicLabels}
                  entityLabels={response.filters.entityLabels}
                />
              ) : mode === "document" ? (
                <div>
                  <div style={{ display: "grid", gap: 14 }}>
                    {response.results.map((r) =>
                      r.kind === "document" ? (
                        <SearchResultCard
                          key={r.document.id}
                          document={r.document}
                          mentionCount={r.mentionCount}
                          confidence={r.confidence}
                          query={q}
                          returnHref={returnHref}
                        />
                      ) : null,
                    )}
                  </div>
                  {q && (
                    <PaginationControls
                      q={q}
                      mode={mode}
                      filters={filters}
                      page={page}
                      pageSize={SEARCH_PAGE_SIZE}
                      total={response.total}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  {response.results.map((r) =>
                    r.kind === "mention" ? (
                      <MentionSnippet
                        key={r.mention.id}
                        mention={r.mention}
                        query={q}
                      />
                    ) : null,
                  )}
                  {q && mode === "mention" && (
                    <PaginationControls
                      q={q}
                      mode={mode}
                      filters={filters}
                      page={page}
                      pageSize={SEARCH_PAGE_SIZE}
                      total={response.total}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inline layout styles: grid becomes two columns at >=920px */}
      <style>{`
        @media (min-width: 920px) {
          .search-layout {
            grid-template-columns: 280px minmax(0, 1fr) !important;
            gap: 36px !important;
            align-items: start;
          }
          .search-aside {
            position: sticky;
            top: calc(var(--header-height) + 104px);
          }
        }
        @media (max-width: 540px) {
          [data-search-result-total="true"] {
            flex-basis: 100%;
            margin-left: 0 !important;
            padding-top: 4px !important;
          }
        }
      `}</style>
    </div>
  );
}

function buildSearchTriage(
  results: import("@/lib/api-types").SearchResult[],
) {
  const documentResults = results.filter((result) => result.kind === "document");
  const agencyCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  let ocrCount = 0;
  let highConfidenceCount = 0;

  for (const result of documentResults) {
    const doc = result.document;
    if (doc.agency) agencyCounts.set(doc.agency, (agencyCounts.get(doc.agency) ?? 0) + 1);
    const year = doc.date?.slice(0, 4) ?? doc.dateLabel?.match(/\d{4}/)?.[0];
    if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    if (doc.hasOcr) ocrCount += 1;
    if (result.confidence === "high") highConfidenceCount += 1;
  }

  return {
    agencies: Array.from(agencyCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
    years: Array.from(yearCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
    ocrCount,
    highConfidenceCount,
    visibleCount: documentResults.length,
  };
}

function buildSearchGroupCounts(
  response: import("@/lib/api-types").SearchResponse,
  mediaCount: number,
) {
  return {
    results: response.total,
    entities: Object.keys(response.filters.entityCounts).length,
    topics: Object.keys(response.filters.topicCounts).length,
    media: mediaCount,
  };
}

function SearchGroupTabs({
  q,
  mode,
  group,
  filters,
  counts,
}: {
  q: string;
  mode: import("@/lib/search").SearchMode;
  group: SearchGroup;
  filters: import("@/lib/search").ParsedSearch["filters"];
  counts: ReturnType<typeof buildSearchGroupCounts>;
}) {
  const groups: Array<{
    value: SearchGroup;
    label: string;
    count?: number;
    detail: string;
  }> = [
    {
      value: "results",
      label: "Results",
      count: counts.results,
      detail: "Current document, mention, or semantic mode",
    },
    {
      value: "entities",
      label: "Entities",
      count: counts.entities,
      detail: "People, agencies, places, and concepts",
    },
    {
      value: "topics",
      label: "Topics",
      count: counts.topics,
      detail: "Curated subject lanes",
    },
    {
      value: "media",
      label: "Media",
      count: counts.media,
      detail: "Official JFK Library records",
    },
    {
      value: "timeline",
      label: "Timeline",
      detail: "Chronology routes for this query",
    },
    {
      value: "questions",
      label: "Questions",
      detail: "Open-question routes",
    },
  ];

  return (
    <nav
      aria-label="Search result groups"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {groups.map((item) => {
        const active = group === item.value;
        return (
          <Link
            key={item.value}
            href={buildSearchUrl(q, mode, filters, 1, item.value)}
            aria-current={active ? "page" : undefined}
            style={{
              border: "1px solid",
              borderColor: active ? "var(--text)" : "var(--border)",
              borderRadius: "var(--radius-md)",
              background: active ? "var(--text)" : "var(--surface)",
              color: active ? "var(--bg)" : "var(--text)",
              padding: "10px 12px",
              textDecoration: "none",
              minHeight: 76,
              display: "grid",
              gap: 4,
            }}
          >
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "baseline",
              }}
            >
              <span style={{ fontWeight: 650, fontSize: "0.9rem" }}>
                {item.label}
              </span>
              {typeof item.count === "number" && (
                <span className="num" style={{ fontSize: "0.78rem" }}>
                  {formatNumber(item.count)}
                </span>
              )}
            </span>
            <span
              style={{
                color: active ? "color-mix(in srgb, var(--bg) 72%, transparent)" : "var(--text-muted)",
                fontSize: "0.74rem",
                lineHeight: 1.35,
              }}
            >
              {item.detail}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SearchGroupedPanel({
  q,
  group,
  mode,
  filters,
  searchFilters,
  mediaResults,
}: {
  q: string;
  group: SearchGroup;
  mode: import("@/lib/search").SearchMode;
  filters: import("@/lib/search").ParsedSearch["filters"];
  searchFilters: import("@/lib/api-types").SearchFilters;
  mediaResults: MediaAsset[];
}) {
  if (group === "entities") {
    const entities = rankFacetItems(
      searchFilters.entities,
      searchFilters.entityLabels,
      searchFilters.entityCounts,
    );
    return (
      <FacetGroupPanel
        eyebrow="Entity matches"
        title="People, agencies, places, and concepts tied to this search"
        emptyText="No entity facets are available for this query yet."
        items={entities.map((item) => ({
          ...item,
          href: `/entity/${encodeURIComponent(item.id)}`,
          action: "Open entity",
        }))}
      />
    );
  }

  if (group === "topics") {
    const topics = rankFacetItems(
      searchFilters.topics,
      searchFilters.topicLabels,
      searchFilters.topicCounts,
    );
    return (
      <FacetGroupPanel
        eyebrow="Topic matches"
        title="Curated topic lanes connected to this search"
        emptyText="No topic facets are available for this query yet."
        items={topics.map((item) => ({
          ...item,
          href: `/topic/${encodeURIComponent(item.id)}`,
          action: "Open topic",
        }))}
      />
    );
  }

  if (group === "media") {
    return <MediaGroupPanel q={q} mediaResults={mediaResults} />;
  }

  const query = q.trim();
  const cards =
    group === "timeline"
      ? [
          {
            href: `/timeline?view=list`,
            title: "Open the full case timeline",
            detail: "Use the list view to scan chronology, categories, and source anchors.",
          },
          {
            href: `/timeline?view=dallas`,
            title: "Read the Dallas weekend sequence",
            detail: "Focus on the compact Nov. 22-25 chronology.",
          },
          {
            href: buildSearchUrl(query, "mention", filters),
            title: query ? `Find OCR mentions of ${query}` : "Find OCR mentions",
            detail: "Use source passages as the bridge back into chronology.",
          },
        ]
      : [
          {
            href: "/open-questions",
            title: "Browse open questions",
            detail: "Review unresolved threads, tensions, and supporting records.",
          },
          {
            href: buildSearchUrl(query, "semantic", filters),
            title: query
              ? `Find semantically related records for ${query}`
              : "Find semantically related records",
            detail: "Use semantic mode when exact words are not enough.",
          },
          {
            href: "/established-facts",
            title: "Balance against established facts",
            detail: "Read settled findings alongside open threads.",
          },
        ];

  return (
    <section
      aria-label={`${formatGroupLabel(group)} search routes`}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 20,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {formatGroupLabel(group)}
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.45rem",
          letterSpacing: 0,
          marginBottom: 14,
        }}
      >
        {group === "timeline"
          ? "Move from search into chronology."
          : "Move from search into unresolved threads."}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 10,
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "14px 16px",
              color: "var(--text)",
              textDecoration: "none",
              display: "grid",
              gap: 7,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.08rem",
                lineHeight: 1.25,
                letterSpacing: 0,
              }}
            >
              {card.title}
            </span>
            <span className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
              {card.detail}
            </span>
          </Link>
        ))}
      </div>
      {mode !== "document" && (
        <p className="muted" style={{ marginTop: 14, fontSize: "0.82rem" }}>
          This lane keeps your query and filters shareable while pointing to the
          research surface that best fits the selected object type.
        </p>
      )}
    </section>
  );
}

function FacetGroupPanel({
  eyebrow,
  title,
  emptyText,
  items,
}: {
  eyebrow: string;
  title: string;
  emptyText: string;
  items: Array<{
    id: string;
    label: string;
    count: number;
    href: string;
    action: string;
  }>;
}) {
  return (
    <section
      aria-label={eyebrow}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 20,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.45rem",
          letterSpacing: 0,
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          {emptyText}
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 10,
          }}
        >
          {items.slice(0, 18).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                style={{
                  minHeight: 118,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "13px 14px",
                  color: "var(--text)",
                  textDecoration: "none",
                  display: "grid",
                  gridTemplateRows: "auto 1fr auto",
                  gap: 8,
                }}
              >
                <span className="muted num" style={{ fontSize: "0.76rem" }}>
                  {formatNumber(item.count)} matching records
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.08rem",
                    lineHeight: 1.25,
                    letterSpacing: 0,
                  }}
                >
                  {item.label}
                </span>
                <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  {item.action}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MediaGroupPanel({
  q,
  mediaResults,
}: {
  q: string;
  mediaResults: MediaAsset[];
}) {
  const query = q.trim();

  return (
    <section
      aria-label="Official media search results"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 20,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Official media
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.45rem",
            letterSpacing: 0,
          }}
        >
          {query
            ? `JFK Library media matching ${query}`
            : "JFK Library media matching current filters"}
        </h2>
        <Link
          href={query ? `/media?q=${encodeURIComponent(query)}` : "/media"}
          style={{ color: "var(--link)", fontSize: "0.9rem", fontWeight: 650 }}
        >
          Open media explorer
        </Link>
      </div>
      {mediaResults.length === 0 ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          No official media records match this query and filter combination yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: 14,
          }}
        >
          {mediaResults.slice(0, 18).map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} compact />
          ))}
        </div>
      )}
    </section>
  );
}

function rankFacetItems(
  values: string[],
  labels: Record<string, string>,
  counts: Record<string, number>,
) {
  const ids = Array.from(new Set([...values, ...Object.keys(counts)]));
  return ids
    .map((id) => ({
      id,
      label: labels[id] ?? id,
      count: counts[id] ?? 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function formatModeLabel(mode: import("@/lib/search").SearchMode): string {
  return mode === "document"
    ? "Document"
    : mode === "mention"
      ? "Mention"
      : "Semantic";
}

function formatGroupLabel(group: SearchGroup): string {
  switch (group) {
    case "results":
      return "Results";
    case "entities":
      return "Entities";
    case "topics":
      return "Topics";
    case "media":
      return "Media";
    case "timeline":
      return "Timeline";
    case "questions":
      return "Open questions";
  }
}

function SearchTriageStrip({
  triage,
}: {
  triage: ReturnType<typeof buildSearchTriage>;
}) {
  const items = [
    {
      label: "Visible OCR",
      value: `${triage.ocrCount}/${triage.visibleCount}`,
    },
    {
      label: "High confidence",
      value: `${triage.highConfidenceCount}`,
    },
    {
      label: "Top agencies",
      value:
        triage.agencies.length > 0
          ? triage.agencies.map(([agency, count]) => `${agency} ${count}`).join(" / ")
          : "Mixed",
    },
    {
      label: "Dense years",
      value:
        triage.years.length > 0
          ? triage.years.map(([year, count]) => `${year} ${count}`).join(" / ")
          : "Undated",
    },
  ];

  return (
    <section
      aria-label="Search result triage"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="surface-card"
          style={{
            padding: "10px 12px",
          }}
        >
          <div className="eyebrow" style={{ fontSize: "0.62rem", marginBottom: 4 }}>
            {item.label}
          </div>
          <div className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.35 }}>
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
}

function ModeTabs({
  q,
  mode,
  filters,
  total,
}: {
  q: string;
  mode: "document" | "mention" | "semantic";
  filters: import("@/lib/search").ParsedSearch["filters"];
  total: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Search mode"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
        padding: 4,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-2)",
        width: "100%",
      }}
    >
      <TabLink
        label="Documents"
        active={mode === "document"}
        href={buildSearchUrl(q, "document", filters)}
      />
      <TabLink
        label="Mentions"
        active={mode === "mention"}
        href={buildSearchUrl(q, "mention", filters)}
      />
      <TabLink
        label="Semantic"
        active={mode === "semantic"}
        href={buildSearchUrl(q, "semantic", filters)}
      />
      {q && (
        <span
          className="muted"
          data-search-result-total="true"
          style={{
            marginLeft: "auto",
            padding: "0 10px",
            fontSize: "0.82rem",
            whiteSpace: "nowrap",
          }}
        >
          {formatNumber(total)} results
        </span>
      )}
    </div>
  );
}

function TabLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        fontSize: "0.88rem",
        color: active ? "var(--bg)" : "var(--text-muted)",
        border: "1px solid",
        borderColor: active ? "var(--text)" : "transparent",
        background: active ? "var(--text)" : "transparent",
        transition: "background var(--motion), color var(--motion), border-color var(--motion)",
      }}
    >
      {label}
    </Link>
  );
}

function ResultHeading({
  q,
  mode,
  total,
  manifest,
}: {
  q: string;
  mode: "document" | "mention" | "semantic";
  total: number;
  manifest: import("@/lib/api-types").CorpusManifest;
}) {
  if (!q) {
    return (
      <div
        style={{
          marginBottom: 24,
          padding: "22px 0 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="eyebrow"
          style={{ marginBottom: 6 }}
        >
          Ready to search
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.7rem",
            letterSpacing: 0,
            lineHeight: 1.2,
            maxWidth: "22ch",
          }}
        >
          Search the release by person, agency, phrase, date, or record number.
        </h1>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 18,
            maxWidth: 680,
          }}
        >
          <ArchiveStat label="OCR records" value={manifest.recordsWithOcr} />
          <ArchiveStat label="OCR passages" value={manifest.ocrPassages} />
          <ArchiveStat
            label="Metadata records"
            value={manifest.totalRecords - manifest.recordsWithOcr}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 18,
        paddingBottom: 4,
      }}
    >
      <div
        className="eyebrow"
        style={{ marginBottom: 6 }}
      >
        {mode === "document"
          ? "Document matches"
          : mode === "semantic"
            ? "Semantic matches"
            : "Mention matches"}{" "}
        | {formatNumber(total)}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.6rem",
          letterSpacing: 0,
          lineHeight: 1.2,
        }}
      >
        Results for{" "}
        <span
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            padding: "0 6px",
            borderRadius: 4,
          }}
        >
          {q}
        </span>
      </h1>
    </div>
  );
}

function ArchiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        borderLeft: "2px solid var(--accent)",
        paddingLeft: 12,
      }}
    >
      <div
        className="num"
        style={{
          color: "var(--text)",
          fontSize: "1.05rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(value)}
      </div>
      <div
        className="eyebrow"
        style={{ color: "var(--text-muted)", fontSize: "0.66rem" }}
      >
        {label}
      </div>
    </div>
  );
}

function SearchEmptyPanel({
  q,
  mode,
  filters,
  topicLabels,
  entityLabels,
}: {
  q: string;
  mode: "document" | "mention" | "semantic";
  filters: import("@/lib/search").ParsedSearch["filters"];
  topicLabels: Record<string, string>;
  entityLabels: Record<string, string>;
}) {
  const hasFilters = hasSelectedFilters(filters);
  const trimmedQuery = q.trim();
  const suggestions = buildEmptySuggestions({
    q: trimmedQuery,
    mode,
    filters,
    topicLabels,
    entityLabels,
  });

  return (
    <section
      aria-label="No search results"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.95fr) minmax(260px, 0.7fr)",
        gap: 22,
        alignItems: "stretch",
        padding: 24,
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          No matches
        </div>
        <h2
          style={{
            fontSize: "clamp(1.45rem, 1.2rem + 0.8vw, 2rem)",
            letterSpacing: 0,
            marginBottom: 10,
          }}
        >
          {trimmedQuery
            ? "No records matched this search."
            : "Start with a name, agency, phrase, or NAID."}
        </h2>
        <p
          className="muted"
          style={{
            maxWidth: "62ch",
            fontSize: "0.95rem",
            lineHeight: 1.6,
          }}
        >
          {trimmedQuery
            ? "Try a broader term, switch search modes, or remove filters. Names and agencies often appear in OCR passages even when the document title does not match."
            : "Search across document titles, archival descriptions, OCR passages, and semantic matches from the same place."}
        </p>

        {hasFilters && (
          <Link
            href={buildSearchUrl(trimmedQuery, mode)}
            style={{
              display: "inline-flex",
              marginTop: 16,
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            Clear filters
          </Link>
        )}
      </div>

      <aside
        aria-label="Suggested searches"
        style={{
          borderLeft: "1px solid var(--border)",
          paddingLeft: 22,
          minWidth: 0,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Try next
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "11px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-serif)",
                    fontSize: "1rem",
                    lineHeight: 1.25,
                    letterSpacing: 0,
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="muted"
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: "0.78rem",
                    lineHeight: 1.35,
                  }}
                >
                  {item.detail}
                </span>
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      </aside>

      <style>{`
        @media (max-width: 780px) {
          [aria-label="No search results"] {
            grid-template-columns: 1fr !important;
          }
          [aria-label="Suggested searches"] {
            border-left: 0 !important;
            border-top: 1px solid var(--border);
            padding-left: 0 !important;
            padding-top: 18px;
          }
        }
      `}</style>
    </section>
  );
}

function buildEmptySuggestions({
  q,
  mode,
  filters,
  topicLabels,
  entityLabels,
}: {
  q: string;
  mode: "document" | "mention" | "semantic";
  filters: import("@/lib/search").ParsedSearch["filters"];
  topicLabels: Record<string, string>;
  entityLabels: Record<string, string>;
}) {
  const fallbackQuery = q || "Oswald";
  const queryWithoutPunctuation = fallbackQuery
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const selectedTopic = filters.topic[0];
  const selectedEntity = filters.entity[0];

  return [
    {
      label: mode === "semantic" ? "Use document search" : "Try semantic search",
      detail:
        mode === "semantic"
          ? "Look for exact title and description matches."
          : "Find related OCR passages even without exact words.",
      href: buildSearchUrl(
        fallbackQuery,
        mode === "semantic" ? "document" : "semantic",
        filters,
      ),
    },
    {
      label: "Search mentions",
      detail: "Jump straight to OCR passages and entity hits.",
      href: buildSearchUrl(fallbackQuery, "mention", filters),
    },
    {
      label: "Search official media",
      detail: "Check rights-aware JFK Library media records.",
      href: buildSearchUrl(fallbackQuery, "document", filters, 1, "media"),
    },
    {
      label: "Broaden the query",
      detail: queryWithoutPunctuation
        ? `Search for ${queryWithoutPunctuation}.`
        : "Remove punctuation and quote marks.",
      href: buildSearchUrl(queryWithoutPunctuation || fallbackQuery, "document"),
    },
    selectedTopic
      ? {
          label: `Open ${topicLabels[selectedTopic] ?? "topic dossier"}`,
          detail: "Browse the topic lane instead of searching inside it.",
          href: `/topic/${encodeURIComponent(selectedTopic)}`,
        }
      : {
          label: "Browse topic dossiers",
          detail: "Use curated lanes for agencies, investigations, and evidence.",
          href: "/topics",
        },
    selectedEntity
      ? {
          label: `Open ${entityLabels[selectedEntity] ?? "entity dossier"}`,
          detail: "Review records connected to the selected entity.",
          href: `/entity/${encodeURIComponent(selectedEntity)}`,
        }
      : {
          label: "Browse entities",
          detail: "Start from people, organizations, places, and concepts.",
          href: "/entities",
        },
  ].slice(0, 5);
}

function hasSelectedFilters(filters: import("@/lib/search").ParsedSearch["filters"]) {
  return (
    filters.agency.length > 0 ||
    filters.entity.length > 0 ||
    filters.topic.length > 0 ||
    filters.confidence.length > 0 ||
    filters.yearFrom !== null ||
    filters.yearTo !== null
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <path
        d="M3 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m8.75 4.25 3.75 3.75-3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
