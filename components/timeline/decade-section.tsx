"use client";

import { useEffect, useState, type ReactNode } from "react";

export function DecadeSection({
  decade,
  totalEvents,
  children,
}: {
  decade: string;
  totalEvents: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const apply = () => {
      setIsMobile(mq.matches);
      if (mq.matches) {
        setCollapsed(decade !== "1960s");
      } else {
        setCollapsed(false);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [decade]);

  const onHeaderClick = isMobile
    ? () => setCollapsed((c) => !c)
    : undefined;

  return (
    <section
      id={`decade-${decade}`}
      style={{ marginBottom: collapsed ? 16 : 56 }}
    >
      <h2
        onClick={onHeaderClick}
        role={isMobile ? "button" : undefined}
        aria-expanded={isMobile ? !collapsed : undefined}
        tabIndex={isMobile ? 0 : undefined}
        onKeyDown={
          isMobile
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCollapsed((c) => !c);
                }
              }
            : undefined
        }
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.6rem",
          letterSpacing: "-0.01em",
          marginBottom: collapsed ? 0 : 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 10,
          cursor: isMobile ? "pointer" : "default",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          userSelect: isMobile ? "none" : "auto",
        }}
      >
        <span className="num">{decade}</span>
        {isMobile && (
          <span
            className="num muted"
            style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}
          >
            {collapsed ? `+ ${totalEvents}` : "−"}
          </span>
        )}
      </h2>
      {!collapsed && children}
    </section>
  );
}
