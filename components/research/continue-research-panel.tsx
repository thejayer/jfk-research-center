"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearResearchHistoryItems,
  listResearchHistoryItems,
  removeResearchHistoryItem,
  researchHistoryTypeLabel,
  type ResearchHistoryItem,
} from "@/lib/research-history";

export function ContinueResearchPanel() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ResearchHistoryItem[]>([]);

  useEffect(() => {
    setMounted(true);
    const sync = () => setItems(listResearchHistoryItems());
    sync();
    window.addEventListener("jfkrc:research-history-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("jfkrc:research-history-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <section
      className="container"
      aria-label="Continue research"
      style={{ marginTop: 52 }}
    >
      <div
        className="research-history-panel"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "24px 0",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.68fr) minmax(0, 1.32fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Continue research
          </div>
          <h2
            style={{
              fontSize: "clamp(1.35rem, 1.1rem + 0.7vw, 1.9rem)",
              letterSpacing: 0,
              marginBottom: 10,
            }}
          >
            Pick up where this browser left off.
          </h2>
          <p
            className="muted"
            style={{ fontSize: "0.94rem", lineHeight: 1.6, maxWidth: "44ch" }}
          >
            Recent pages stay local to this browser. Clear them any time; no
            account or server sync is involved.
          </p>
          {mounted && items.length > 0 && (
            <button
              type="button"
              onClick={() => clearResearchHistoryItems()}
              style={{
                marginTop: 14,
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Clear history
            </button>
          )}
        </div>

        {!mounted || items.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.1rem",
                letterSpacing: 0,
                marginBottom: 6,
              }}
            >
              No recent work yet
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              Open a document, entity, topic, evidence item, search, or timeline
              view and it will appear here.
            </p>
          </div>
        ) : (
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
              gap: 10,
            }}
          >
            {items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    padding: "13px 14px",
                    minHeight: 132,
                    display: "grid",
                    gridTemplateRows: "auto 1fr auto",
                    gap: 8,
                  }}
                >
                  <div className="eyebrow" style={{ fontSize: "0.62rem" }}>
                    {researchHistoryTypeLabel(item.type)}
                  </div>
                  <Link
                    href={item.href}
                    style={{
                      color: "var(--text)",
                      textDecoration: "none",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.02rem",
                        lineHeight: 1.25,
                        letterSpacing: 0,
                      }}
                    >
                      {item.title}
                    </span>
                    {item.context && (
                      <span
                        className="muted"
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: "0.78rem",
                          lineHeight: 1.35,
                        }}
                      >
                        {item.context}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeResearchHistoryItem(item.id)}
                    aria-label={`Remove from research history: ${item.title}`}
                    style={{
                      justifySelf: "start",
                      color: "var(--text-muted)",
                      fontSize: "0.76rem",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <style>{`
        @media (max-width: 820px) {
          .research-history-panel {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
