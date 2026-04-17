import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "48px 24px",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28,
          height: 1,
          background: "var(--accent)",
          marginBottom: 4,
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.25rem",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </div>
      {description && (
        <p
          className="muted"
          style={{ maxWidth: "56ch", fontSize: "0.95rem" }}
        >
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
