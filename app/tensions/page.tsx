import type { Metadata } from "next";
import Link from "next/link";
import { fetchOpenQuestionsIndex, fetchOpenQuestionsTopic } from "@/lib/api-client";
import type { OpenQuestionsTopicResponse } from "@/lib/api-types";
import { buildTensionMap } from "@/lib/tension-map";
import type { TensionMapGroup, TensionMapThread } from "@/lib/tension-map";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  tensionAnchorId,
  tensionLabel,
} from "@/components/open-questions/tension-labels";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";

export const metadata: Metadata = {
  title: "Tension Map",
  description:
    "A neutral map of contradictions, timing issues, record gaps, and unresolved research leads in the JFK Research Center archive.",
};

export const dynamic = "force-dynamic";

const statusLabel = {
  open: "Open",
  partially_resolved: "Partial",
  resolved: "Resolved",
} as const;

export default async function TensionMapPage() {
  const index = await fetchOpenQuestionsIndex();
  const topicResults = await Promise.allSettled(
    index.topics.map((topic) => fetchOpenQuestionsTopic(topic.slug)),
  );
  const topics: OpenQuestionsTopicResponse[] = [];
  for (const result of topicResults) {
    if (result.status === "fulfilled" && result.value !== null) {
      topics.push(result.value);
    }
  }
  const groups = buildTensionMap(topics);
  const totalThreads = groups.reduce((sum, group) => sum + group.threadCount, 0);
  const totalDocuments = new Set(
    groups.flatMap((group) =>
      group.threads.flatMap((thread) => thread.supportingDocIds),
    ),
  ).size;
  const openThreads = groups.reduce(
    (sum, group) => sum + group.statusCounts.open,
    0,
  );

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <ResearchHistoryTracker
        item={{
          type: "question",
          sourceId: "tension-map",
          title: "Tension map",
          href: "/tensions",
          context: `${formatNumber(totalThreads)} unresolved research threads`,
        }}
      />

      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Tension Map</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 28,
          alignItems: "start",
          paddingTop: 42,
          paddingBottom: 38,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "72ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Research leads
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Contradiction and Tension Map
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            A scan-first map of where the indexed record is unsettled:
            contradictions, timing oddities, unexplained references, redaction
            patterns, and gaps that still require source review.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, margin: 0 }}
          >
            These entries are drawn from the open-questions layer and remain
            research leads. They are not findings, and each item points back to
            supporting records before it asks readers to infer anything.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <LinkButton href="/open-questions" variant="secondary" size="sm">
              Open questions
            </LinkButton>
            <LinkButton href="/established-facts" variant="secondary" size="sm">
              Established facts
            </LinkButton>
          </div>
        </div>

        <aside
          aria-label="Tension map profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Map profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            <Metric label="Types" value={groups.length} />
            <Metric label="Threads" value={totalThreads} />
            <Metric label="Docs" value={totalDocuments} />
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            {formatNumber(openThreads)} threads remain open. Resolved or partial
            entries stay visible so the trail of interpretation is auditable.
          </p>
        </aside>
      </header>

      {groups.length > 0 ? (
        <>
          <nav
            aria-label="Tension groups"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10,
              marginTop: 26,
            }}
          >
            {groups.map((group) => (
              <a
                key={group.tensionType}
                href={`#${tensionMapAnchor(group.tensionType)}`}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  color: "var(--text)",
                  textDecoration: "none",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: "0.9rem" }}>
                  {tensionLabel(group.tensionType)}
                </span>
                <span className="muted num" style={{ fontSize: "0.78rem" }}>
                  {formatNumber(group.threadCount)} threads /{" "}
                  {formatNumber(group.documentCount)} sources
                </span>
              </a>
            ))}
          </nav>

          <section aria-label="Mapped tensions" style={{ marginTop: 56 }}>
            <SectionHeading
              eyebrow="Mapped tensions"
              title="Browse by tension type"
              description="Each group collects unresolved threads across topics and keeps source links visible."
            />
            <div style={{ display: "grid", gap: 34 }}>
              {groups.map((group) => (
                <TensionGroupSection key={group.tensionType} group={group} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section
          aria-label="No tensions available"
          style={{
            marginTop: 42,
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 24,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          No open-question threads are indexed yet. Rebuild the warehouse without
          skipping open questions to populate the tension map.
        </section>
      )}
    </div>
  );
}

function TensionGroupSection({ group }: { group: TensionMapGroup }) {
  return (
    <section
      id={tensionMapAnchor(group.tensionType)}
      aria-label={tensionLabel(group.tensionType)}
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {tensionLabel(group.tensionType)}
          </h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            {formatNumber(group.threadCount)} threads across{" "}
            {formatNumber(group.topicCount)} topics and{" "}
            {formatNumber(group.documentCount)} supporting records.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge tone="neutral" size="sm">
            {formatNumber(group.statusCounts.open)} open
          </Badge>
          <Badge tone="muted" size="sm">
            {formatNumber(group.statusCounts.partially_resolved)} partial
          </Badge>
          <Badge tone="outline" size="sm">
            {formatNumber(group.statusCounts.resolved)} resolved
          </Badge>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 14,
        }}
      >
        {group.threads.map((thread) => (
          <TensionThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    </section>
  );
}

function TensionThreadCard({ thread }: { thread: TensionMapThread }) {
  return (
    <article
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 18,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 12,
        }}
      >
        <Link
          href={`${thread.topicHref}#${tensionAnchorId(thread.tensionType)}`}
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {thread.topicTitle}
        </Link>
        <StatusBadge status={thread.status} />
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          letterSpacing: 0,
          fontSize: "1.06rem",
          lineHeight: 1.35,
          fontWeight: 500,
          margin: 0,
        }}
      >
        {thread.question}
      </h3>
      {thread.summary && (
        <p
          className="muted"
          style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.55 }}
        >
          {thread.summary}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <SourceReliabilityBadge kind="research_lead" />
        {thread.supportingDocIds.length > 0 ? (
          thread.supportingDocIds.map((id) => (
            <Link
              key={id}
              href={`/document/${encodeURIComponent(id)}`}
              style={{
                padding: "4px 8px",
                fontSize: "0.72rem",
                letterSpacing: "0.02em",
                color: "var(--text-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                textDecoration: "none",
                background: "var(--bg)",
              }}
              title={`Open supporting document ${id}`}
            >
              {id}
            </Link>
          ))
        ) : (
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            No supporting document ids attached
          </span>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "1.18rem" }}>
        {formatNumber(value)}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.62rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TensionMapThread["status"] }) {
  const tone =
    status === "open" ? "low" : status === "partially_resolved" ? "medium" : "high";
  return (
    <Badge tone={tone} size="sm">
      {statusLabel[status]}
    </Badge>
  );
}

/**
 * Builds stable in-page fragment ids for tension groups.
 *
 * Lowercases the tension type, replaces runs of non-alphanumeric characters
 * with a single hyphen, trims leading/trailing hyphens, and falls back to
 * "other" when the resulting slug is empty. Keep this compatible with existing
 * hash links so saved URLs and in-page navigation continue to resolve.
 */
function tensionMapAnchor(tensionType: string): string {
  return `tension-map-${tensionType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other"}`;
}
