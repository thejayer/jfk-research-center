import type { Metadata } from "next";
import Link from "next/link";
import { fetchCorpusManifest } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editorial policy",
  description:
    "The editorial posture of the JFK Research Center — neutrality, source allowlist, banned language in AI-generated content, and corrections process.",
};

export default async function EditorialPolicyPage() {
  const manifest = await fetchCorpusManifest();
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
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
          Editorial policy
        </h1>

        <Section title="Neutrality">
          <p>
            This site does not endorse any theory of the assassination. It
            indexes primary-source records and a small set of allowlisted
            secondary references; it does not argue for or against the
            Warren Commission&rsquo;s conclusions, the HSCA&rsquo;s
            conclusions, or any other account. The site&rsquo;s job is to
            make the documentary record reachable and to show where the
            record is internally consistent, where it is in tension, and
            where it is simply incomplete.
          </p>
          <p>
            To enforce that posture in practice, two surfaces are
            maintained side-by-side:{" "}
            <Link href="/open-questions">Open Questions</Link> surfaces
            tensions, contradictions, redaction patterns, and unresolved
            threads;{" "}
            <Link href="/established-facts">Established Facts</Link>{" "}
            catalogs the findings the Warren Commission, HSCA, Church
            Committee, and ARRB substantially agree on, plus an explicitly
            tagged Contested tier for claims where the official record
            itself is inconsistent. Neither surface is the final word.
          </p>
        </Section>

        <Section title="Source allowlist">
          <p>
            AI-generated content (topic summaries, topic articles, Open
            Questions articles, entity bios) is grounded in a{" "}
            <Link href="/bibliography">curated citation registry</Link> of
            primary sources and allowlisted reference works. The allowlist
            explicitly includes: the Warren Commission Report and 26
            Hearings volumes; the HSCA Final Report and 12 appendix
            volumes; the ARRB Final Report; Church Committee Book V; the
            NAS/Ramsey Panel and Clark Panel reports; NARA finding aids
            for the Collection; the FBI Records Vault; and relevant court
            records.
          </p>
          <p>
            The allowlist explicitly excludes partisan blogs, self-published
            books, and speculative secondary works &mdash; not because
            those works have no value to researchers, but because citing
            them on a site that calls itself neutral would push the
            editorial posture. Readers are directed to those works
            elsewhere.
          </p>
        </Section>

        <Section title="Banned language in AI-generated content">
          <p>
            Prompts driving the site&rsquo;s Gemini calls bar a standing
            list of editorializing words: <em>remarkably, curiously,
            suspiciously, conveniently, shadowy, mysterious, allegedly</em>{" "}
            (except inside direct quotes), <em>so-called, mere, obviously,
            clearly, undoubtedly, tellingly, revealingly</em>. Generated
            output is spot-checked against this list. When a banned word
            slips through, the containing passage is flagged for human
            review and regeneration.
          </p>
        </Section>

        <Section title="AI disclosure">
          <p>
            Every AI-generated panel on the site carries a footer line
            naming the model, the generation date, and the record count
            the output was grounded in. Users should treat AI summaries as
            starting points &mdash; they speed primary-source
            research, but they do not replace it. Where a claim matters,
            read the underlying records.
          </p>
        </Section>

        <Section title="Corrections">
          <p>
            Factual errors in entity bios, timeline entries, AI
            summaries, or document metadata can be reported via the{" "}
            <Link href="/corrections">corrections form</Link>. Each
            entity page and topic page also carries a small &ldquo;Report
            an error on this page&rdquo; link that pre-fills the form
            with the surface and target id. Submissions queue for
            editorial review; cross-checking against the linked sources
            is the strongest correction mechanism.
          </p>
        </Section>

        <Section title="What this site is not">
          <p>
            It is not a complete mirror of the JFK Assassination Records
            Collection; it is a curated subset of{" "}
            {formatNumber(manifest.totalRecords)} records, with full-text OCR on{" "}
            {formatNumber(manifest.recordsWithOcr)} of them. The{" "}
            <Link href="/about/methodology">methodology page</Link>{" "}
            details scope, pipeline, and known limitations. It is not a
            conspiracy site, and it is not a defense of orthodoxy;
            generalizing from what this site does or doesn&rsquo;t
            contain to &ldquo;what the government is hiding&rdquo; or
            &ldquo;what is now proven&rdquo; is beyond what the
            documentary record supports.
          </p>
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
