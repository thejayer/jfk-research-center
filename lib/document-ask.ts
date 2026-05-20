import type { DocumentDetail, MentionExcerpt } from "./api-types";
import {
  documentCitationRequirement,
  documentAskExcerptLimit,
  documentAskPassageLimit,
  refusalCitationRequirement,
  stopWords,
} from "./constants";
import { validateAskDraft, type AskDraftValidationIssue } from "./ask-guardrails";

export type DocumentAskCitation = {
  id: string;
  label: string;
  href: string;
  excerpt: string;
};

export type DocumentAskPromptInput = {
  question: string;
  documentId: string;
  documentTitle: string;
  retrievedDocumentIds: readonly string[];
  metadataContext: readonly string[];
  passages: readonly DocumentAskCitation[];
};

export type DocumentAskAnswer = {
  status: "answer" | "refusal";
  answer: string;
  citations: readonly DocumentAskCitation[];
  validationIssues: readonly AskDraftValidationIssue[];
};

type DocumentAskSource = {
  doc: DocumentDetail;
  mentions: readonly MentionExcerpt[];
  question: string;
};

/**
 * Builds the deterministic, document-only context used by the local ask panel.
 *
 * The returned input contains only the current document id, metadata strings,
 * and OCR passages already loaded for the document page. It does not broaden
 * retrieval to corpus search, semantic search, topics, or related records.
 */
export function buildDocumentAskPromptInput({
  doc,
  mentions,
  question,
}: DocumentAskSource): DocumentAskPromptInput {
  const normalizedQuestion = question.trim();
  const tokens = tokenize(normalizedQuestion);
  const useDefaultPassages = isGenericPassageQuestion(normalizedQuestion);
  const rankedPassages = mentions
    .map((mention) => ({
      mention,
      score: scoreMention(mention, tokens),
    }))
    .filter((item) =>
      tokens.length > 0 && !useDefaultPassages
        ? item.score > 0
        : item.mention.source === "ocr",
    )
    .sort((a, b) => b.score - a.score || mentionOrder(a.mention) - mentionOrder(b.mention))
    .slice(0, documentAskPassageLimit)
    .map(({ mention }) => mentionCitation(mention, doc.id));

  return {
    question: normalizedQuestion,
    documentId: doc.id,
    documentTitle: doc.title,
    retrievedDocumentIds: [doc.id],
    metadataContext: metadataContext(doc),
    passages: rankedPassages,
  };
}

/**
 * Produces a scoped local answer or uncited refusal from current-document data.
 *
 * This helper is intentionally deterministic. It proves the document-level ask
 * contract and guardrail wiring before any model-backed `/ask` endpoint exists.
 */
export function answerDocumentQuestion(input: DocumentAskSource): DocumentAskAnswer {
  const promptInput = buildDocumentAskPromptInput(input);
  if (!promptInput.question) {
    return refusal(
      "Ask a question about this record. The panel will only use this document's metadata and OCR passages.",
      promptInput.retrievedDocumentIds,
    );
  }

  const metadataHit = metadataSupportsQuestion(
    promptInput.metadataContext,
    promptInput.question,
  );
  const hasEvidence = promptInput.passages.length > 0 || metadataHit;

  if (!hasEvidence) {
    return refusal(
      "I cannot answer that from this record alone. The current document context does not contain enough matching metadata or OCR evidence.",
      promptInput.retrievedDocumentIds,
    );
  }

  const citations = promptInput.passages.length > 0
    ? promptInput.passages
    : [
        {
          id: "metadata",
          label: "Document metadata",
          href: "#metadata",
          excerpt: promptInput.metadataContext[0] ?? promptInput.documentTitle,
        },
      ];
  const leadEvidence = citations[0];
  const answer =
    `Within this document, the strongest available evidence is: "${leadEvidence.excerpt}" ` +
    `This is a document-scoped answer for ${promptInput.documentTitle}, not a corpus-wide conclusion. ` +
    `[doc:${promptInput.documentId}]`;
  const validationIssues = validateAskDraft({
    answer,
    retrievedDocumentIds: promptInput.retrievedDocumentIds,
    expectedBehavior: "answer_with_citations",
    citationRequirement: documentCitationRequirement,
  });

  return {
    status: "answer",
    answer,
    citations,
    validationIssues,
  };
}

function refusal(
  answer: string,
  retrievedDocumentIds: readonly string[],
): DocumentAskAnswer {
  return {
    status: "refusal",
    answer,
    citations: [],
    validationIssues: validateAskDraft({
      answer,
      retrievedDocumentIds,
      expectedBehavior: "refuse",
      citationRequirement: refusalCitationRequirement,
    }),
  };
}

function metadataContext(doc: DocumentDetail): string[] {
  return [
    doc.title,
    doc.description,
    doc.agency,
    doc.recordGroup,
    doc.collectionName,
    doc.citation,
    doc.ocrExcerpt,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function metadataSupportsQuestion(
  metadata: readonly string[],
  question: string,
): boolean {
  if (isGenericSourceQuestion(question)) return metadata.length > 0;
  const tokens = tokenize(question);
  if (tokens.length === 0) return metadata.length > 0;
  return metadata.some((value) => scoreText(value, tokens) > 0);
}

function mentionCitation(
  mention: MentionExcerpt,
  documentId: string,
): DocumentAskCitation {
  return {
    id: documentId,
    label:
      mention.chunkOrder != null
        ? `Chunk ${mention.chunkOrder}`
        : mention.pageLabel ?? "Matched passage",
    href:
      mention.chunkOrder != null
        ? `#chunk-${mention.chunkOrder}`
        : `#chunk-${mention.id}`,
    excerpt: compactText(mention.excerpt),
  };
}

function scoreMention(mention: MentionExcerpt, tokens: readonly string[]): number {
  const haystack = [
    mention.excerpt,
    mention.pageLabel,
    mention.source,
    ...mention.matchedTerms,
  ].join(" ");
  const tokenScore = scoreText(haystack, tokens);
  if (tokens.length > 0 && tokenScore === 0) return 0;
  return tokenScore + (mention.source === "ocr" ? 0.25 : 0);
}

function scoreText(value: string, tokens: readonly string[]): number {
  const words = new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return tokens.reduce(
    (score, token) => score + (words.has(token) ? 1 : 0),
    0,
  );
}

function tokenize(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g);
  if (!tokens) return [];
  return Array.from(new Set(tokens.filter((token) => !stopWords.has(token))));
}

function isGenericPassageQuestion(question: string): boolean {
  return /\b(loaded passage|passage|ocr|most relevant|relevant passage)\b/i.test(
    question,
  );
}

function isGenericSourceQuestion(question: string): boolean {
  return /\b(source details|metadata|citation|verify|source)\b/i.test(question);
}

function mentionOrder(mention: MentionExcerpt): number {
  return mention.chunkOrder ?? Number.MAX_SAFE_INTEGER;
}

function compactText(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= documentAskExcerptLimit) return compact;
  return `${compact.slice(0, documentAskExcerptLimit - 1).trimEnd()}...`;
}
