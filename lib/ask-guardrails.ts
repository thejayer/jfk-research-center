import { askGoldQuestions } from "./constants";

export {
  askCitationRequirementRefusal,
  askCitationRequirementStrict,
  askCitationRequirementUncertain,
  askGoldQuestions,
  askRetrievalInputs,
} from "./constants";

/** Retrieval lanes that the future /ask evaluator may feed into an answer. */
export type AskRetrievalInput =
  | "documents"
  | "ocr_chunks"
  | "semantic_chunks"
  | "topics"
  | "entities"
  | "timeline"
  | "evidence"
  | "bibliography"
  | "open_questions";

/** High-level behavior expected from a gold question or validated draft. */
export type AskExpectedBehavior =
  | "answer_with_citations"
  | "insufficient_evidence"
  | "refuse";

/** Risk coverage tags used to make the gold set auditable. */
export type AskRiskTag =
  | "ambiguous_identity"
  | "citation_density"
  | "conspiracy_framed_prompt"
  | "conflicting_sources"
  | "evidence_chain"
  | "ocr_uncertainty"
  | "unsupported_claim";

/**
 * Citation floor for an answer.
 *
 * `minInlineCitations` is the required count of unique `[doc:id]` citations,
 * `allowOnlyRetrievedDocuments` restricts citations to supplied context, and
 * `requireUncertaintyLanguage` requires caveats for contested/weak evidence.
 */
export type AskCitationRequirement = {
  minInlineCitations: number;
  allowOnlyRetrievedDocuments: boolean;
  requireUncertaintyLanguage: boolean;
};

/**
 * A regression prompt for the future /ask evaluator.
 *
 * `retrievalInputs` must use known retrieval lanes, `preferredSourceIds` are
 * target documents to retrieve when possible, and `mustAvoid` lists answer
 * failures that reviewers should reject.
 */
export type AskGoldQuestion = {
  id: string;
  question: string;
  intent: string;
  expectedBehavior: AskExpectedBehavior;
  retrievalInputs: readonly AskRetrievalInput[];
  riskTags: readonly AskRiskTag[];
  citationRequirement: AskCitationRequirement;
  preferredSourceIds: readonly string[];
  mustAvoid: readonly string[];
};

/** Inputs needed to validate a drafted /ask answer deterministically. */
export type AskDraftValidationInput = {
  answer: string;
  retrievedDocumentIds: readonly string[];
  citationRequirement: AskCitationRequirement;
  expectedBehavior: AskExpectedBehavior;
};

/** Machine-readable issue codes emitted by validateAskDraft. */
export type AskDraftValidationIssue =
  | "missing_required_citations"
  | "citation_not_in_retrieved_set"
  | "missing_uncertainty_language"
  | "refusal_contains_citations"
  | "answer_claims_insufficient_evidence";

// Regex validators intentionally cover the deterministic floor only:
// citation tokens, uncertainty cues, and insufficient-evidence phrasing.
const DOC_CITATION_RE = /\[doc:([a-z0-9-]+)\]/gi;
const UNCERTAINTY_RE =
  /\b(uncertain|not clear|not enough evidence|insufficient evidence|contested|disputed|the retrieved records do not show)\b/i;
const INSUFFICIENT_RE = /\b(insufficient evidence|not enough evidence|do not show|cannot determine)\b/i;

/** Extracts unique lower-case `[doc:id]` citations from a drafted answer. */
export function extractAskDocCitations(answer: string): string[] {
  const citations = new Set<string>();
  for (const match of answer.matchAll(DOC_CITATION_RE)) {
    citations.add(match[1].toLowerCase());
  }
  return [...citations];
}

/**
 * Validates the deterministic citation/safety floor for a drafted /ask answer.
 *
 * Citations must match retrieved document ids when requested; uncertainty
 * language is regex-based; refusal answers must not include citations at all.
 */
export function validateAskDraft({
  answer,
  retrievedDocumentIds,
  citationRequirement,
  expectedBehavior,
}: AskDraftValidationInput): AskDraftValidationIssue[] {
  const issues = new Set<AskDraftValidationIssue>();
  const citations = extractAskDocCitations(answer);
  const retrieved = new Set(retrievedDocumentIds.map((id) => id.toLowerCase()));

  if (citations.length < citationRequirement.minInlineCitations) {
    issues.add("missing_required_citations");
  }

  if (
    citationRequirement.allowOnlyRetrievedDocuments &&
    citations.some((id) => !retrieved.has(id))
  ) {
    issues.add("citation_not_in_retrieved_set");
  }

  if (citationRequirement.requireUncertaintyLanguage && !UNCERTAINTY_RE.test(answer)) {
    issues.add("missing_uncertainty_language");
  }

  if (expectedBehavior === "refuse" && citations.length > 0) {
    issues.add("refusal_contains_citations");
  }

  if (
    expectedBehavior === "answer_with_citations" &&
    INSUFFICIENT_RE.test(answer) &&
    citations.length === 0
  ) {
    issues.add("answer_claims_insufficient_evidence");
  }

  return [...issues];
}

export function askGoldQuestionsByRisk(
  riskTag: AskRiskTag,
): readonly AskGoldQuestion[] {
  return askGoldQuestions.filter((question) => question.riskTags.includes(riskTag));
}
