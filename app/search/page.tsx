import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest, fetchSearch } from "@/lib/api-client";
import { parseSearchParams, buildSearchUrl } from "@/lib/search";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { SavedSearches } from "@/components/search/saved-searches";
import { SearchResultCard } from "@/components/search/search-result-card";
import { MentionSnippet } from "@/components/search/mention-snippet";
import { EmptyState } from "@/components/ui/empty-state";
import { ScopeBanner } from "@/components/layout/scope-banner";
import { formatNumber } from "@/lib/format";

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
  const { q, mode, filters } = parseSearchParams(params);
  const [response, manifest] = await Promise.all([
    fetchSearch(q, mode, filters),
    fetchCorpusManifest(),
  ]);

  return (
    <div>
      {/* Sticky search band */}
      <div
        style={{
          position: "sticky",
          top: 64,
          zIndex: 30,
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "saturate(1.2) blur(8px)",
          WebkitBackdropFilter: "saturate(1.2) blur(8px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="container"
          style={{
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
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
          marginTop: 32,
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
            <div
              className="search-aside"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <SearchFilters filters={response.filters} />
              <SavedSearches />
            </div>

            <div className="search-main">
              <ResultHeading q={q} mode={mode} total={response.total} />

              {response.total === 0 ? (
                <EmptyState
                  title="No matching records."
                  description={
                    q
                      ? "Try broadening the phrase, dropping punctuation, or switching between the Documents and Mentions modes."
                      : "Enter a term, a name, an agency, or a phrase to begin searching the collection."
                  }
                  action={
                    !q ? (
                      <Link
                        href="/search?q=Oswald&mode=document"
                        style={{ marginTop: 8 }}
                      >
                        Try: <strong>Oswald</strong>
                      </Link>
                    ) : null
                  }
                />
              ) : mode === "document" ? (
                <div>
                  {response.results.map((r) =>
                    r.kind === "document" ? (
                      <SearchResultCard
                        key={r.document.id}
                        document={r.document}
                        mentionCount={r.mentionCount}
                        confidence={r.confidence}
                        query={q}
                      />
                    ) : null,
                  )}
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 22 }}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inline layout styles: grid becomes two columns at ≥920px */}
      <style>{`
        @media (min-width: 920px) {
          .search-layout {
            grid-template-columns: 260px minmax(0, 1fr) !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </div>
  );
}

function ModeTabs({
  q,
  mode,
  filters,
  total,
}: {
  q: string;
  mode: "document" | "mention";
  filters: import("@/lib/search").ParsedSearch["filters"];
  total: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Search mode"
      style={{ display: "flex", gap: 4, alignItems: "center" }}
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
      {q && (
        <span
          className="muted"
          style={{ marginLeft: "auto", fontSize: "0.82rem" }}
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
        borderRadius: 999,
        fontSize: "0.88rem",
        color: active ? "var(--text)" : "var(--text-muted)",
        border: "1px solid",
        borderColor: active ? "var(--border-strong)" : "transparent",
        background: active ? "var(--surface)" : "transparent",
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
}: {
  q: string;
  mode: "document" | "mention";
  total: number;
}) {
  if (!q) {
    return (
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 16,
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
            letterSpacing: "-0.01em",
          }}
        >
          The archive is keyword-searchable across {formatNumber(14302)} records
          and {formatNumber(186421)} indexed passages.
        </h1>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 20,
        paddingBottom: 12,
      }}
    >
      <div
        className="eyebrow"
        style={{ marginBottom: 6 }}
      >
        {mode === "document" ? "Document matches" : "Mention matches"} · {formatNumber(total)}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.6rem",
          letterSpacing: "-0.01em",
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
