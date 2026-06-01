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
import styles from "@/components/search/search-workspace.module.css";

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
  const mediaIndexPromise = fetchMediaIndex();
  const [response, manifest] = await Promise.all([
    fetchSearch(q, mode, filters, offset),
    fetchCorpusManifest(),
  ]);
  const mediaIndex = await mediaIndexPromise.catch(() => ({ assets: [] }));
  const triage = buildSearchTriage(response.results);
  const mediaResults = searchMediaAssets(mediaIndex.assets, {
    q,
    entities: filters.entity,
    topics: filters.topic,
  });
  const groupCounts = buildSearchGroupCounts(response, mediaResults.length);
  const trimmedQuery = q.trim();

  return (
    <div className={styles.page}>
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
      <div className="container">
        <SearchHero
          q={q}
          mode={mode}
          group={group}
          total={response.total}
          manifest={manifest}
        />
      </div>

      <div className={styles.commandBand}>
        <div className={`container ${styles.commandInner}`}>
          <SearchBar autoFocus />
          <ModeTabs q={q} mode={mode} filters={filters} total={response.total} />
        </div>
      </div>

      <div className={`container ${styles.scopeWrap}`}>
        <ScopeBanner manifest={manifest} />
      </div>

      <div
        className={`container ${styles.workspace}`}
      >
          <div
            className={styles.layout}
          >
            <div className={styles.sidebarSlot}>
              <SearchSidebar>
                <div className={styles.sidebarStack}>
                  <SearchFilters filters={response.filters} />
                  <SavedSearches />
                </div>
              </SearchSidebar>
            </div>

            <div className={styles.main}>
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
                  <div className={styles.resultList}>
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
                <div className={styles.mentionList}>
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

function SearchHero({
  q,
  mode,
  group,
  total,
  manifest,
}: {
  q: string;
  mode: import("@/lib/search").SearchMode;
  group: SearchGroup;
  total: number;
  manifest: import("@/lib/api-types").CorpusManifest;
}) {
  const query = q.trim();
  const quickLinks = [
    ["Oswald", "/search?q=Oswald"],
    ["Mexico City", "/search?q=Mexico+City"],
    ["CE 399", "/search?q=CE+399"],
    ["104-10301-10004", "/search?q=104-10301-10004"],
  ] as const;

  return (
    <section className={styles.hero} aria-label="Search workspace">
      <div className={styles.heroGrid}>
        <div className={styles.heroContent}>
          <div className={styles.heroKicker}>
            <span className={styles.heroRule} />
            <span className="eyebrow">Archive search</span>
          </div>
          <h1 className={styles.heroTitle}>
            {query ? (
              <>
                Search results for <mark>{query}</mark>
              </>
            ) : (
              "Search the JFK record."
            )}
          </h1>
          <p className={styles.heroLead}>
            Use document, passage, semantic, entity, topic, media, timeline,
            and open-question lanes without losing the query or active filters.
          </p>
          <div className={styles.heroActions} aria-label="Suggested searches">
            <span className="muted">Try</span>
            {quickLinks.map(([label, href]) => (
              <Link key={href} href={href} className={styles.quickLink}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <aside className={styles.scopeCard} aria-label="Search scope">
          <div className={styles.scopeCardHeader}>
            <div className="eyebrow">Current lane</div>
            <div className={styles.scopeCardTitle}>
              {formatGroupLabel(group)} / {formatModeLabel(mode)}
            </div>
          </div>
          <dl className={styles.scopeStats}>
            <SearchStat label="Matches in lane" value={formatNumber(total)} />
            <SearchStat
              label="Indexed records"
              value={formatNumber(manifest.totalRecords)}
            />
            <SearchStat
              label="OCR passages"
              value={formatNumber(manifest.ocrPassages)}
            />
            <SearchStat
              label="Indexed releases"
              value={manifest.releasesIndexed.join(", ")}
              compact
            />
          </dl>
        </aside>
      </div>
    </section>
  );
}

function SearchStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.scopeStat} ${compact ? styles.scopeStatCompact : ""}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
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
      className={styles.groupTabs}
    >
      {groups.map((item) => {
        const active = group === item.value;
        return (
          <Link
            key={item.value}
            href={buildSearchUrl(q, mode, filters, 1, item.value)}
            aria-current={active ? "page" : undefined}
            className={`${styles.groupTab} ${active ? styles.groupTabActive : ""}`}
          >
            <span className={styles.groupTabHead}>
              <span className={styles.groupTabLabel}>
                {item.label}
              </span>
              {typeof item.count === "number" && (
                <span className="num" style={{ fontSize: "0.78rem" }}>
                  {formatNumber(item.count)}
                </span>
              )}
            </span>
            <span className={styles.groupTabDetail}>
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
      className={styles.panel}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {formatGroupLabel(group)}
      </div>
      <h2
        className={styles.panelTitle}
      >
        {group === "timeline"
          ? "Move from search into chronology."
          : "Move from search into unresolved threads."}
      </h2>
      <div className={styles.routeGrid}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={styles.routeCard}
          >
            <span className={styles.routeTitle}>
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
      className={styles.panel}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h2
        className={styles.panelTitle}
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          {emptyText}
        </p>
      ) : (
        <ol
          className={styles.facetGrid}
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {items.slice(0, 18).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={styles.facetCard}
              >
                <span className="muted num" style={{ fontSize: "0.76rem" }}>
                  {formatNumber(item.count)} matching records
                </span>
                <span className={styles.facetTitle}>
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
      className={styles.panel}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Official media
      </div>
      <div className={styles.mediaHeader}>
        <h2 className={styles.panelTitle} style={{ marginBottom: 0 }}>
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
        <div className={styles.mediaGrid}>
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
      className={styles.triage}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`surface-card ${styles.triageCard}`}
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
      className={styles.modeTabs}
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
          className={`muted ${styles.modeTotal}`}
          data-search-result-total="true"
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
      className={`${styles.modeTab} ${active ? styles.modeTabActive : ""}`}
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
      <div className={styles.emptyHeadingBlock}>
        <div
          className="eyebrow"
          style={{ marginBottom: 6 }}
        >
          Ready to search
        </div>
        <h1 className={styles.emptyTitle}>
          Search the release by person, agency, phrase, date, or record number.
        </h1>
        <div className={styles.archiveStatGrid}>
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
    <div className={styles.headingBlock}>
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
      <h1 className={styles.resultTitle}>
        Results for{" "}
        <mark>
          {q}
        </mark>
      </h1>
    </div>
  );
}

function ArchiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.archiveStat}>
      <div
        className={`num ${styles.archiveStatValue}`}
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
      className={styles.emptyPanel}
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
        className={styles.emptyAside}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Try next
        </div>
        <div className={styles.suggestionList}>
          {suggestions.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={styles.suggestionCard}
            >
              <span style={{ minWidth: 0 }}>
                <span className={styles.suggestionTitle}>
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
