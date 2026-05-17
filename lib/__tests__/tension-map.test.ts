import { describe, expect, it } from "vitest";
import type { OpenQuestionsTopicResponse } from "../api-types";
import { buildTensionMap, normalizeTensionType } from "../tension-map";

const topics: OpenQuestionsTopicResponse[] = [
  {
    slug: "warren-commission",
    title: "Warren Commission",
    topicHref: "/topic/warren-commission",
    article: null,
    questionCount: 2,
    editorialFootnotes: [],
    cryptonyms: [],
    threads: [
      {
        id: "wc-1",
        question: "Which witness summaries changed?",
        summary: "Compare early summaries with later presentation.",
        tensionType: "contradiction",
        supportingDocIds: ["wc-report-1964", "wc-report-1964", "fbi-memo"],
        status: "open",
        resolutionText: null,
        resolutionCitationIds: [],
      },
      {
        id: "wc-2",
        question: "Which exhibit custody notes are missing?",
        summary: null,
        tensionType: "gap",
        supportingDocIds: ["wc-report-1964"],
        status: "partially_resolved",
        resolutionText: null,
        resolutionCitationIds: [],
      },
    ],
  },
  {
    slug: "hsca",
    title: "HSCA",
    topicHref: "/topic/hsca",
    article: null,
    questionCount: 1,
    editorialFootnotes: [],
    cryptonyms: [],
    threads: [
      {
        id: "hsca-1",
        question: "How should acoustic evidence be compared?",
        summary: null,
        tensionType: "contradiction",
        supportingDocIds: ["hsca-final-report"],
        status: "resolved",
        resolutionText: "Resolved in test data.",
        resolutionCitationIds: ["hsca-final-report"],
      },
    ],
  },
];

describe("tension map helpers", () => {
  it("normalizes empty tension labels to other", () => {
    expect(normalizeTensionType(null)).toBe("other");
    expect(normalizeTensionType("   ")).toBe("other");
    expect(normalizeTensionType("timing")).toBe("timing");
  });

  it("groups threads by tension type with source and status counts", () => {
    const groups = buildTensionMap(topics);
    const contradiction = groups.find((g) => g.tensionType === "contradiction");

    expect(groups.map((g) => g.tensionType)).toEqual([
      "contradiction",
      "gap",
    ]);
    expect(contradiction).toMatchObject({
      threadCount: 2,
      topicCount: 2,
      documentCount: 3,
      statusCounts: {
        open: 1,
        partially_resolved: 0,
        resolved: 1,
      },
    });
    expect(contradiction?.threads[0]?.id).toBe("wc-1");
    expect(contradiction?.threads[0]?.supportingDocIds).toEqual([
      "wc-report-1964",
      "fbi-memo",
    ]);
  });
});
