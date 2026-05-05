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
  title: "Editorial policy",
  description:
    "The editorial posture of the JFK Research Center: neutrality, source allowlist, AI disclosure, and corrections process.",
};

const NAV_ITEMS: AboutNavItem[] = [
  {
    href: "#neutrality",
    label: "Neutrality",
    detail: "What the site does and does not argue.",
  },
  {
    href: "#sources",
    label: "Source allowlist",
    detail: "Primary and reference materials used for grounding.",
  },
  {
    href: "#ai-disclosure",
    label: "AI disclosure",
    detail: "How generated panels are labeled and limited.",
  },
  {
    href: "#corrections",
    label: "Corrections",
    detail: "How errors are reported and reviewed.",
  },
];

export default async function EditorialPolicyPage() {
  const manifest = await fetchCorpusManifest();

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <AboutHero title="Editorial policy" aside={<AboutNav items={NAV_ITEMS} />}>
        <p>
          The site is built to help readers inspect the record. It avoids
          argumentative framing, exposes AI usage, and treats corrections as
          part of the research workflow.
        </p>
      </AboutHero>

      <StatGrid
        stats={[
          {
            label: "Indexed records",
            value: formatNumber(manifest.totalRecords),
            hint: "The current corpus is a curated subset, not the complete collection.",
          },
          {
            label: "OCR records",
            value: formatNumber(manifest.recordsWithOcr),
            hint: "Full-text search depends on OCR availability and quality.",
          },
          {
            label: "Posture",
            value: "neutral",
            hint: "The site surfaces sources and tensions without endorsing a theory.",
          },
        ]}
      />

      <main style={{ maxWidth: "78ch", marginTop: 10 }}>
        <AboutSection id="neutrality" title="Neutrality">
          <p>
            This site does not endorse any theory of the assassination. It
            indexes primary-source records and a small set of allowlisted
            secondary references; it does not argue for or against the Warren
            Commission's conclusions, the HSCA's conclusions, or any other
            account. The site's job is to make the documentary record reachable
            and to show where the record is internally consistent, where it is
            in tension, and where it is incomplete.
          </p>
          <p>
            To enforce that posture in practice, two surfaces are maintained
            side-by-side: <Link href="/open-questions">Open Questions</Link>{" "}
            surfaces tensions, contradictions, redaction patterns, and
            unresolved threads;{" "}
            <Link href="/established-facts">Established Facts</Link> catalogs
            findings that official investigations substantially agree on, plus a
            tagged Contested tier for claims where the official record is
            internally inconsistent. Neither surface is the final word.
          </p>
        </AboutSection>

        <AboutSection id="sources" title="Source allowlist">
          <p>
            AI-generated content is grounded in a{" "}
            <Link href="/bibliography">curated citation registry</Link> of
            primary sources and allowlisted reference works. The allowlist
            includes the Warren Commission Report and Hearings volumes, the HSCA
            Final Report and appendix volumes, the ARRB Final Report, Church
            Committee Book V, NARA finding aids, the FBI Records Vault, and
            relevant court records.
          </p>
          <p>
            The allowlist excludes partisan blogs, self-published books, and
            speculative secondary works - not because those works have no value
            to researchers, but because citing them on a neutral site would push
            the editorial posture.
          </p>
        </AboutSection>

        <AboutSection title="Banned language in AI-generated content">
          <p>
            Prompts driving the site's Gemini calls bar a standing list of
            editorializing words: <em>remarkably, curiously, suspiciously,
            conveniently, shadowy, mysterious, allegedly</em> except inside
            direct quotes, plus <em>so-called, mere, obviously, clearly,
            undoubtedly, tellingly, revealingly</em>. Generated output is
            spot-checked against this list. When a banned word slips through,
            the containing passage is flagged for review and regeneration.
          </p>
        </AboutSection>

        <AboutSection id="ai-disclosure" title="AI disclosure">
          <p>
            Every AI-generated panel on the site carries a footer line naming
            the model, generation date, and record count the output was grounded
            in. Users should treat AI summaries as starting points: they speed
            primary-source research, but they do not replace it. Where a claim
            matters, read the underlying records.
          </p>
        </AboutSection>

        <AboutSection id="corrections" title="Corrections">
          <p>
            Factual errors in entity bios, timeline entries, AI summaries, or
            document metadata can be reported via the{" "}
            <Link href="/corrections">corrections form</Link>. Entity and topic
            pages also carry a report link that pre-fills the form with the
            surface and target id. Submissions queue for editorial review;
            cross-checking against linked sources is the strongest correction
            mechanism.
          </p>
        </AboutSection>

        <AboutSection title="What this site is not">
          <p>
            It is not a complete mirror of the JFK Assassination Records
            Collection; it is a curated subset of{" "}
            {formatNumber(manifest.totalRecords)} records, with full-text OCR on{" "}
            {formatNumber(manifest.recordsWithOcr)} of them. The{" "}
            <Link href="/about/methodology">methodology page</Link> details
            scope, pipeline, and known limitations. It is not a conspiracy site,
            and it is not a defense of orthodoxy; generalizing from what this
            site does or does not contain to what is hidden or proven is beyond
            what the documentary record supports.
          </p>
        </AboutSection>

        <BackLink href="/about" label="Back to About" />
      </main>
    </div>
  );
}
