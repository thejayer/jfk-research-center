"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addSavedResearchItem,
  isResearchItemSaved,
  removeSavedResearchItem,
  savedResearchKey,
  type SavedResearchInput,
} from "@/lib/saved-research";

export function SaveResearchButton({
  item,
  compact = false,
}: {
  item: SavedResearchInput;
  compact?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = useMemo(() => savedResearchKey(item), [item]);

  useEffect(() => {
    setMounted(true);
    const sync = () => setSaved(isResearchItemSaved(item));
    sync();
    window.addEventListener("jfkrc:saved-research-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("jfkrc:saved-research-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [item]);

  const label = saved ? "Saved" : compact ? "Save" : "Save to research tray";

  return (
    <button
      type="button"
      aria-pressed={mounted ? saved : false}
      aria-label={`${saved ? "Remove from" : "Save to"} research tray: ${item.title}`}
      onClick={() => {
        if (saved) {
          removeSavedResearchItem(id);
          setSaved(false);
        } else {
          addSavedResearchItem(item);
          setSaved(true);
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: compact ? 32 : 40,
        padding: compact ? "5px 10px" : "8px 14px",
        border: saved
          ? "1px solid var(--accent)"
          : "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm)",
        background: saved ? "var(--accent-soft)" : "var(--surface)",
        color: saved ? "var(--text)" : "var(--text)",
        fontSize: compact ? "0.8rem" : "0.9rem",
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {saved ? <CheckIcon /> : <BookmarkIcon />}
      <span>{mounted ? label : compact ? "Save" : "Research tray"}</span>
    </button>
  );
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.75 2.75h6.5v10.5L8 11.1l-3.25 2.15V2.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.25 2.75 2.75 6.25-6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
