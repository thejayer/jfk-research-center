"use client";

import { useState } from "react";
import type { CitationFormats } from "@/lib/citations";

type Style = keyof CitationFormats;

const STYLES: Array<{ key: Style; label: string }> = [
  { key: "bluebook", label: "Bluebook" },
  { key: "chicago", label: "Chicago" },
  { key: "apa", label: "APA" },
];

export function CiteButton({ citations }: { citations: CitationFormats }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Style>("chicago");
  const [copied, setCopied] = useState(false);

  const current = citations[style];

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard API unavailable (older browsers, insecure contexts); fall
      // through silently. Users can still select the text manually.
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          background: open ? "var(--surface)" : "transparent",
          color: "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <span aria-hidden>❞</span>
        {open ? "Hide citation" : "Cite"}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Citation formats"
          style={{
            marginTop: 12,
            padding: "16px 18px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            maxWidth: "72ch",
          }}
        >
          <div
            role="tablist"
            aria-label="Citation style"
            style={{ display: "flex", gap: 4, marginBottom: 12 }}
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
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: "0.8rem",
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
          </div>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "0.95rem",
              lineHeight: 1.55,
              color: "var(--text)",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {current}
          </p>
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: "5px 12px",
              fontSize: "0.8rem",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
