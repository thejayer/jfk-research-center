import Link from "next/link";
import type React from "react";
import type { CSSProperties } from "react";
import type { CaseTimelineCategory, CaseTimelineEvent } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { normalizeHttpUrl } from "@/lib/safe-url";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import type { SourceReliabilityKind } from "@/lib/source-reliability";
import { timelineEventPacketHref } from "@/lib/timeline-source-bridge";
import { TimelinePermalink } from "./timeline-permalink";

const CATEGORY_LABEL: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

const CATEGORY_COLOR: Record<CaseTimelineCategory, string> = {
  biographical: "var(--cat-biographical)",
  operational: "var(--cat-operational)",
  investigation: "var(--cat-investigation)",
  release: "var(--cat-release)",
  death: "var(--cat-death)",
};

function hostLabel(url: string): string {
  return new URL(url).host.replace(/^www\./, "");
}

export function EventCard({
  event: e,
  as = "li",
  showPermalink = true,
}: {
  event: CaseTimelineEvent;
  as?: "li" | "article";
  showPermalink?: boolean;
}) {
  const Container = as;
  const externalSources = Array.from(
    new Set(
      e.sourceExternal
        .map((url) => normalizeHttpUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );

  return (
    <Container
      id={e.id}
      data-timeline-event
      data-category={e.category}
      style={{
        ...surfaceCardStyle,
        padding: "12px 16px 14px",
        scrollMarginTop: "calc(var(--header-height, 64px) + 80px)",
        listStyle: as === "li" ? "none" : undefined,
      }}
    >
      <div
        className="num"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          flexWrap: "wrap",
          fontSize: "0.74rem",
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
          marginBottom: "var(--space-sm)",
        }}
      >
        <span>{formatDate(e.date)}</span>
        {e.timeLocal && (
          <>
            <span aria-hidden="true">/</span>
            <span>{e.timeLocal}</span>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: CATEGORY_COLOR[e.category],
          }}
        >
          {CATEGORY_LABEL[e.category]}
        </span>
        {e.importance >= 5 && (
          <span title="Headline event" style={{ letterSpacing: "0.04em" }}>
            headline
          </span>
        )}
        {showPermalink && <TimelinePermalink eventId={e.id} title={e.title} />}
        <Link
          href={timelineEventPacketHref(e)}
          style={{
            color: "var(--text)",
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          source packet
        </Link>
        <SaveResearchButton
          compact
          item={{
            type: "timeline",
            sourceId: e.id,
            title: e.title,
            href: `/timeline?view=list#${encodeURIComponent(e.id)}`,
            context: formatDate(e.date) ?? undefined,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--step-3)",
          letterSpacing: 0,
          marginBottom: "var(--space-xs)",
          lineHeight: "var(--line-snug)",
        }}
      >
        {e.title}
      </div>
      <p
        style={{
          fontSize: "0.92rem",
          lineHeight: "var(--line-content)",
          color: "var(--text)",
          marginTop: "var(--space-xs)",
          marginBottom: 0,
        }}
      >
        {e.description}
      </p>
      {(e.documentLinks.length > 0 || externalSources.length > 0) && (
        <TimelineSourceTrail
          documents={e.documentLinks}
          externalSources={externalSources}
        />
      )}
      {(e.relatedEntityIds.length > 0 || e.relatedTopicIds.length > 0) && (
        <TimelineChipRow label="Related">
          {e.relatedEntityIds.map((id) => (
            <TimelineChip key={id} href={`/entity/${encodeURIComponent(id)}`}>
              {id}
            </TimelineChip>
          ))}
          {e.relatedTopicIds.map((id) => (
            <TimelineChip key={id} href={`/topic/${encodeURIComponent(id)}`}>
              #{id}
            </TimelineChip>
          ))}
        </TimelineChipRow>
      )}
    </Container>
  );
}

function TimelineSourceTrail({
  documents,
  externalSources,
}: {
  documents: CaseTimelineEvent["documentLinks"];
  externalSources: string[];
}) {
  return (
    <div
      aria-label="Source trail"
      style={{
        marginTop: "var(--space-md)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "color-mix(in srgb, var(--text) 3%, var(--surface))",
        padding: "10px 11px",
        display: "grid",
        gap: 8,
      }}
    >
      <div className="eyebrow" style={{ fontSize: "0.66rem", letterSpacing: "0.1em" }}>
        Source trail
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {documents.map((document) => (
          <SourceTrailLink
            key={`document-${document.documentId}`}
            href={`/document/${encodeURIComponent(document.documentId)}`}
            label={document.title ?? document.documentId}
            meta={document.note ?? "Primary record"}
            kind="Primary source"
            reliability="primary_source"
          />
        ))}
        {externalSources.map((url) => (
          <SourceTrailLink
            key={`external-${url}`}
            href={url}
            label={hostLabel(url)}
            meta="External source"
            kind="External"
            reliability="external_reference"
            external
          />
        ))}
      </div>
    </div>
  );
}

function SourceTrailLink({
  href,
  label,
  meta,
  kind,
  reliability,
  external,
}: {
  href: string;
  label: string;
  meta: string;
  kind: string;
  reliability: SourceReliabilityKind;
  external?: boolean;
}) {
  const content = (
    <>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            color: "var(--text)",
            fontSize: "0.84rem",
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {label}
        </span>
        <span
          className="muted"
          style={{ display: "block", fontSize: "0.74rem", lineHeight: 1.35 }}
        >
          {kind} / {meta}
        </span>
        <span style={{ display: "inline-flex", marginTop: 6 }}>
          <SourceReliabilityBadge kind={reliability} />
        </span>
      </span>
      <ArrowRightIcon />
    </>
  );

  const style = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 9px",
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: "var(--surface)",
    color: "var(--text)",
    textDecoration: "none",
  } as const;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" style={style}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} style={style}>
      {content}
    </Link>
  );
}

function TimelineChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        fontSize: "0.72rem",
        color: "var(--text-muted)",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "baseline",
      }}
    >
      <span className="eyebrow" style={{ letterSpacing: "0.08em", marginRight: 2 }}>
        {label}:
      </span>
      {children}
    </div>
  );
}

function TimelineChip({
  href,
  title,
  external,
  children,
}: {
  href: string;
  title?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noreferrer noopener"
        style={chipStyle}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} title={title} style={chipStyle}>
      {children}
    </Link>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const chipStyle = {
  padding: "1px 6px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text-muted)",
  textDecoration: "none",
} as const;

const surfaceCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  transition:
    "border-color var(--motion), background var(--motion), box-shadow var(--motion), transform var(--motion)",
};

export const TIMELINE_CATEGORY_LABEL = CATEGORY_LABEL;
export const TIMELINE_CATEGORY_COLOR = CATEGORY_COLOR;
