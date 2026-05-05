import type { Metadata } from "next";
import Link from "next/link";
import { fetchBibliographyIndex } from "@/lib/api-client";
import type { CitationEntry, CitationType } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bibliography",
  description:
    "Allowlisted citation registry for primary-source and reference works the site draws from, with Bluebook, Chicago, and APA formats for each.",
};

const TYPE_LABEL: Record<CitationType, string> = {
  WC: "Warren Commission",
  HSCA: "HSCA",
  ARRB: "ARRB",
  CHURCH: "Church Committee",
  REPORT: "Government reports",
  NARA: "NARA finding aids",
  BOOK: "Books",
  JOURNAL: "Journals",
  NEWS: "News",
  NAID: "NARA records",
};

const TYPE_DESCRIPTION: Record<CitationType, string> = {
  WC: "Commission report, hearings, exhibits, and associated official record material.",
  HSCA: "House Select Committee reports and technical review records.",
  ARRB: "Assassination Records Review Board reports and release documentation.",
  CHURCH: "Senate intelligence investigation materials relevant to the archive.",
  REPORT: "Government reports used as reference or contextual source material.",
  NARA: "National Archives finding aids, collection guides, and release notices.",
  BOOK: "Allowlisted books used for context, never as a substitute for records.",
  JOURNAL: "Scholarly journal material that supports source interpretation.",
  NEWS: "News references used for release context and public-record chronology.",
  NAID: "NARA record entries and direct archival identifiers.",
};

const PRIMARY_SOURCE_TYPES: CitationType[] = [
  "WC",
  "HSCA",
  "ARRB",
  "CHURCH",
  "REPORT",
  "NARA",
  "NAID",
];

const TYPE_ORDER: CitationType[] = [
  "WC",
  "HSCA",
  "ARRB",
  "CHURCH",
  "REPORT",
  "NARA",
  "NAID",
  "BOOK",
  "JOURNAL",
  "NEWS",
];

function typeAnchor(type: CitationType): string {
  return `type-${type}`;
}

function isPrimaryType(type: CitationType): boolean {
  return PRIMARY_SOURCE_TYPES.includes(type);
}

export default async function BibliographyPage() {
  const data = await fetchBibliographyIndex();
  const totalEntries = data.citations.length;
  const primarySourceEntries = data.countsByType
    .filter((c) => isPrimaryType(c.type))
    .reduce((sum, c) => sum + c.count, 0);
  const referenceEntries = totalEntries - primarySourceEntries;
  const linkedEntries = data.citations.filter((c) => c.url).length;
  const yearValues = data.citations
    .map((c) => c.year)
    .filter((year): year is number => typeof year === "number");
  const yearRange =
    yearValues.length > 0
      ? `${Math.min(...yearValues)}-${Math.max(...yearValues)}`
      : "Unspecified";

  const byType = new Map<CitationType, CitationEntry[]>();
  for (const citation of data.citations) {
    const list = byType.get(citation.type) ?? [];
    list.push(citation);
    byType.set(citation.type, list);
  }

  const orderedCounts = TYPE_ORDER.map((type) => ({
    type,
    count: data.countsByType.find((c) => c.type === type)?.count ?? 0,
  })).filter((c) => c.count > 0);

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
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
        <span style={{ color: "var(--text)" }}>Bibliography</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 40,
          paddingBottom: 34,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Source registry
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Allowlisted citations
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
            The bibliography is the trust layer behind documents, established
            facts, topics, and entity pages.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 18 }}
          >
            Each entry carries Bluebook, Chicago, and APA formats. Primary
            records and official release material are separated from reference
            works so readers can see what is archival evidence and what is
            interpretive context.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <LinkButton href="#type-WC" size="sm">
              Start with Commission records
            </LinkButton>
            <LinkButton href="/about/editorial-policy" variant="secondary" size="sm">
              Editorial policy
            </LinkButton>
          </div>
        </div>

        <aside
          aria-label="Bibliography profile"
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
            Citation profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["Entries", totalEntries],
              ["Types", orderedCounts.length],
              ["Linked", linkedEntries],
              ["Years", yearRange],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 6px",
                  textAlign: "center",
                }}
              >
                <div className="num" style={{ fontSize: "1.06rem" }}>
                  {typeof value === "number" ? formatNumber(value) : value}
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
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Deep links highlight the exact citation, so source chips elsewhere
            in the site land on the entry they cite.
          </p>
        </aside>
      </header>

      <section
        aria-label="Source mix"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12,
          marginTop: 26,
          marginBottom: 30,
        }}
      >
        <SourceMixCard
          title="Primary-source spine"
          count={primarySourceEntries}
          description="Official investigative, archival, and release records that carry the evidentiary weight."
        />
        <SourceMixCard
          title="Reference context"
          count={referenceEntries}
          description="Allowlisted secondary material used to frame chronology, release history, and interpretation."
        />
      </section>

      <nav
        aria-label="Citation source types"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
          marginBottom: 42,
        }}
      >
        {orderedCounts.map((c) => (
          <a
            key={c.type}
            href={`#${typeAnchor(c.type)}`}
            style={{
              display: "grid",
              gap: 8,
              padding: "12px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              fontSize: "0.84rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>{TYPE_LABEL[c.type] ?? c.type}</span>
              <span className="muted num">{c.count}</span>
            </span>
            <span className="muted" style={{ fontSize: "0.76rem", lineHeight: 1.4 }}>
              {isPrimaryType(c.type) ? "Primary source" : "Reference source"}
            </span>
          </a>
        ))}
      </nav>

      {orderedCounts.map((t) => {
        const list = byType.get(t.type) ?? [];
        return (
          <section
            key={t.type}
            id={typeAnchor(t.type)}
            style={{
              marginBottom: 52,
              scrollMarginTop: "calc(var(--header-height) + 20px)",
            }}
          >
            <SectionHeading
              eyebrow={isPrimaryType(t.type) ? "Primary source" : "Reference source"}
              title={`${TYPE_LABEL[t.type] ?? t.type} citations`}
              description={TYPE_DESCRIPTION[t.type]}
            />
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {list.map((citation, index) => (
                <CitationCard
                  key={citation.id}
                  citation={citation}
                  index={index + 1}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function SourceMixCard({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "16px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 14,
        alignItems: "start",
      }}
    >
      <span
        className="num"
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
        }}
      >
        {formatNumber(count)}
      </span>
      <div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.12rem",
            lineHeight: 1.25,
            marginBottom: 5,
          }}
        >
          {title}
        </div>
        <p className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function CitationCard({
  citation,
  index,
}: {
  citation: CitationEntry;
  index: number;
}) {
  return (
    <li
      id={citation.id}
      className="bibliography-entry"
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 16,
        padding: "18px 20px 18px 18px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        scrollMarginTop: "calc(var(--header-height) + 20px)",
      }}
    >
      <div
        aria-hidden
        className="num"
        style={{
          width: 34,
          height: 34,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          color: "var(--text-muted)",
          fontSize: "0.82rem",
        }}
      >
        {String(index).padStart(2, "0")}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Badge tone="muted" size="sm">
            {TYPE_LABEL[citation.type] ?? citation.type}
          </Badge>
          <span
            className="muted"
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {citation.year ?? "Undated"}
          </span>
          {citation.publisher && (
            <span
              className="muted"
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {citation.publisher}
            </span>
          )}
        </div>

        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.08rem, 1rem + 0.25vw, 1.22rem)",
            lineHeight: 1.35,
            letterSpacing: 0,
            marginBottom: 8,
          }}
        >
          {citation.url ? (
            <a href={citation.url} target="_blank" rel="noopener noreferrer">
              {citation.title}
            </a>
          ) : (
            citation.title
          )}
        </div>

        {citation.author && (
          <p
            className="muted"
            style={{ fontSize: "0.86rem", lineHeight: 1.5, marginBottom: 12 }}
          >
            {citation.author}
          </p>
        )}

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(80px, auto) minmax(0, 1fr)",
            columnGap: 12,
            rowGap: 7,
            margin: 0,
            fontSize: "0.82rem",
            lineHeight: 1.5,
          }}
        >
          <CitationFormat label="Bluebook">{citation.bluebook}</CitationFormat>
          <CitationFormat label="Chicago">{citation.chicago}</CitationFormat>
          <CitationFormat label="APA">{citation.apa}</CitationFormat>
        </dl>
      </div>
    </li>
  );
}

function CitationFormat({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <>
      <dt
        className="muted num"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, color: "var(--text)" }}>{children}</dd>
    </>
  );
}
