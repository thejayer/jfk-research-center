import type { ReactNode } from "react";

export function StatPill({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        className="eyebrow"
        style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}
      >
        {label}
      </span>
      <span
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.6rem, 1.2rem + 1.2vw, 2.2rem)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {hint && (
        <span
          style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
