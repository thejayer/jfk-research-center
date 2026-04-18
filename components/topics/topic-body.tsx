"use client";

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TopicDetail } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";

type Ai = NonNullable<TopicDetail["aiSummary"]>;

export function TopicBody({ topic }: { topic: TopicDetail }) {
  const summary = topic.aiSummary;
  const article = topic.aiArticle;
  const [mode, setMode] = useState<"summary" | "article">("summary");

  if (!summary && !article) {
    return (
      <p
        className="muted"
        style={{ maxWidth: "68ch", fontSize: "1rem", lineHeight: 1.65 }}
      >
        {topic.description}
      </p>
    );
  }

  return (
    <div style={{ maxWidth: "68ch" }}>
      {summary && article && (
        <SplitPill
          mode={mode}
          onChange={setMode}
          labels={{ summary: "Short summary", article: "Long-form analysis" }}
        />
      )}

      {mode === "summary" && summary && <SummaryBlock ai={summary} />}
      {mode === "article" && article && <ArticleBlock ai={article} />}

      {/* Fall back if only one is present */}
      {!summary && article && <ArticleBlock ai={article} />}
      {summary && !article && <SummaryBlock ai={summary} />}
    </div>
  );
}

function SplitPill({
  mode,
  onChange,
  labels,
}: {
  mode: "summary" | "article";
  onChange: (m: "summary" | "article") => void;
  labels: { summary: string; article: string };
}) {
  const opts: Array<"summary" | "article"> = ["summary", "article"];
  return (
    <div
      role="tablist"
      aria-label="Content depth"
      style={{
        display: "inline-flex",
        padding: 3,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        background: "var(--surface)",
        marginBottom: 18,
      }}
    >
      {opts.map((o) => {
        const active = o === mode;
        return (
          <button
            key={o}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: active ? 500 : 400,
              letterSpacing: "0.01em",
              background: active ? "var(--text)" : "transparent",
              color: active ? "var(--bg)" : "var(--text-muted)",
              transition: "all var(--motion)",
            }}
          >
            {labels[o]}
          </button>
        );
      })}
    </div>
  );
}

function SummaryBlock({ ai }: { ai: Ai }) {
  const paragraphs = splitParagraphs(ai.text);
  const generated = toISODate(ai.generatedAt);
  return (
    <div>
      <AiChip label="AI-generated summary" />
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: "1rem",
            lineHeight: 1.65,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          {p}
        </p>
      ))}
      <AiFooter
        model={ai.model}
        docCount={ai.sourceDocCount}
        date={generated}
      />
    </div>
  );
}

function ArticleBlock({ ai }: { ai: Ai }) {
  const { paragraphs, citationMap } = useMemo(
    () => parseArticle(ai.text),
    [ai.text],
  );
  const generated = toISODate(ai.generatedAt);
  return (
    <div>
      <AiChip label="AI-generated analysis" />
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
      <AiFooter
        model={ai.model}
        docCount={ai.sourceDocCount}
        date={generated}
        extra={`${citationMap.size} inline citations → linked documents`}
      />
    </div>
  );
}

function AiChip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: "0.72rem",
        letterSpacing: "0.08em",
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
      {label}
    </div>
  );
}

function AiFooter({
  model,
  docCount,
  date,
  extra,
}: {
  model: string;
  docCount: number;
  date: string;
  extra?: string;
}) {
  return (
    <div
      className="muted"
      style={{
        fontSize: "0.78rem",
        marginTop: 14,
        letterSpacing: "0.01em",
        lineHeight: 1.5,
      }}
    >
      Synthesized by {model} from {formatNumber(docCount)} records on {date}.
      May contain inaccuracies — cross-check with the primary documents below.
      {extra && <> &nbsp;·&nbsp; {extra}</>}
      &nbsp;·&nbsp;
      <a href="/about/methodology">Methodology &rarr;</a>
    </div>
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function toISODate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse article text into paragraphs of ReactNodes, replacing
 * [doc:<id>] tokens with numbered superscript links. Citation numbers
 * are assigned in order of first appearance and deduped per doc_id.
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
