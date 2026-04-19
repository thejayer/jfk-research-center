"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const CHORD_TIMEOUT_MS = 1200;

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingChordRef = useRef<number | null>(null);
  const resultIndexRef = useRef(-1);
  const triggerElRef = useRef<HTMLElement | null>(null);
  const helpOpenRef = useRef(false);
  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  useEffect(() => {
    function isTypingContext(el: Element | null): boolean {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }

    function clearChord() {
      if (pendingChordRef.current !== null) {
        window.clearTimeout(pendingChordRef.current);
        pendingChordRef.current = null;
      }
    }

    function moveResult(dir: 1 | -1) {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>("[data-search-result]"),
      );
      if (cards.length === 0) return;
      let next = resultIndexRef.current + dir;
      if (resultIndexRef.current < 0) next = dir === 1 ? 0 : cards.length - 1;
      next = Math.max(0, Math.min(cards.length - 1, next));
      resultIndexRef.current = next;
      const el = cards[next];
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }

    function onKeydown(e: KeyboardEvent) {
      const target = e.target as Element | null;

      if (e.key === "Escape") {
        clearChord();
        if (helpOpenRef.current) {
          setHelpOpen(false);
          triggerElRef.current?.focus();
        }
        return;
      }

      if (isTypingContext(target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingChordRef.current !== null) {
        clearChord();
        if (e.key === "e") {
          e.preventDefault();
          router.push("/entities");
          return;
        }
        if (e.key === "t") {
          e.preventDefault();
          router.push("/topics");
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          router.push("/search");
          return;
        }
        if (e.key === "h") {
          e.preventDefault();
          router.push("/");
          return;
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          "[data-search-input]",
        );
        if (input) {
          input.focus();
          input.select();
        } else {
          router.push("/search");
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        triggerElRef.current = (document.activeElement as HTMLElement) ?? null;
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "g") {
        e.preventDefault();
        pendingChordRef.current = window.setTimeout(
          clearChord,
          CHORD_TIMEOUT_MS,
        );
        return;
      }
      if ((e.key === "j" || e.key === "k") && pathname === "/search") {
        e.preventDefault();
        moveResult(e.key === "j" ? 1 : -1);
        return;
      }
    }

    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      clearChord();
    };
  }, [pathname, router]);

  useEffect(() => {
    resultIndexRef.current = -1;
  }, [pathname]);

  if (!helpOpen) return null;
  return (
    <HelpModal
      onClose={() => {
        setHelpOpen(false);
        triggerElRef.current?.focus();
      }}
    />
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          padding: "24px 26px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>
              Help
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.25rem",
                letterSpacing: "-0.01em",
              }}
            >
              Keyboard shortcuts
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
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
            Esc
          </button>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            rowGap: 10,
            columnGap: 18,
            margin: 0,
          }}
        >
          <Row keys={["/"]}>Focus search</Row>
          <Row keys={["j"]}>Next result</Row>
          <Row keys={["k"]}>Previous result</Row>
          <Row keys={["g", "h"]}>Go home</Row>
          <Row keys={["g", "s"]}>Go to search</Row>
          <Row keys={["g", "e"]}>Go to entities</Row>
          <Row keys={["g", "t"]}>Go to topics</Row>
          <Row keys={["?"]}>Show this help</Row>
          <Row keys={["Esc"]}>Close / cancel</Row>
        </dl>
      </div>
    </div>
  );
}

function Row({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  return (
    <>
      <dt
        style={{
          display: "inline-flex",
          gap: 6,
          alignItems: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.8rem",
        }}
      >
        {keys.map((k, i) => (
          <span
            key={i}
            style={{
              padding: "2px 8px",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              background: "var(--bg)",
              color: "var(--text)",
              minWidth: 22,
              textAlign: "center",
            }}
          >
            {k}
          </span>
        ))}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: "0.92rem",
          color: "var(--text)",
          alignSelf: "center",
        }}
      >
        {children}
      </dd>
    </>
  );
}
