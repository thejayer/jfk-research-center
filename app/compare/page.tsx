import type { Metadata } from "next";
import Link from "next/link";
import type { CompareReleaseVersion } from "@/lib/api-types";
import { fetchCompare } from "@/lib/api-client";
import { RECORD_ID_RE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const DEFAULT_RECORD_ID = "oswald-201-file-vol1";

export const metadata: Metadata = {
  title: "Compare Releases",
  description:
    "Foundation view for comparing JFK record versions across public release sets.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const recordId = parseRecordId(resolvedSearchParams.record) ?? DEFAULT_RECORD_ID;
  const data = await fetchCompare(recordId);

  return (
    <div className="container" style={{ paddingTop: "var(--space-10xl)", paddingBottom: "var(--space-page-bottom)" }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          marginBottom: "var(--space-6xl)",
          color: "var(--text-muted)",
          fontSize: "var(--font-size-caption)",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>Home</Link>
        <span aria-hidden style={{ margin: "0 var(--space-sm)" }}>/</span>
        <span style={{ color: "var(--text)" }}>Compare releases</span>
      </nav>

      <header style={{ maxWidth: "72ch", marginBottom: "var(--space-8xl)" }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Release comparison
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--font-size-page-title)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--line-tight)",
            marginTop: "var(--space-md)",
            marginBottom: "var(--space-3xl)",
          }}
        >
          Compare record versions across releases
        </h1>
        <p className="muted" style={{ fontSize: "var(--font-size-lead)", lineHeight: "var(--line-loose)" }}>
          This foundation view models the contract for per-release comparison:
          canonical record key, release versions, OCR readiness, and the caveats
          that must be resolved before a visual redaction diff can be treated as
          evidence.
        </p>
      </header>

      {!data ? (
        <EmptyState
          title="No comparison fixture for this record"
          description={
            <>
              Try the mock record{" "}
              <Link href={`/compare?record=${DEFAULT_RECORD_ID}`}>
                {DEFAULT_RECORD_ID}
              </Link>
              . Live warehouse-backed comparison is blocked until per-release
              OCR and source-file provenance are available.
            </>
          }
          action={
            <LinkButton href="/search" variant="secondary" size="sm">
              Browse records
            </LinkButton>
          }
        />
      ) : (
        <>
          <section
            aria-label="Compared record"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: "var(--space-3xl)",
              marginBottom: "var(--space-7xl)",
            }}
          >
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                padding: "var(--space-5xl) var(--space-6xl)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: "var(--space-md)" }}>
                {data.canonicalKey.label} {data.canonicalKey.value}
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--font-size-record-title)",
                  letterSpacing: "var(--tracking-subtle)",
                  lineHeight: "var(--line-title)",
                  marginBottom: "var(--space-lg)",
                }}
              >
                {data.record.title}
              </h2>
              <p className="muted" style={{ lineHeight: "var(--line-relaxed)", maxWidth: "78ch" }}>
                {data.record.snippet ?? data.record.subtitle}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-md)",
                  marginTop: "var(--space-3xl)",
                }}
              >
                {data.record.agency && <Badge tone="muted">{data.record.agency}</Badge>}
                {data.record.documentType && (
                  <Badge tone="muted">{data.record.documentType}</Badge>
                )}
                <Badge tone="accent">{data.versions.length} versions</Badge>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "var(--space-xl)",
              }}
            >
              {data.metrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    padding: "var(--space-3xl) var(--space-4xl)",
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: "var(--space-md)" }}>
                    {metric.label}
                  </div>
                  <div
                    className="num"
                    style={{
                      fontSize: "var(--font-size-stat)",
                      fontWeight: "var(--font-weight-strong)",
                      marginBottom: "var(--space-sm)",
                    }}
                  >
                    {metric.value}
                  </div>
                  <p className="muted" style={{ fontSize: "var(--font-size-caption)", lineHeight: "var(--line-regular)" }}>
                    {metric.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Release versions" style={{ marginTop: "var(--space-9xl)" }}>
            <div className="eyebrow" style={{ marginBottom: "var(--space-2xl)" }}>
              Version timeline
            </div>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "var(--space-2xl)",
              }}
            >
              {data.versions.map((version, index) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  isLast={index === data.versions.length - 1}
                />
              ))}
            </ol>
          </section>

          <section
            aria-label="Limitations and next steps"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: "var(--space-5xl)",
              marginTop: "var(--space-10xl)",
            }}
          >
            <Checklist title="Current limitations" items={data.limitations} />
            <Checklist title="Next implementation steps" items={data.nextSteps} />
          </section>

          <style>{`
            @media (min-width: 840px) {
              [aria-label="Limitations and next steps"] {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

function VersionRow({
  version,
  isLast,
}: {
  version: CompareReleaseVersion;
  isLast: boolean;
}) {
  return (
    <li
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1fr)",
        gap: "var(--space-2xl)",
      }}
    >
      <div aria-hidden style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "var(--space-lg)",
            top: "var(--space-md)",
            width: "9px",
            height: "9px",
            borderRadius: 999,
            background: statusColor(version.status),
            border: "2px solid var(--surface)",
            boxShadow: "0 0 0 1px var(--border-strong)",
          }}
        />
        {!isLast && (
          <span
            style={{
              position: "absolute",
              left: "var(--space-2xl)",
              top: "var(--space-6xl)",
              bottom: "calc(-1 * var(--space-5xl))",
              width: "1px",
              background: "var(--border)",
            }}
          />
        )}
      </div>
      <article
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          padding: "var(--space-4xl) var(--space-5xl)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--space-md)",
            marginBottom: "var(--space-lg)",
          }}
        >
          <Badge tone={version.status === "changed" ? "accent" : "muted"}>
            {statusLabel(version.status)}
          </Badge>
          <span className="muted num" style={{ fontSize: "var(--font-size-meta)" }}>
            {formatDate(version.releaseDate) ?? "Date unknown"}
          </span>
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--font-size-card-title)",
            letterSpacing: "var(--tracking-micro)",
            marginBottom: "var(--space-md)",
          }}
        >
          {version.releaseLabel}
        </h3>
        <p style={{ lineHeight: "var(--line-relaxed)", marginBottom: "var(--space-xl)" }}>{version.summary}</p>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-lg)",
            margin: "0 0 var(--space-2xl)",
          }}
        >
          <VersionFact label="Release set" value={version.releaseSet} />
          <VersionFact
            label="Pages"
            value={version.pageCount != null ? version.pageCount.toLocaleString() : "Unknown"}
          />
          <VersionFact
            label="OCR"
            value={version.ocrAvailable ? "Available" : "Not available"}
          />
          <VersionFact label="Checksum" value={version.checksum ?? "Pending"} />
        </dl>
        <ul style={{ paddingLeft: "var(--space-4xl)", margin: 0, lineHeight: "var(--line-content)" }}>
          {version.notableChanges.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
        {version.ocrExcerpt && (
          <blockquote
            style={{
              margin: "var(--space-3xl) 0 0",
              padding: "var(--space-xl) var(--space-2xl)",
              borderLeft: "3px solid var(--accent)",
              background: "var(--surface-2)",
              color: "var(--text)",
              lineHeight: "var(--line-content)",
            }}
          >
            {version.ocrExcerpt}
          </blockquote>
        )}
      </article>
    </li>
  );
}

function VersionFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow" style={{ marginBottom: "var(--space-xs)" }}>
        {label}
      </dt>
      <dd className="muted" style={{ margin: 0, fontSize: "var(--font-size-detail)" }}>
        {value}
      </dd>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "var(--space-5xl) var(--space-6xl)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--font-size-section-title)",
          letterSpacing: "var(--tracking-micro)",
          marginBottom: "var(--space-xl)",
        }}
      >
        {title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: "var(--space-4xl)", lineHeight: "var(--line-relaxed)" }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Reads the first `record` query value and accepts only IDs matching the
 * shared route regex: 1-120 alphanumeric or dash characters.
 */
function parseRecordId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const trimmed = raw.trim();
  return RECORD_ID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Converts compare-version status values into the exact labels shown in the
 * timeline badge: Baseline, Changed, Unchanged, or Needs OCR.
 */
function statusLabel(status: CompareReleaseVersion["status"]): string {
  switch (status) {
    case "baseline":
      return "Baseline";
    case "changed":
      return "Changed";
    case "unchanged":
      return "Unchanged";
    case "missing_ocr":
      return "Needs OCR";
  }
}

/**
 * Maps compare-version statuses to theme CSS variables for timeline markers:
 * changed uses accent, missing OCR uses muted text, and stable states use the
 * stronger border color.
 */
function statusColor(status: CompareReleaseVersion["status"]): string {
  switch (status) {
    case "changed":
      return "var(--accent)";
    case "missing_ocr":
      return "var(--text-muted)";
    case "baseline":
    case "unchanged":
      return "var(--border-strong)";
  }
}
