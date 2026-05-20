"use client";

import {
  Fragment,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type { DocumentDetail, MentionExcerpt } from "@/lib/api-types";
import {
  answerDocumentQuestion,
  type DocumentAskAnswer,
  type DocumentAskCitation,
} from "@/lib/document-ask";

export function DocumentAskPanel({
  doc,
  mentions,
}: {
  doc: DocumentDetail;
  mentions: MentionExcerpt[];
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<DocumentAskAnswer | null>(null);
  const suggestions = useMemo(() => buildSuggestions(doc, mentions), [doc, mentions]);
  const limitedContext = !doc.hasOcr || mentions.length === 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(answerDocumentQuestion({ doc, mentions, question }));
  }

  function askSuggested(nextQuestion: string) {
    setQuestion(nextQuestion);
    setResult(answerDocumentQuestion({ doc, mentions, question: nextQuestion }));
  }

  return (
    <section
      id="ask-this-document"
      aria-labelledby="ask-this-document-title"
      style={panelStyle}
    >
      <div style={headerStyle}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Ask this document
          </div>
          <h2 id="ask-this-document-title" style={titleStyle}>
            Current-record Q&A
          </h2>
        </div>
        <span style={scopeBadgeStyle}>Document scoped</span>
      </div>

      <p className="muted" style={descriptionStyle}>
        Ask a narrow question while reading. This panel only uses this record's
        metadata and loaded OCR passage anchors; unsupported questions refuse
        instead of reaching across the archive.
      </p>

      {limitedContext && (
        <div role="note" style={noticeStyle}>
          {doc.hasOcr
            ? "Only a small set of passage anchors is loaded for this record, so answers may be limited."
            : "No OCR text is available for this record. Answers can only use metadata and source details."}
        </div>
      )}

      <form onSubmit={submit} style={formStyle}>
        <label htmlFor="document-ask-question" className="eyebrow">
          Question
        </label>
        <textarea
          id="document-ask-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What does this record say about Oswald?"
          rows={3}
          style={textareaStyle}
        />
        <button type="submit" style={buttonStyle}>
          Ask current document
        </button>
      </form>

      <div aria-label="Suggested document questions" style={suggestionsStyle}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => askSuggested(suggestion)}
            style={suggestionStyle}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {result && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...answerStyle,
            borderColor:
              result.status === "answer" ? "var(--border)" : "var(--border-strong)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {result.status === "answer" ? "Scoped answer" : "Scoped refusal"}
          </div>
          <p style={answerTextStyle}>
            {renderAnswerWithCitations(result.answer, result.citations)}
          </p>
          {result.validationIssues.length > 0 && (
            <p className="muted" style={validationStyle}>
              Guardrail check flagged: {result.validationIssues.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Mirrors the topic/open-question article citation treatment: [doc:id] tokens
 * become numbered superscript links, but href/title text come from the scoped
 * citation entries so document-ask links target the exact passage or metadata.
 */
function renderAnswerWithCitations(
  answer: string,
  citations: readonly DocumentAskCitation[],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const citationById = new Map<string, DocumentAskCitation>();
  for (const citation of citations) {
    if (!citationById.has(citation.id)) citationById.set(citation.id, citation);
    const lowerId = citation.id.toLowerCase();
    if (!citationById.has(lowerId)) citationById.set(lowerId, citation);
  }
  const citationNumbers = new Map<string, number>();
  const tokenRe = /\[doc:([^\]]+)\]/g;
  let lastIdx = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(answer)) !== null) {
    const before = answer.slice(lastIdx, match.index);
    if (before) nodes.push(before);
    const rawId = match[1]!.trim();
    const citation = citationById.get(rawId) ?? citationById.get(rawId.toLowerCase());
    if (!citation) {
      nodes.push(match[0]);
    } else {
      let number = citationNumbers.get(rawId);
      if (!number) {
        number = citationNumbers.size + 1;
        citationNumbers.set(rawId, number);
      }
      nodes.push(
        <Fragment key={`c-${key++}`}>
          <sup style={{ fontSize: "0.7em", lineHeight: 0 }}>
            <a
              href={citation.href}
              title={`${citation.label}: ${citation.excerpt}`}
              style={superscriptLinkStyle}
            >
              [{number}]
            </a>
          </sup>
        </Fragment>,
      );
    }
    lastIdx = match.index + match[0].length;
  }

  const tail = answer.slice(lastIdx);
  if (tail) nodes.push(tail);
  return nodes;
}

function buildSuggestions(
  doc: DocumentDetail,
  mentions: readonly MentionExcerpt[],
): string[] {
  const firstTerm = mentions.flatMap((mention) => mention.matchedTerms)[0];
  return [
    firstTerm ? `What does this record say about ${firstTerm}?` : null,
    "What source details should I verify?",
    doc.hasOcr ? "Which loaded passage is most relevant?" : "What can metadata tell me?",
  ].filter((value): value is string => Boolean(value));
}

const panelStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: "22px 24px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  lineHeight: 1.2,
  letterSpacing: 0,
};

const scopeBadgeStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "var(--accent)",
  background: "var(--accent-soft)",
};

const descriptionStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 0,
  maxWidth: "70ch",
  fontSize: "0.92rem",
  lineHeight: 1.55,
};

const noticeStyle: CSSProperties = {
  marginTop: 14,
  border: "1px dashed var(--border-strong)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-muted)",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 18,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  minHeight: 92,
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  background: "var(--bg)",
  color: "var(--text)",
  padding: "11px 12px",
  font: "inherit",
  lineHeight: 1.45,
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  background: "var(--accent-soft)",
  color: "var(--accent)",
  padding: "9px 13px",
  fontWeight: 700,
};

const suggestionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 14,
};

const suggestionStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface) 88%, var(--bg))",
  color: "var(--text)",
  padding: "6px 10px",
  fontSize: "0.78rem",
};

const answerStyle: CSSProperties = {
  marginTop: 18,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "color-mix(in srgb, var(--surface) 88%, var(--bg))",
  padding: "14px 15px",
};

const answerTextStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-serif)",
  fontSize: "1rem",
  lineHeight: 1.55,
  letterSpacing: 0,
};

const superscriptLinkStyle: CSSProperties = {
  padding: "0 3px",
  color: "var(--link, var(--text))",
  textDecoration: "none",
  borderBottom: "1px dotted currentColor",
};

const validationStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: "0.78rem",
};
