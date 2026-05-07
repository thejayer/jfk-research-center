import type { Metadata } from "next";
import Link from "next/link";
import type { CompareReleaseVersion } from "@/lib/api-types";
import { fetchCompare } from "@/lib/api-client";
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
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          marginBottom: 22,
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>Home</Link>
        <span aria-hidden style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text)" }}>Compare releases</span>
      </nav>

      <header style={{ maxWidth: "72ch", marginBottom: 34 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Release comparison
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.25rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          Compare record versions across releases
        </h1>
        <p className="muted" style={{ fontSize: "1.02rem", lineHeight: 1.65 }}>
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
              gap: 16,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                padding: "20px 22px",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {data.canonicalKey.label} {data.canonicalKey.value}
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.55rem",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                  marginBottom: 10,
                }}
              >
                {data.record.title}
              </h2>
              <p className="muted" style={{ lineHeight: 1.6, maxWidth: "78ch" }}>
                {data.record.snippet ?? data.record.subtitle}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 16,
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
                gap: 12,
              }}
            >
              {data.metrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    padding: "16px 18px",
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    {metric.label}
                  </div>
                  <div
                    className="num"
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 650,
                      marginBottom: 6,
                    }}
                  >
                    {metric.value}
                  </div>
                  <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {metric.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Release versions" style={{ marginTop: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Version timeline
            </div>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 14,
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
              gap: 20,
              marginTop: 40,
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
        gap: 14,
      }}
    >
      <div aria-hidden style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: 8,
            width: 9,
            height: 9,
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
              left: 14,
              top: 22,
              bottom: -20,
              width: 1,
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
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Badge tone={version.status === "changed" ? "accent" : "muted"}>
            {statusLabel(version.status)}
          </Badge>
          <span className="muted num" style={{ fontSize: "0.82rem" }}>
            {formatDate(version.releaseDate) ?? "Date unknown"}
          </span>
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.2rem",
            letterSpacing: "-0.005em",
            marginBottom: 8,
          }}
        >
          {version.releaseLabel}
        </h3>
        <p style={{ lineHeight: 1.6, marginBottom: 12 }}>{version.summary}</p>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            margin: "0 0 14px",
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
        <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.55 }}>
          {version.notableChanges.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
        {version.ocrExcerpt && (
          <blockquote
            style={{
              margin: "16px 0 0",
              padding: "12px 14px",
              borderLeft: "3px solid var(--accent)",
              background: "var(--surface-2)",
              color: "var(--text)",
              lineHeight: 1.55,
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
      <dt className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </dt>
      <dd className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
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
        padding: "20px 22px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.25rem",
          letterSpacing: "-0.005em",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Reads the first `record` query value and accepts only simple slug-like IDs:
 * alphanumeric characters plus dashes. Empty or malformed input falls back.
 */
function parseRecordId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null;
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
