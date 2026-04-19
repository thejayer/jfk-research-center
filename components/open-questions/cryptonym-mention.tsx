"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { CryptonymEntry } from "@/lib/api-types";

/**
 * Detects cryptonym tokens in `text` and wraps each one in a small
 * popover that, on hover or focus, surfaces the canonical meaning,
 * status, and first public source from jfk_curated.cryptonym_glossary.
 *
 * Tokens are detected with the prefix-anchored CIA cryptonym shape
 * (AM, LI, ZR, LC, KU, OD, PB, MH, HT, GP) followed by 3+ uppercase
 * letters and an optional `-N` suffix. The match is intersected with
 * the supplied glossary so unknown tokens are left as plain text.
 *
 * Rendered inline. Safe to use anywhere a string of curated prose
 * appears (Open Questions thread cards, AI summary panels, etc.).
 */
export function CryptonymMention({
  text,
  glossary,
}: {
  text: string;
  glossary: CryptonymEntry[];
}) {
  const lookup = useMemo(() => {
    const m = new Map<string, CryptonymEntry>();
    for (const c of glossary) m.set(c.cryptonym.toUpperCase(), c);
    return m;
  }, [glossary]);

  if (lookup.size === 0) return <>{text}</>;

  const segments = useMemo(() => splitOnCryptonyms(text, lookup), [text, lookup]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <Tooltip key={i} entry={seg.entry} token={seg.value} />
        ),
      )}
    </>
  );
}

type Segment =
  | { kind: "text"; value: string }
  | { kind: "crypto"; value: string; entry: CryptonymEntry };

const TOKEN_RE = /\b(AM|LI|ZR|LC|KU|OD|PB|MH|HT|GP)[A-Z]{3,}(?:-\d+)?\b/g;

function splitOnCryptonyms(
  text: string,
  lookup: Map<string, CryptonymEntry>,
): Segment[] {
  const out: Segment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const tok = m[0];
    const entry = lookup.get(tok.toUpperCase());
    if (!entry) continue;
    const start = m.index ?? 0;
    if (start > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, start) });
    }
    out.push({ kind: "crypto", value: tok, entry });
    lastIndex = start + tok.length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

function Tooltip({
  entry,
  token,
}: {
  entry: CryptonymEntry;
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const statusLabel =
    entry.status === "declassified"
      ? "Declassified"
      : entry.status === "partial"
        ? "Partial"
        : "Unresolved";

  return (
    <span
      className="cryptonym"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="cryptonym-trigger"
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {token}
      </button>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className="cryptonym-popover"
        >
          <span className="cryptonym-popover-head">
            <span className="cryptonym-popover-token">{entry.cryptonym}</span>
            <span
              className={`cryptonym-status cryptonym-status-${entry.status}`}
            >
              {statusLabel}
            </span>
          </span>
          <span className="cryptonym-popover-body">{entry.meaning}</span>
          {entry.firstPublicSource && (
            <span className="cryptonym-popover-source">
              First publicly identified in: {entry.firstPublicSource}
            </span>
          )}
          {entry.relatedEntityIds.length > 0 && (
            <span className="cryptonym-popover-related">
              Related:&nbsp;
              {entry.relatedEntityIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && ", "}
                  <Link href={`/entity/${id}`}>{id}</Link>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
