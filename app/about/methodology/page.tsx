import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How the JFK Research Center ingests, indexes, and generates analysis over the JFK Assassination Records Collection.",
};

export default async function MethodologyPage() {
  const manifest = await fetchCorpusManifest();
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ maxWidth: "72ch" }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          About
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.015em",
            marginTop: 8,
            marginBottom: 24,
            lineHeight: 1.15,
          }}
        >
          Methodology
        </h1>

        <Section title="Scope and ingest cutoff">
          <p>
            This research tool indexes{" "}
            <strong>{formatNumber(manifest.totalRecords)}</strong> records — a
            curated subset of the roughly 300,000 documents in the{" "}
            <em>JFK Assassination Records Collection</em> held at the U.S.
            National Archives. Of those,{" "}
            <strong>{formatNumber(manifest.recordsWithOcr)}</strong> have
            full-text OCR attached; the remainder are metadata-only.
          </p>
          <p>
            Latest indexed release date:{" "}
            <strong>{manifest.latestIndexedReleaseDate ?? "unknown"}</strong>.
            Releases indexed:{" "}
            <strong>{manifest.releasesIndexed.join(", ") || "none"}</strong>.
            Releases <em>not yet indexed</em>:{" "}
            <strong>{manifest.releasesPending.join(", ") || "none"}</strong>{" "}
            — the 2025 EO 14176 drops and January 2026 release are pending a
            NARA XLSX manifest publication.
          </p>
        </Section>

        <Section title="Data pipeline">
          <p>
            Record metadata is loaded from the NARA JFK Records XLSX manifests
            (one per release) and normalized into a unified schema. OCR is
            streamed from ABBYY&rsquo;s public{" "}
            <a
              href="https://github.com/abbyy/JFK-OCR"
              target="_blank"
              rel="noopener noreferrer"
            >
              JFK-OCR
            </a>{" "}
            repository rather than regenerated in-house; this keeps the VM
            footprint small and defers OCR cost to an upstream provider.
          </p>
          <p>
            OCR text is chunked at 1,200 characters with page labels
            preserved. Entity mentions are produced by tiered substring
            matching against hand-curated alias lists (title-tier = high
            confidence, description-tier = medium, OCR-tier = low). Topic
            membership is rule-based against agency, title tokens, and record
            groups — not model-derived.
          </p>
        </Section>

        <Section title="Models">
          <p>
            AI-generated content uses Google Vertex AI via BigQuery ML remote
            models:
          </p>
          <ul style={{ paddingLeft: 24, lineHeight: 1.7 }}>
            <li>
              <strong>Gemini 2.5 Flash</strong> — short topic summaries (140–200
              words).
            </li>
            <li>
              <strong>Gemini 2.5 Pro</strong> — long-form topic articles
              (600–900 words) and Open Questions map-reduce synthesis.
            </li>
          </ul>
          <p>
            Every AI panel on the site displays the model name, generation
            date, and source-record count inline. Outputs are pre-generated
            and stored; the app does not call the models at request time.
          </p>
        </Section>

        <Section title="Editorial posture">
          <p>
            The site surfaces tensions and anomalies visible in the records
            but does not advocate for any theory of the assassination. Open
            Questions threads are paired with primary-source citations;
            readers are expected to cross-check against the underlying
            documents.
          </p>
          <p>
            Entity bios and timeline entries are curated from Warren
            Commission, HSCA, and ARRB materials. Factual errors should be
            reported via the corrections workflow (forthcoming).
          </p>
        </Section>

        <Section title="Known limitations">
          <ul style={{ paddingLeft: 24, lineHeight: 1.7 }}>
            <li>
              The 2025 and 2026 declassification releases have not yet been
              ingested; users seeking those documents should consult{" "}
              <a
                href="https://www.archives.gov/research/jfk/release-2025"
                target="_blank"
                rel="noopener noreferrer"
              >
                archives.gov/research/jfk/release-2025
              </a>
              .
            </li>
            <li>
              OCR quality varies by document; expect noise in older
              typewritten or hand-annotated pages.
            </li>
            <li>
              Entity extraction is alias-based, not model-based; rare spellings
              and redacted cryptonyms may be under-counted.
            </li>
          </ul>
        </Section>

        <div style={{ marginTop: 40 }}>
          <Link href="/">&larr; Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.35rem",
          marginBottom: 10,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--text)" }}>
        {children}
      </div>
    </section>
  );
}
