import Link from "next/link";
import type {
  CaseTimelineCategory,
  CaseTimelineEvent,
  DocumentDetail,
} from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import {
  findTimelineDocumentLink,
  timelineEventHref,
} from "@/lib/timeline-source-bridge";

const CATEGORY_LABELS: Record<CaseTimelineCategory, string> = {
  biographical: "Biographical",
  operational: "Operational",
  investigation: "Investigation",
  release: "Release",
  death: "Death",
};

/**
 * Renders up to six chronologically ordered timeline events for a document.
 *
 * @param doc Current document; source-role notes are resolved by matching its id/NAID to each event document link.
 * @param events Ascending timeline events already matched to the document.
 */
export function DocumentTimelineBridge({
  doc,
  events,
}: {
  doc: DocumentDetail;
  events: CaseTimelineEvent[];
}) {
  if (events.length === 0) return null;

  return (
    <section
      id="timeline-moments"
      aria-label="Timeline moments supported by this record"
      style={{
        marginTop: 34,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 20,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Chronology bridge
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.45rem",
          lineHeight: 1.18,
          letterSpacing: 0,
          marginBottom: 8,
        }}
      >
        Timeline moments this source helps explain.
      </h2>
      <p className="muted" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
        These chronology entries cite this record directly. Open the event to
        move from document reading back into the case timeline.
      </p>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 10,
        }}
      >
        {events.slice(0, 6).map((event) => {
          const link = findTimelineDocumentLink(event, doc);
          return (
            <li key={event.id}>
              <Link
                href={timelineEventHref(event)}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "13px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                <span
                  className="muted num"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: "0.76rem",
                  }}
                >
                  <span>{formatDate(event.date)}</span>
                  {event.timeLocal && <span>{event.timeLocal}</span>}
                  <span>{CATEGORY_LABELS[event.category]}</span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.08rem",
                    lineHeight: 1.25,
                    letterSpacing: 0,
                  }}
                >
                  {event.title}
                </span>
                {link?.note && (
                  <span className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                    Source role: {link.note}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
