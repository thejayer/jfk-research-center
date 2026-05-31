import { describe, expect, it } from "vitest";
import type { CaseTimelineEvent } from "../api-types";
import {
  findTimelineEventPacket,
  findTimelineDocumentLink,
  findTimelineEventsForDocument,
  timelineEventHref,
  timelineEventPacketHref,
} from "../timeline-source-bridge";

const events: CaseTimelineEvent[] = [
  {
    id: "later",
    date: "1963-11-24",
    timeLocal: "11:21",
    title: "Later event",
    description: "Later source event",
    category: "death",
    relatedEntityIds: [],
    relatedTopicIds: [],
    sourceExternal: [],
    documentLinks: [
      { documentId: "wc-report-1964", title: "WC report", note: "Transfer source" },
    ],
    importance: 5,
  },
  {
    id: "earlier",
    date: "1963-11-22",
    timeLocal: "12:30",
    title: "Earlier event",
    description: "Earlier source event",
    category: "death",
    relatedEntityIds: [],
    relatedTopicIds: [],
    sourceExternal: [],
    documentLinks: [
      { documentId: "193887", title: "NAID reference", note: "Chronology source" },
    ],
    importance: 5,
  },
  {
    id: "unrelated",
    date: "1979-03-29",
    timeLocal: null,
    title: "Unrelated event",
    description: "Different document",
    category: "investigation",
    relatedEntityIds: [],
    relatedTopicIds: [],
    sourceExternal: [],
    documentLinks: [
      { documentId: "hsca-final-report", title: "HSCA report", note: null },
    ],
    importance: 4,
  },
];

describe("timeline source bridge", () => {
  it("finds timeline events by document id and NAID in chronological order", () => {
    const matches = findTimelineEventsForDocument(events, {
      id: "wc-report-1964",
      naid: "193887",
    });

    expect(matches.map((event) => event.id)).toEqual(["earlier", "later"]);
  });

  it("returns the matching document link for a timeline event", () => {
    const link = findTimelineDocumentLink(events[0], {
      id: "wc-report-1964",
      naid: "193887",
    });

    expect(link?.note).toBe("Transfer source");
  });

  it("builds a stable list-view timeline href", () => {
    expect(timelineEventHref({ id: "case-motorcade" })).toBe(
      "/timeline?view=list#case-motorcade",
    );
  });

  it("builds a stable source packet href", () => {
    expect(timelineEventPacketHref({ id: "case-motorcade" })).toBe(
      "/timeline/event/case-motorcade",
    );
  });

  it("finds a source packet event with chronological neighbors", () => {
    const packet = findTimelineEventPacket(events, "later");

    expect(packet?.event.id).toBe("later");
    expect(packet?.previousEvent?.id).toBe("earlier");
    expect(packet?.nextEvent?.id).toBe("unrelated");
    expect(packet?.index).toBe(2);
    expect(packet?.total).toBe(3);
  });

  it("returns null for a missing or blank source packet id", () => {
    expect(findTimelineEventPacket(events, "missing")).toBeNull();
    expect(findTimelineEventPacket(events, "   ")).toBeNull();
  });
});
