import Link from "next/link";
import type { CorpusManifest } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

/**
 * Disclosure strip shown above the fold on / and /search. Tells users
 * which releases are indexed (and how the OCR text maps to release
 * dates), so someone reading a document doesn't mistake the XLSX-
 * manifest release_date ("released 2018") for the release the text was
 * actually sourced from (often the less-redacted 2025 re-release).
 */
export function ScopeBanner({ manifest }: { manifest: CorpusManifest }) {
  const indexed = manifest.releasesIndexed;
  const pending = manifest.releasesPending;

  return (
    <div
      role="note"
      aria-label="Corpus scope"
      style={{
        margin: "0 auto",
        maxWidth: "var(--container-max, 1100px)",
        padding: "10px 16px",
        fontSize: "0.86rem",
        lineHeight: 1.5,
        color: "var(--text-muted)",
        background: "color-mix(in srgb, var(--surface) 60%, transparent)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm, 6px)",
      }}
    >
      <strong style={{ color: "var(--text)", fontWeight: 600 }}>
        Scope:
      </strong>{" "}
      This research tool indexes{" "}
      <span className="num">{formatNumber(manifest.totalRecords)}</span>{" "}
      records — a curated subset of the ~300,000 documents in the JFK
      Assassination Records Collection.
      {indexed.length > 0 && (
        <>
          {" "}
          Releases indexed: <span className="num">{indexed.join(", ")}</span>.
        </>
      )}
      {manifest.recordsWithOcr > 0 && (
        <>
          {" "}
          <span className="num">{formatNumber(manifest.recordsWithOcr)}</span>{" "}
          records have full-text OCR indexed
          {manifest.recordsWith2025Ocr > 0 && (
            <>
              {" "}
              — of those,{" "}
              <span className="num">
                {formatNumber(manifest.recordsWith2025Ocr)}
              </span>{" "}
              are sourced from the 2025 re-release (NARA has not yet published
              an XLSX manifest for 2025; each document&rsquo;s prior-release
              history is shown on its page)
            </>
          )}
          .
        </>
      )}
      {pending.length > 0 && (
        <>
          {" "}
          Releases <em>not yet indexed</em>:{" "}
          <span className="num">{pending.join(", ")}</span>.
        </>
      )}{" "}
      <Link href="/about/methodology">Methodology &rarr;</Link>
    </div>
  );
}
