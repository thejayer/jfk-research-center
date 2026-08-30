import { describe, expect, it } from "vitest";
import type { DocumentDetail, MentionExcerpt } from "../api-types";
import { documentAskPassageLimit } from "../constants";
import {
  answerDocumentQuestion,
  buildDocumentAskPromptInput,
} from "../document-ask";

describe("document ask helpers", () => {
  it("builds prompt input from the current document only", () => {
    const input = buildDocumentAskPromptInput({
      doc: document(),
      mentions: [
        mention({
          id: "m1",
          chunkOrder: 4,
          excerpt:
            "Nosenko stated the KGB file on Oswald contained routine surveillance traffic and no operational tasking.",
        }),
        mention({
          id: "m2",
          chunkOrder: 8,
          excerpt: "A secondary passage about Mexico City cable timing.",
          matchedTerms: ["Mexico City"],
        }),
      ],
      question: "Did Nosenko describe KGB operational tasking?",
    });

    expect(input.documentId).toBe("nosenko-kgb-oswald-file");
    expect(input.retrievedDocumentIds).toEqual(["nosenko-kgb-oswald-file"]);
    expect(input.passages[0]).toMatchObject({
      id: "nosenko-kgb-oswald-file",
      href: "/document/nosenko-kgb-oswald-file?chunk=4#chunk-4",
      label: "p. 1 (chunk 4)",
    });
    expect(input.passages).toHaveLength(1);
  });

  it("returns a document-scoped cited answer when the current record supports it", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          excerpt:
            "Nosenko stated the KGB file on Oswald contained routine surveillance traffic and no operational tasking.",
        }),
      ],
      question: "Did Nosenko describe KGB operational tasking?",
    });

    expect(answer.status).toBe("answer");
    expect(answer.answer).toContain("[doc:nosenko-kgb-oswald-file]");
    expect(answer.answer).toContain("not a corpus-wide conclusion");
    expect(answer.citations).toHaveLength(1);
    expect(answer.validationIssues).toEqual([]);
  });

  it("refuses without citations when the current record does not contain enough evidence", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          excerpt:
            "Nosenko stated the KGB file on Oswald contained routine surveillance traffic.",
        }),
      ],
      question: "What does this prove about Ruby?",
    });

    expect(answer.status).toBe("refusal");
    expect(answer.answer).not.toContain("[doc:");
    expect(answer.citations).toEqual([]);
    expect(answer.validationIssues).toEqual([]);
  });

  it("does not treat generic grammar words as evidence", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          excerpt:
            "Nosenko stated the KGB file on Oswald contained routine surveillance traffic.",
        }),
      ],
      question: "What was the weather in Chicago yesterday?",
    });

    expect(answer.status).toBe("refusal");
    expect(answer.answer).not.toContain("[doc:");
  });

  it("does not treat substring-only token matches as evidence", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          excerpt:
            "The transcription says cheruby artifact in a damaged scan.",
          matchedTerms: ["cheruby"],
        }),
      ],
      question: "What does this say about Ruby?",
    });

    expect(answer.status).toBe("refusal");
    expect(answer.answer).not.toContain("[doc:");
  });

  it("supports generic passage questions with loaded OCR context", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          excerpt:
            "Nosenko stated the KGB file on Oswald contained routine surveillance traffic.",
        }),
      ],
      question: "Which loaded passage is most relevant?",
    });

    expect(answer.status).toBe("answer");
    expect(answer.citations[0]).toMatchObject({
      href: "/document/nosenko-kgb-oswald-file?chunk=1#chunk-1",
      label: "p. 1 (chunk 1)",
    });
    expect(answer.validationIssues).toEqual([]);
  });

  it("caps passage context before building answers", () => {
    const input = buildDocumentAskPromptInput({
      doc: document(),
      mentions: Array.from({ length: documentAskPassageLimit + 2 }, (_, index) =>
        mention({
          id: `m-${index + 1}`,
          chunkOrder: index + 1,
          excerpt: `Oswald passage ${index + 1} mentioning KGB records.`,
        }),
      ),
      question: "What does this document say about KGB records?",
    });

    expect(input.passages).toHaveLength(documentAskPassageLimit);
    expect(input.passages.map((passage) => passage.href)).toEqual(
      Array.from(
        { length: documentAskPassageLimit },
        (_, index) =>
          `/document/nosenko-kgb-oswald-file?chunk=${index + 1}#chunk-${index + 1}`,
      ),
    );
  });

  it("does not treat description leftovers as a search of the whole file", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          source: "description",
          excerpt: "BULKY ENC · Release: Redact",
          matchedTerms: ["ARRB", "CIA", "FBI"],
          chunkOrder: null,
        }),
      ],
      question: "What does this say about ARRB?",
    });

    expect(answer.status).toBe("refusal");
    expect(answer.answer).toContain("does not search the rest of the file");
  });

  it("answers from the loaded OCR page instead of the cover-sheet description", () => {
    const answer = answerDocumentQuestion({
      doc: document(),
      mentions: [
        mention({
          source: "description",
          excerpt: "BULKY ENC · Release: Redact",
          matchedTerms: ["ARRB"],
          chunkOrder: null,
        }),
      ],
      loadedPage: {
        pageLabel: "p. 40",
        text: "The ARRB requested the Bureau produce the remaining bulky exhibits.",
        chunkOrder: 40,
      },
      question: "What does this record say about ARRB?",
    });

    expect(answer.status).toBe("answer");
    expect(answer.answer).toContain("ARRB requested the Bureau");
    expect(answer.citations[0]).toMatchObject({
      href: "/document/nosenko-kgb-oswald-file?chunk=40#chunk-40",
      label: "p. 40 (chunk 40)",
    });
  });

  it("does not cite an earlier SSR page after the loaded page changes", () => {
    const input = buildDocumentAskPromptInput({
      doc: {
        ...document(),
        ocrExcerpt: "Cover sheet about Nosenko and KGB operational tasking.",
      },
      mentions: [
        mention({
          chunkOrder: 0,
          excerpt: "Cover sheet about Nosenko and KGB operational tasking.",
        }),
      ],
      loadedPage: {
        pageLabel: "p. 2",
        text: "July 7 1971 memorandum to Mr. Sullivan regarding MEDBURG.",
        chunkOrder: 1,
      },
      question: "Did Nosenko describe KGB operational tasking?",
    });

    expect(input.passages).toEqual([]);
    expect(input.metadataContext.join(" ")).not.toContain("Cover sheet");
  });
});

function document(): DocumentDetail {
  return {
    id: "nosenko-kgb-oswald-file",
    naid: "12345",
    title: "Nosenko KGB Oswald file",
    description: "Document about Nosenko's description of the Oswald file.",
    href: "/document/nosenko-kgb-oswald-file",
    tags: [],
    agency: "CIA",
    recordGroup: "Record Group 263",
    collectionName: "JFK Assassination Records Collection",
    hasOcr: true,
    chunkCount: 4,
  };
}

function mention(overrides: Partial<MentionExcerpt>): MentionExcerpt {
  return {
    id: overrides.id ?? "m1",
    documentId: "nosenko-kgb-oswald-file",
    documentTitle: "Nosenko KGB Oswald file",
    documentHref: "/document/nosenko-kgb-oswald-file",
    excerpt: overrides.excerpt ?? "Nosenko stated the KGB file had no tasking.",
    matchedTerms: overrides.matchedTerms ?? ["Nosenko", "KGB", "Oswald"],
    confidence: "high",
    source: overrides.source ?? "ocr",
    pageLabel: overrides.pageLabel ?? "p. 1",
    chunkOrder: overrides.chunkOrder !== undefined ? overrides.chunkOrder : 1,
  };
}
