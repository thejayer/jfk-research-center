import type {
  CaseTimelineEvent,
  DocumentDetail,
  TimelineDocumentLink,
} from "./api-types";

type DocumentIdentity = Pick<DocumentDetail, "id" | "naid">;

export function timelineEventHref(event: Pick<CaseTimelineEvent, "id">): string {
  return `/timeline?view=list#${encodeURIComponent(event.id)}`;
}

export function findTimelineEventsForDocument(
  events: readonly CaseTimelineEvent[],
  document: DocumentIdentity,
): CaseTimelineEvent[] {
  const identities = new Set(
    [document.id, document.naid]
      .map((value) => normalizeDocumentIdentity(value))
      .filter((value): value is string => Boolean(value)),
  );

  if (identities.size === 0) return [];

  return events
    .filter((event) =>
      event.documentLinks.some((link) =>
        identities.has(normalizeDocumentIdentity(link.documentId) ?? ""),
      ),
    )
    .sort(compareTimelineEvents);
}

export function findTimelineDocumentLink(
  event: Pick<CaseTimelineEvent, "documentLinks">,
  document: DocumentIdentity,
): TimelineDocumentLink | null {
  const identities = new Set(
    [document.id, document.naid]
      .map((value) => normalizeDocumentIdentity(value))
      .filter((value): value is string => Boolean(value)),
  );

  return (
    event.documentLinks.find((link) =>
      identities.has(normalizeDocumentIdentity(link.documentId) ?? ""),
    ) ?? null
  );
}

function compareTimelineEvents(a: CaseTimelineEvent, b: CaseTimelineEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const timeDelta = (a.timeLocal ?? "").localeCompare(b.timeLocal ?? "");
  if (timeDelta !== 0) return timeDelta;
  return a.id.localeCompare(b.id);
}

function normalizeDocumentIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
