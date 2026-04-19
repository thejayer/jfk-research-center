"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

const DESKTOP_MIN_PX = 920;

/**
 * Responsive wrapper for /search filters + saved searches. On desktop
 * (>= 920px), renders children inline in the sidebar grid slot. On mobile,
 * collapses children behind a "Filters" trigger button that opens a
 * bottom-sheet drawer.
 *
 * Children are rendered in both the desktop slot and (when open) the mobile
 * drawer, so each tree has independent disclosure state — acceptable
 * because only one is visible at a time.
 */
export function SearchSidebar({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = countActiveFilters(params);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on viewport resize up past the breakpoint (e.g. phone rotated)
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= DESKTOP_MIN_PX) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div>
      <div className="search-sidebar-desktop">{children}</div>

      <button
        ref={triggerRef}
        type="button"
        className="search-sidebar-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="search-sidebar-trigger-badge">{activeCount}</span>
        )}
      </button>

      {open && (
        <div
          className="search-sidebar-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Search filters"
          onClick={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        >
          <div
            ref={panelRef}
            className="search-sidebar-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-sidebar-drawer-header">
              <strong style={{ fontSize: "0.95rem" }}>Filters</strong>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close filters"
                style={{
                  padding: "4px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-muted)",
                  background: "transparent",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
            <div className="search-sidebar-drawer-body">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function countActiveFilters(
  params: ReturnType<typeof useSearchParams>,
): number {
  if (!params) return 0;
  let n = 0;
  for (const key of ["agency", "entity", "topic", "confidence"]) {
    n += params.getAll(key).length;
  }
  if (params.get("yearFrom") || params.get("yearTo")) n += 1;
  return n;
}
