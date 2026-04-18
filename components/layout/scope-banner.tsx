import Link from "next/link";
import type { CorpusManifest } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

/**
 * Disclosure strip shown above the fold on / and /search. Tells users that
 * the indexed corpus is a curated subset of the full JFK Collection and
 * which declassification releases are / are not yet indexed.
 */
export function ScopeBanner({ manifest }: { manifest: CorpusManifest }) {
  const indexed = manifest.releasesIndexed.join(", ");
  const pending = manifest.releasesPending.join(", ");

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
      {indexed && (
        <>
          {" "}
          Releases indexed: <span className="num">{indexed}</span>.
        </>
      )}
      {pending && (
        <>
          {" "}
          Releases <em>not yet indexed</em>:{" "}
          <span className="num">{pending}</span>.
        </>
      )}{" "}
      <Link href="/about/methodology">Methodology &rarr;</Link>
    </div>
  );
}
