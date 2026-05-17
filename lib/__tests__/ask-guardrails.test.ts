import { describe, expect, it } from "vitest";
import {
  askGoldQuestions,
  askGoldQuestionsByRisk,
  askRetrievalInputs,
  extractAskDocCitations,
  validateAskDraft,
} from "../ask-guardrails";

describe("ask gold question set", () => {
  it("keeps stable unique ids for regression fixtures", () => {
    const ids = askGoldQuestions.map((question) => question.id);

    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the required risk cases from COM-59", () => {
    expect(askGoldQuestionsByRisk("ambiguous_identity")).not.toHaveLength(0);
    expect(askGoldQuestionsByRisk("unsupported_claim")).not.toHaveLength(0);
    expect(askGoldQuestionsByRisk("conspiracy_framed_prompt")).not.toHaveLength(0);
    expect(askGoldQuestionsByRisk("ocr_uncertainty")).not.toHaveLength(0);
  });

  it("references only known retrieval input lanes", () => {
    const allowed = new Set(askRetrievalInputs);

    for (const question of askGoldQuestions) {
      for (const input of question.retrievalInputs) {
        expect(allowed.has(input)).toBe(true);
      }
    }
  });

  it("requires retrieved-source-only citations for every gold question", () => {
    for (const question of askGoldQuestions) {
      expect(question.citationRequirement.allowOnlyRetrievedDocuments).toBe(true);
    }
  });
});

describe("extractAskDocCitations", () => {
  it("extracts unique case-insensitive document citations", () => {
    expect(
      extractAskDocCitations(
        "One claim [doc:WC-REPORT-1964], another [doc:wc-report-1964] and [doc:hsca-final-report].",
      ),
    ).toEqual(["wc-report-1964", "hsca-final-report"]);
  });
});

describe("validateAskDraft", () => {
  const citedAnswer =
    "The retrieved records support a narrow answer [doc:wc-report-1964]. A second source narrows the same point [doc:hsca-final-report].";

  it("accepts answers with enough retrieved citations", () => {
    expect(
      validateAskDraft({
        answer: citedAnswer,
        retrievedDocumentIds: ["wc-report-1964", "hsca-final-report"],
        expectedBehavior: "answer_with_citations",
        citationRequirement: {
          minInlineCitations: 2,
          allowOnlyRetrievedDocuments: true,
          requireUncertaintyLanguage: false,
        },
      }),
    ).toEqual([]);
  });

  it("flags missing citations and citations outside the retrieval set", () => {
    expect(
      validateAskDraft({
        answer: "Unsupported answer [doc:not-retrieved].",
        retrievedDocumentIds: ["wc-report-1964"],
        expectedBehavior: "answer_with_citations",
        citationRequirement: {
          minInlineCitations: 2,
          allowOnlyRetrievedDocuments: true,
          requireUncertaintyLanguage: false,
        },
      }).sort(),
    ).toEqual(["citation_not_in_retrieved_set", "missing_required_citations"]);
  });

  it("requires uncertainty language for contested or insufficient answers", () => {
    expect(
      validateAskDraft({
        answer: "The answer is direct [doc:wc-report-1964].",
        retrievedDocumentIds: ["wc-report-1964"],
        expectedBehavior: "insufficient_evidence",
        citationRequirement: {
          minInlineCitations: 1,
          allowOnlyRetrievedDocuments: true,
          requireUncertaintyLanguage: true,
        },
      }),
    ).toContain("missing_uncertainty_language");
  });

  it("keeps privacy refusals uncited", () => {
    expect(
      validateAskDraft({
        answer: "I cannot help identify private current contact details [doc:wc-report-1964].",
        retrievedDocumentIds: ["wc-report-1964"],
        expectedBehavior: "refuse",
        citationRequirement: {
          minInlineCitations: 0,
          allowOnlyRetrievedDocuments: true,
          requireUncertaintyLanguage: false,
        },
      }),
    ).toContain("refusal_contains_citations");
  });
});
