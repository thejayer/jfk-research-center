"use client";

import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import type { TopicReleaseAddendum } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

export function ReleaseAddendum({ addendum }: { addendum: TopicReleaseAddendum }) {
  const { paragraphs, citationMap } = useMemo(
    () => parseArticle(addendum.text),
    [addendum.text],
  );
  const generated = toISODate(addendum.generatedAt);

  return (
    <article
      style={{
        marginTop: 28,
        padding: "26px 28px 22px",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        maxWidth: "72ch",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.7rem",
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          padding: "3px 9px",
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          marginBottom: 14,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text-muted)",
          }}
        />
        Grounded in OCR · {addendum.releaseLabel}
      </div>

      {paragraphs.map((nodes, i) => (
        <p
          key={i}
          style={{
            fontSize: "1rem",
            lineHeight: 1.7,
            color: "var(--text)",
            marginBottom: 14,
          }}
        >
          {nodes}
        </p>
      ))}

      <div
        className="muted"
        style={{
          fontSize: "0.78rem",
          marginTop: 14,
          letterSpacing: "0.01em",
          lineHeight: 1.5,
        }}
      >
        Synthesized by {addendum.model} from{" "}
        {formatNumber(addendum.sourceDocCount)} {addendum.releaseLabel}{" "}
        records on {generated}, with prompts grounded in OCR excerpts.
        {citationMap.size > 0 && (
          <>
            {" "}
            &nbsp;·&nbsp; {citationMap.size} inline citations &rarr; linked
            documents
          </>
        )}
        &nbsp;·&nbsp;
        <a href="/about/methodology">Methodology &rarr;</a>
      </div>
    </article>
  );
}

function toISODate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Parses [doc:<id>] tokens to numbered superscript links. Mirrors the helper
 * in topic-body.tsx; kept duplicated so the two components can diverge
 * (citation density and footer copy already differ).
 */
function parseArticle(text: string): {
  paragraphs: ReactNode[][];
  citationMap: Map<string, number>;
} {
  const citationMap = new Map<string, number>();
  const paragraphs: ReactNode[][] = [];
  const paraTexts = splitParagraphs(text);
  const tokenRe = /\[doc:([^\]]+)\]/g;

  for (const p of paraTexts) {
    const nodes: ReactNode[] = [];
    let lastIdx = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(p)) !== null) {
      const before = p.slice(lastIdx, m.index);
      if (before) nodes.push(before);
      const rawId = m[1]!.trim();
      let n = citationMap.get(rawId);
      if (!n) {
        n = citationMap.size + 1;
        citationMap.set(rawId, n);
      }
      nodes.push(
        <Fragment key={`c-${key++}`}>
          <sup style={{ fontSize: "0.7em", lineHeight: 0 }}>
            <a
              href={`/document/${encodeURIComponent(rawId)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Source: ${rawId} (opens in new tab)`}
              style={{
                padding: "0 3px",
                color: "var(--link, var(--text))",
                textDecoration: "none",
                borderBottom: "1px dotted currentColor",
              }}
            >
              [{n}]
            </a>
          </sup>
        </Fragment>,
      );
      lastIdx = m.index + m[0].length;
    }
    const tail = p.slice(lastIdx);
    if (tail) nodes.push(tail);
    paragraphs.push(nodes);
  }

  return { paragraphs, citationMap };
}
