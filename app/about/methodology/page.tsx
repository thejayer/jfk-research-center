import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import {
  AboutHero,
  AboutNav,
  AboutSection,
  BackLink,
  StatGrid,
  type AboutNavItem,
} from "../about-components";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How the JFK Research Center ingests, indexes, and generates analysis over the JFK Assassination Records Collection.",
};

const NAV_ITEMS: AboutNavItem[] = [
  {
    href: "#scope",
    label: "Scope",
    detail: "Indexed releases, OCR coverage, and current gaps.",
  },
  {
    href: "#pipeline",
    label: "Pipeline",
    detail: "Metadata, OCR, chunking, entities, and topics.",
  },
  {
    href: "#models",
    label: "Models",
    detail: "Where AI summaries come from and how they are disclosed.",
  },
  {
    href: "#limitations",
    label: "Limitations",
    detail: "Known quality and coverage caveats.",
  },
];

export default async function MethodologyPage() {
  const manifest = await fetchCorpusManifest();

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <AboutHero title="Methodology" aside={<AboutNav items={NAV_ITEMS} />}>
        <p>
          How records enter the site, how OCR and entity references are derived,
          where AI-generated summaries fit, and where the current collection is
          incomplete.
        </p>
      </AboutHero>

      <StatGrid
        stats={[
          {
            label: "Records indexed",
            value: formatNumber(manifest.totalRecords),
            hint: "Curated subset of roughly 300,000 JFK Collection documents.",
          },
          {
            label: "OCR passages",
            value: formatNumber(manifest.ocrPassages),
            hint: "Chunked full-text passages available for search and citation.",
          },
          {
            label: "Pending releases",
            value: manifest.releasesPending.join(", ") || "none",
            hint: "Release years not yet represented in the local index.",
          },
        ]}
      />

      <main style={{ maxWidth: "78ch", marginTop: 10 }}>
        <AboutSection id="scope" title="Scope and ingest cutoff">
          <p>
            This research tool indexes{" "}
            <strong>{formatNumber(manifest.totalRecords)}</strong> records - a
            curated subset of the roughly 300,000 documents in the{" "}
            <em>JFK Assassination Records Collection</em> held at the U.S.
            National Archives. Of those,{" "}
            <strong>{formatNumber(manifest.recordsWithOcr)}</strong> have
            full-text OCR attached, producing{" "}
            <strong>{formatNumber(manifest.ocrPassages)}</strong> indexed OCR
            passages. The remainder are metadata-only.
          </p>
          <p>
            Latest indexed release date:{" "}
            <strong>{manifest.latestIndexedReleaseDate ?? "unknown"}</strong>.
            Releases indexed:{" "}
            <strong>{manifest.releasesIndexed.join(", ") || "none"}</strong>.
            Releases <em>not yet indexed</em>:{" "}
            <strong>{manifest.releasesPending.join(", ") || "none"}</strong>.
          </p>
          {manifest.recordsWith2025Ocr > 0 && (
            <p>
              <strong>2025 re-release layer:</strong> for{" "}
              {formatNumber(manifest.recordsWith2025Ocr)} records, the OCR text
              shown on this site was sourced from the March 2025 unredaction
              (EO 14176). NARA has not yet published an XLSX manifest for the
              2025 release, so the archival metadata fields still come from the
              latest prior XLSX appearance of each record. Every document page
              shows the full release history as a strip.
            </p>
          )}
        </AboutSection>

        <AboutSection id="pipeline" title="Data pipeline">
          <p>
            Record metadata is loaded from the NARA JFK Records XLSX manifests
            and normalized into a unified schema. OCR is streamed from ABBYY's
            public{" "}
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
            OCR text is chunked at 1,200 characters with page labels preserved.
            Entity mentions are produced by tiered substring matching against
            hand-curated alias lists. Topic membership is rule-based against
            agency, title tokens, and record groups - not model-derived.
          </p>
        </AboutSection>

        <AboutSection id="models" title="Models">
          <p>
            AI-generated content uses Google Vertex AI via BigQuery ML remote
            models:
          </p>
          <ul style={{ paddingLeft: 24, lineHeight: 1.7 }}>
            <li>
              <strong>Gemini 2.5 Flash</strong> - short topic summaries
              (140-200 words).
            </li>
            <li>
              <strong>Gemini 2.5 Pro</strong> - long-form topic articles
              (600-900 words) and Open Questions map-reduce synthesis.
            </li>
          </ul>
          <p>
            Every AI panel on the site displays the model name, generation date,
            and source-record count inline. Outputs are pre-generated and
            stored; the app does not call models at request time.
          </p>
        </AboutSection>

        <AboutSection title="Editorial posture">
          <p>
            The site surfaces tensions and anomalies visible in the records but
            does not advocate for any theory of the assassination. Open Questions
            threads are paired with primary-source citations; readers are
            expected to cross-check against the underlying documents.
          </p>
          <p>
            Entity bios and timeline entries are curated from Warren Commission,
            HSCA, and ARRB materials. Factual errors should be reported via the{" "}
            <Link href="/corrections">corrections form</Link>.
          </p>
        </AboutSection>

        <AboutSection id="limitations" title="Known limitations">
          <ul style={{ paddingLeft: 24, lineHeight: 1.7 }}>
            <li>
              The 2025 and 2026 declassification releases have not yet been
              fully ingested; users seeking those documents should consult{" "}
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
              OCR quality varies by document; expect noise in older typewritten
              or hand-annotated pages.
            </li>
            <li>
              Entity extraction is alias-based, not model-based; rare spellings
              and redacted cryptonyms may be under-counted.
            </li>
          </ul>
        </AboutSection>

        <BackLink href="/about" label="Back to About" />
      </main>
    </div>
  );
}
