import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { fetchCaseTimeline, fetchMediaIndex } from "@/lib/api-client";
import type { CaseTimelineCategory, CaseTimelineEvent } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { findRelatedMediaAssets } from "@/lib/media-assets";
import { normalizeHttpUrl } from "@/lib/safe-url";
import {
  findTimelineEventPacket,
  timelineEventHref,
  timelineEventPacketHref,
} from "@/lib/timeline-source-bridge";
import { RelatedMediaPanel } from "@/components/media/related-media-panel";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { ResearchHistoryTracker } from "@/components/research/research-history-tracker";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

const ACRONYM_LABELS: Record<string, string> = {
  arbb: "ARRB",
  cia: "CIA",
  fbi: "FBI",
  hsca: "HSCA",
  jfk: "JFK",
  nara: "NARA",
};

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const timeline = await fetchCaseTimeline();
  const packet = findTimelineEventPacket(timeline.events, id);
  if (!packet) return { title: "Timeline event not found" };

  return {
    title: `${packet.event.title} | Timeline event`,
    description: packet.event.description,
  };
}

export default async function TimelineEventPage({ params }: Props) {
  const { id } = await params;
  const [timelineResult, mediaResult] = await Promise.allSettled([
    fetchCaseTimeline(),
    fetchMediaIndex(),
  ]);

  if (timelineResult.status !== "fulfilled") throw timelineResult.reason;
  const packet = findTimelineEventPacket(timelineResult.value.events, id);
  if (!packet) notFound();

  const event = packet.event;
  const packetHref = timelineEventPacketHref(event);
  const listHref = timelineEventHref(event);
  const dateLabel = formatDate(event.date) ?? event.date;
  const externalSources = safeExternalSources(event);
  const relatedMedia =
    mediaResult.status === "fulfilled"
      ? findRelatedMediaAssets(mediaResult.value.assets, {
          entities: event.relatedEntityIds,
          topics: event.relatedTopicIds,
          limit: 4,
        })
      : [];
  const savedItem = {
    type: "timeline" as const,
    sourceId: event.id,
    title: event.title,
    href: packetHref,
    context: event.timeLocal
      ? `${dateLabel} / ${event.timeLocal}`
      : dateLabel,
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
      <ResearchHistoryTracker item={savedItem} />
      <nav aria-label="Breadcrumb" style={breadcrumbStyle}>
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <Link href="/timeline" style={{ color: "var(--text-muted)" }}>
          Timeline
        </Link>
        <span aria-hidden="true" style={{ margin: "0 6px" }}>
          /
        </span>
        <span style={{ color: "var(--text)" }}>Source packet</span>
      </nav>

      <header style={heroStyle}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Timeline source packet
          </div>
          <h1 style={titleStyle}>{event.title}</h1>
          <p style={descriptionStyle}>{event.description}</p>
          <div style={metaRowStyle}>
            <span>{dateLabel}</span>
            {event.timeLocal && <span>{event.timeLocal}</span>}
            <span>{CATEGORY_LABEL[event.category]}</span>
            {event.importance >= 5 && <span>Headline event</span>}
          </div>
          <div style={actionRowStyle}>
            <Link href={listHref} style={primaryActionStyle}>
              Back to event in timeline
            </Link>
            <SaveResearchButton item={savedItem} />
          </div>
        </div>
        <aside style={summaryCardStyle} aria-label="Event packet summary">
          <PacketStat label="Chronology position" value={`${packet.index} of ${packet.total}`} />
          <PacketStat
            label="Primary documents"
            value={event.documentLinks.length.toLocaleString()}
          />
          <PacketStat
            label="External sources"
            value={externalSources.length.toLocaleString()}
          />
          <PacketStat
            label="Relationship tags"
            value={(event.relatedEntityIds.length + event.relatedTopicIds.length).toLocaleString()}
          />
        </aside>
      </header>

      <div style={contentGridStyle}>
        <main style={{ minWidth: 0 }}>
          <section id="source-trail" aria-labelledby="source-trail-title">
            <SectionHeading
              eyebrow="Source trail"
              title="Records attached to this event"
              description="These links come from the timeline event record. Treat them as the starting point for reading, not as a complete evidentiary claim."
            />
            <div style={sourceGridStyle}>
              <SourceColumn
                title="Primary records"
                empty="No primary document links are attached to this event yet."
              >
                {event.documentLinks.map((document) => (
                  <DocumentSourceLink
                    key={document.documentId}
                    document={document}
                  />
                ))}
              </SourceColumn>
              <SourceColumn
                title="External references"
                empty="No external source links are attached to this event yet."
              >
                {externalSources.map((url) => (
                  <ExternalSourceLink key={url} url={url} />
                ))}
              </SourceColumn>
            </div>
          </section>

          <section
            id="relationships"
            aria-labelledby="relationships-title"
            style={{ marginTop: 42 }}
          >
            <SectionHeading
              eyebrow="Research context"
              title="Entities and topics connected here"
              description="Relationship tags connect this event back into the broader research graph for follow-up reading."
            />
            <div style={relationshipGridStyle}>
              <RelationshipList
                title="Entities"
                items={event.relatedEntityIds}
                hrefFor={(value) => `/entity/${encodeURIComponent(value)}`}
              />
              <RelationshipList
                title="Topics"
                items={event.relatedTopicIds}
                hrefFor={(value) => `/topic/${encodeURIComponent(value)}`}
                prefix="#"
              />
            </div>
          </section>

          <RelatedMediaPanel
            assets={relatedMedia}
            title="Official media near this event"
            description="JFK Library media records connected through the same event entity or topic tags."
          />
        </main>

        <aside style={asideStyle}>
          <ChronologyCard packet={packet} />
          <div style={sideCardStyle}>
            <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Research stance
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              This page packages the existing event links into a reading surface.
              It does not add new factual claims or infer source support beyond
              the event metadata already present in the timeline.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PacketStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <dt className="eyebrow" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="num" style={{ margin: "5px 0 0", fontSize: "1.05rem" }}>
        {value}
      </dd>
    </div>
  );
}

function SourceColumn({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div style={sideCardStyle}>
      <h2 style={smallHeadingStyle}>{title}</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {children && hasChildren(children) ? (
          children
        ) : (
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentSourceLink({
  document,
}: {
  document: CaseTimelineEvent["documentLinks"][number];
}) {
  return (
    <Link
      href={`/document/${encodeURIComponent(document.documentId)}`}
      style={sourceLinkStyle}
    >
      <span style={{ minWidth: 0 }}>
        <span style={sourceTitleStyle}>
          {document.title ?? document.documentId}
        </span>
        <span className="muted" style={sourceMetaStyle}>
          {document.note ?? "Timeline-linked primary record"}
        </span>
        <span style={{ display: "inline-flex", marginTop: 7 }}>
          <SourceReliabilityBadge kind="primary_source" />
        </span>
      </span>
      <ArrowRightIcon />
    </Link>
  );
}

function ExternalSourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={sourceLinkStyle}
    >
      <span style={{ minWidth: 0 }}>
        <span style={sourceTitleStyle}>{hostLabel(url)}</span>
        <span className="muted" style={sourceMetaStyle}>
          External reference
        </span>
        <span style={{ display: "inline-flex", marginTop: 7 }}>
          <SourceReliabilityBadge kind="external_reference" />
        </span>
      </span>
      <ArrowRightIcon />
    </a>
  );
}

function RelationshipList({
  title,
  items,
  hrefFor,
  prefix = "",
}: {
  title: string;
  items: string[];
  hrefFor: (value: string) => string;
  prefix?: string;
}) {
  return (
    <div style={sideCardStyle}>
      <h2 style={smallHeadingStyle}>{title}</h2>
      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((item) => (
            <Link key={item} href={hrefFor(item)} style={chipStyle}>
              {prefix}
              {labelFromSlug(item)}
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No {title.toLowerCase()} tagged yet.
        </p>
      )}
    </div>
  );
}

function ChronologyCard({
  packet,
}: {
  packet: NonNullable<ReturnType<typeof findTimelineEventPacket>>;
}) {
  return (
    <section style={sideCardStyle} aria-labelledby="chronology-context-title">
      <div>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Chronology context
        </div>
        <h2 id="chronology-context-title" style={smallHeadingStyle}>
          Neighboring events
        </h2>
      </div>
      <NeighborEvent label="Previous" event={packet.previousEvent} />
      <NeighborEvent label="Current" event={packet.event} current />
      <NeighborEvent label="Next" event={packet.nextEvent} />
    </section>
  );
}

function NeighborEvent({
  label,
  event,
  current = false,
}: {
  label: string;
  event: CaseTimelineEvent | null;
  current?: boolean;
}) {
  if (!event) {
    return (
      <div style={neighborStyle}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          No adjacent event.
        </p>
      </div>
    );
  }

  const content = (
    <>
      <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
        {label} / {formatDate(event.date)}
      </div>
      <div style={{ color: "var(--text)", lineHeight: 1.35 }}>{event.title}</div>
    </>
  );

  if (current) {
    return <div style={{ ...neighborStyle, borderColor: "var(--border-strong)" }}>{content}</div>;
  }

  return (
    <Link href={timelineEventPacketHref(event)} style={neighborLinkStyle}>
      {content}
    </Link>
  );
}

function safeExternalSources(event: CaseTimelineEvent): string[] {
  return Array.from(
    new Set(
      event.sourceExternal
        .map((url) => normalizeHttpUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

function hostLabel(url: string): string {
  return new URL(url).host.replace(/^www\./, "");
}

function labelFromSlug(value: string): string {
  return (
    ACRONYM_LABELS[value] ??
    value
    .split("-")
    .filter(Boolean)
    .map(
      (part) =>
        ACRONYM_LABELS[part] ??
        `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
    )
    .join(" ")
  );
}

function hasChildren(children: ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : Boolean(children);
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

const breadcrumbStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  marginBottom: 26,
};

const heroStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
  gap: 28,
  alignItems: "start",
  paddingBottom: 34,
  borderBottom: "1px solid var(--border)",
  marginBottom: 40,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(2rem, 1.45rem + 1.35vw, 3.2rem)",
  lineHeight: 1.08,
  letterSpacing: 0,
  maxWidth: "18ch",
  marginTop: 8,
  marginBottom: 14,
};

const descriptionStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(1.04rem, 0.95rem + 0.25vw, 1.18rem)",
  lineHeight: 1.58,
  color: "var(--text)",
  maxWidth: "68ch",
  margin: 0,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 16,
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  marginTop: 20,
};

const primaryActionStyle: CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  padding: "8px 12px",
  fontWeight: 700,
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 16,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const statStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: 11,
  background: "color-mix(in srgb, var(--text) 3%, var(--surface))",
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 30,
  alignItems: "start",
};

const sourceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 14,
};

const relationshipGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 12,
};

const asideStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const sideCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: 16,
  display: "grid",
  gap: 12,
};

const smallHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.94rem",
  letterSpacing: 0,
  margin: 0,
};

const sourceLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 58,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 11px",
  color: "var(--text)",
  background: "var(--surface-2)",
  textDecoration: "none",
};

const sourceTitleStyle: CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 700,
  lineHeight: 1.35,
};

const sourceMetaStyle: CSSProperties = {
  display: "block",
  fontSize: "0.76rem",
  lineHeight: 1.35,
  marginTop: 3,
};

const chipStyle: CSSProperties = {
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 9px",
  color: "var(--text)",
  background: "var(--surface-2)",
  fontSize: "0.83rem",
  textDecoration: "none",
};

const neighborStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  padding: 11,
  display: "grid",
  gap: 6,
};

const neighborLinkStyle: CSSProperties = {
  ...neighborStyle,
  color: "inherit",
  textDecoration: "none",
};
