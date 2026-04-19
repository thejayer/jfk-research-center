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
      <SiteHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
      <KeyboardShortcuts />
    </div>
  );
}
