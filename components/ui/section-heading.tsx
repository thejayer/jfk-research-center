import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontSize: "clamp(1.4rem, 1rem + 1vw, 1.8rem)",
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="muted"
            style={{
              marginTop: 10,
              maxWidth: "60ch",
              fontSize: "0.98rem",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          style={{
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          {actionLabel}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
