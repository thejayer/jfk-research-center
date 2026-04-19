import type { Metadata } from "next";
import Link from "next/link";
import { CorrectionsForm } from "@/components/corrections/corrections-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report a correction",
  description:
    "Flag a factual error in an entity bio, timeline event, AI summary, or document on the JFK Research Center.",
};

const SURFACES: Array<{ value: string; label: string }> = [
  { value: "entity_bio", label: "Entity biography" },
  { value: "entity_timeline", label: "Entity timeline event" },
  { value: "entity_facts", label: "Entity quick fact" },
  { value: "topic_summary", label: "Topic summary" },
  { value: "topic_article", label: "Topic long-form article" },
  { value: "open_questions_thread", label: "Open Questions thread" },
  { value: "established_fact", label: "Established fact" },
  { value: "evidence_item", label: "Physical evidence item" },
  { value: "timeline_event", label: "Case timeline event" },
  { value: "document_metadata", label: "Document metadata or OCR" },
  { value: "ai_summary", label: "AI-generated summary" },
  { value: "other", label: "Other / general issue" },
];

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialSurface = pickString(params.surface) ?? "other";
  const initialTargetId = pickString(params.targetId) ?? "";

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ maxWidth: "68ch" }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Corrections
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.015em",
            marginTop: 8,
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          Report a factual error
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.05rem", lineHeight: 1.6, maxWidth: "62ch" }}
        >
          Cross-checking against the underlying records is the strongest
          correction mechanism — but if you spot a factual error in an
          entity bio, timeline event, AI summary, or document metadata,
          send it through here. Submissions queue for editorial review;
          the editorial standards are described on the{" "}
          <Link href="/about/editorial-policy">editorial policy page</Link>.
        </p>
      </div>

      <CorrectionsForm
        surfaces={SURFACES}
        initialSurface={initialSurface}
        initialTargetId={initialTargetId}
      />
    </div>
  );
}

function pickString(
  v: string | string[] | undefined,
): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}
