"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearSavedResearchItems,
  listSavedResearchItems,
  removeSavedResearchItem,
  savedResearchTypeLabel,
  type SavedResearchItem,
} from "@/lib/saved-research";

export function ResearchTray() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedResearchItem[]>([]);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setItems(listSavedResearchItems());
    sync();
    window.addEventListener("jfkrc:saved-research-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("jfkrc:saved-research-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const counts = useMemo(() => {
    const next = new Map<SavedResearchItem["type"], number>();
    for (const item of items) {
      next.set(item.type, (next.get(item.type) ?? 0) + 1);
    }
    return next;
  }, [items]);

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        className="research-tray-trigger"
        aria-label={`Open saved research tray${items.length > 0 ? `, ${items.length} saved items` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BookmarkIcon />
        <span>Research tray</span>
        <strong aria-hidden="true">{mounted ? items.length : 0}</strong>
      </button>

      {open && (
        <div
          className="research-tray-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside
            className="research-tray-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-tray-title"
          >
            <div className="research-tray-header">
              <div>
                <div className="eyebrow">Saved work</div>
                <h2 id="research-tray-title">Research tray</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="research-tray-icon-button"
                aria-label="Close research tray"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            {items.length > 0 ? (
              <>
                <div className="research-tray-summary" aria-label="Saved item counts">
                  {Array.from(counts.entries()).map(([type, count]) => (
                    <span key={type}>
                      {savedResearchTypeLabel(type)}{" "}
                      <strong>{count}</strong>
                    </span>
                  ))}
                </div>
                <ul className="research-tray-list">
                  {items.map((item) => (
                    <li key={item.id} className="research-tray-item">
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        <span className="research-tray-item-type">
                          {savedResearchTypeLabel(item.type)}
                        </span>
                        <span className="research-tray-item-title">{item.title}</span>
                        {item.context && (
                          <span className="research-tray-item-context">
                            {item.context}
                          </span>
                        )}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove saved item: ${item.title}`}
                        onClick={() => removeSavedResearchItem(item.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="research-tray-actions">
                  <Link
                    href="/research/brief"
                    className="research-tray-brief-link"
                    onClick={() => setOpen(false)}
                  >
                    Build brief
                  </Link>
                  <button
                    type="button"
                    className="research-tray-clear"
                    onClick={() => clearSavedResearchItems()}
                  >
                    Clear tray
                  </button>
                </div>
              </>
            ) : (
              <div className="research-tray-empty">
                <h3>No saved items yet</h3>
                <p>
                  Save documents, evidence, entities, topics, timeline events,
                  and open questions while you move through the archive.
                </p>
                <Link href="/search" onClick={() => setOpen(false)}>
                  Start with search
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function BookmarkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.75 2.75h6.5v10.5L8 11.1l-3.25 2.15V2.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
