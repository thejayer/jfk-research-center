import Link from "next/link";
import type React from "react";
import type { CSSProperties } from "react";
import type { CaseTimelineCategory, CaseTimelineEvent } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { normalizeHttpUrl } from "@/lib/safe-url";
import { SaveResearchButton } from "@/components/research/save-research-button";
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
      {e.documentLinks.length > 0 && (
        <TimelineChipRow label="Documents">
          {e.documentLinks.map((d) => (
            <TimelineChip
              key={d.documentId}
              href={`/document/${encodeURIComponent(d.documentId)}`}
              title={d.note ?? undefined}
            >
              {d.title ?? d.documentId}
            </TimelineChip>
          ))}
        </TimelineChipRow>
      )}
      {externalSources.length > 0 && (
        <TimelineChipRow label="Sources">
          {externalSources.map((url) => (
            <TimelineChip key={url} href={url} external>
              {hostLabel(url)} external
            </TimelineChip>
          ))}
        </TimelineChipRow>
      )}
    </Container>
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
