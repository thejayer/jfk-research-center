import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <MastheadStrip />
      <SiteHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
      <KeyboardShortcuts />
    </div>
  );
}

function MastheadStrip() {
  const currentYear = new Date().getFullYear();

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-muted)",
        fontSize: "0.7rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          minHeight: 32,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span>JFK Assassination Records Collection / U.S. National Archives</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span className="masthead-release-note">
            Releases indexed 2017-{currentYear}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--cat-investigation)",
                boxShadow:
                  "0 0 0 3px color-mix(in srgb, var(--cat-investigation) 22%, transparent)",
              }}
            />
            Index live
          </span>
        </span>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .masthead-release-note {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
