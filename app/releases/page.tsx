import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchCaseTimeline,
  fetchCorpusManifest,
} from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Releases",
  description:
    "Chronological history of every public release of JFK Assassination Records — from the Warren Commission Report (1964) through the January 2026 NARA tranche.",
};

export default async function ReleasesPage() {
  const [timeline, manifest] = await Promise.all([
    fetchCaseTimeline(),
    fetchCorpusManifest(),
  ]);

  // Filter to category='release' and sort newest-first (reverse chron).
  const releases = timeline.events
    .filter((e) => e.category === "release")
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Releases
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          Declassification history
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          Every public release of records in the JFK Assassination Records
          Collection &mdash; from the Warren Commission\'s 1964 report through
          the ARRB\'s 1994&ndash;98 declassifications, the periodic NARA
          tranches of 2017&ndash;2023, and the Executive Order 14176 drops
          of 2025&ndash;2026. Per-release record counts below come from
          the live <Link href="/about/methodology">corpus manifest</Link>.
        </p>
      </header>

      <ol
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {releases.map((r) => {
          // Try to correlate the event to a release_set in corpus_manifest
          // for a record-count chip. Heuristic: match on year within date.
          const year = r.date.slice(0, 4);
          const possibleKeys = Object.keys(manifest.recordsByRelease).filter(
            (k) => k === year || k.includes(year),
          );
          const count = possibleKeys.length
            ? manifest.recordsByRelease[possibleKeys[0]!]
            : 0;
          return (
            <li
              key={r.id}
              style={{
                padding: "18px 20px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
              }}
            >
              <div
                className="muted num"
                style={{
                  fontSize: "0.8rem",
                  marginBottom: 6,
                  letterSpacing: "0.02em",
                }}
              >
                {formatDate(r.date)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.2rem",
                  letterSpacing: "-0.005em",
                  marginBottom: 8,
                  lineHeight: 1.3,
                }}
              >
                {r.title}
              </div>
              <p
                style={{
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  color: "var(--text)",
                  marginBottom: 10,
                }}
              >
                {r.description}
              </p>
              <div
                className="muted"
                style={{
                  fontSize: "0.8rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                {count > 0 && (
                  <span
                    style={{
                      padding: "2px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                    }}
                  >
                    <span className="num">{formatNumber(count)}</span>{" "}
                    records indexed
                  </span>
                )}
                {r.sourceExternal.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.8rem" }}
                  >
                    source &rarr;
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
