"use client";

import { useState } from "react";

export function CopyNaidButton({ naid }: { naid: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(naid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked; the NAID is still visible so the user can
      // select it manually.
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "NAID copied" : "Copy NAID"}
      title={copied ? "Copied" : "Copy NAID"}
      style={{
        marginLeft: 4,
        padding: "0 6px",
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "transparent",
        color: copied ? "var(--accent)" : "var(--text-muted)",
        fontSize: "0.72rem",
        lineHeight: 1.6,
        cursor: "pointer",
      }}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}
