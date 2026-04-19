"use client";

import { useMemo, useState } from "react";
import { formatCitation, type CitationFormats, type CitationInput } from "@/lib/citations";

type Style = keyof CitationFormats;

const STYLES: Array<{ key: Style; label: string }> = [
  { key: "bluebook", label: "Bluebook" },
  { key: "chicago", label: "Chicago" },
  { key: "apa", label: "APA" },
];

/**
 * Per-chunk action affordances on an OCR mention card.
 *
 * - Copy-link: writes `${origin}/document/{naid}#chunk-N` to the clipboard.
 * - Cite: opens a small popover with chunk-scoped Bluebook/Chicago/APA
 *   formats. The chunk anchor is baked into each format by lib/citations.
 *
 * Both controls are visually inert until the parent .ocr-chunk is hovered
 * or focused, to keep the OCR text the visual focus of the panel.
 *
 * Citation strings are formatted on the client so the deep-link URL can
 * reference the actual `window.location.origin` rather than a server-side
 * placeholder.
 */
export function ChunkActions({
  naid,
  chunkOrder,
  citationInput,
}: {
  naid: string;
  chunkOrder: number;
  /** Document metadata; chunkOrder is overridden inside this component. */
  citationInput: Omit<CitationInput, "chunkOrder" | "siteUrl">;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Style>("chicago");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCite, setCopiedCite] = useState(false);

  const citations = useMemo<CitationFormats>(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return formatCitation({
      ...citationInput,
      chunkOrder,
      siteUrl: `${origin}/document/${encodeURIComponent(naid)}`,
    });
  }, [citationInput, chunkOrder, naid]);

  const onCopyLink = async () => {
    const href =
      typeof window !== "undefined"
        ? `${window.location.origin}/document/${encodeURIComponent(naid)}#chunk-${chunkOrder}`
        : "";
    try {
      await navigator.clipboard.writeText(href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1400);
    } catch {
      // Clipboard unavailable; nothing to do.
    }
  };

  const onCopyCite = async () => {
    try {
      await navigator.clipboard.writeText(citations[style]);
      setCopiedCite(true);
      setTimeout(() => setCopiedCite(false), 1400);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <span className="chunk-actions">
      <button
        type="button"
        className="chunk-action-btn"
        aria-label={`Copy link to chunk ${chunkOrder}`}
        title={copiedLink ? "Link copied" : "Copy link to this chunk"}
        onClick={onCopyLink}
      >
        {copiedLink ? "✓" : "🔗"}
      </button>
      <button
        type="button"
        className="chunk-action-btn"
        aria-label={`Cite chunk ${chunkOrder}`}
        aria-expanded={open}
        title="Cite this chunk"
        onClick={() => setOpen((v) => !v)}
      >
        ❞
      </button>
      {open && (
        <span
          role="region"
          aria-label="Chunk citation formats"
          className="chunk-cite-popover"
        >
          <span
            role="tablist"
            aria-label="Citation style"
            style={{ display: "flex", gap: 4, marginBottom: 8 }}
          >
            {STYLES.map((s) => {
              const active = s.key === style;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStyle(s.key)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: "0.72rem",
                    border: "1px solid",
                    borderColor: active
                      ? "var(--border-strong)"
                      : "transparent",
                    background: active ? "var(--bg)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-serif)",
              fontSize: "0.85rem",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            {citations[style]}
          </span>
          <button
            type="button"
            onClick={onCopyCite}
            style={{
              padding: "3px 10px",
              fontSize: "0.72rem",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            {copiedCite ? "Copied ✓" : "Copy"}
          </button>
        </span>
      )}
    </span>
  );
}
