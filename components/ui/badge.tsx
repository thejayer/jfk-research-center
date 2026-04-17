import type { CSSProperties, ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "accent"
  | "muted"
  | "high"
  | "medium"
  | "low"
  | "outline";

const toneStyle: Record<BadgeTone, CSSProperties> = {
  neutral: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  accent: {
    background: "var(--accent-soft)",
    color: "var(--accent)",
    border: "1px solid transparent",
  },
  muted: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  },
  outline: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border-strong)",
  },
  high: {
    background: "color-mix(in srgb, var(--accent-soft) 70%, transparent)",
    color: "var(--accent)",
    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
  },
  medium: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border-strong)",
  },
  low: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px dashed var(--border-strong)",
  },
};

export function Badge({
  children,
  tone = "neutral",
  size = "md",
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: size === "sm" ? "0.7rem" : "0.78rem",
        lineHeight: 1,
        padding: size === "sm" ? "4px 7px" : "5px 9px",
        borderRadius: 999,
        letterSpacing: "0.02em",
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...toneStyle[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function OcrBadge() {
  return (
    <Badge tone="accent" size="sm" style={{ letterSpacing: "0.06em" }}>
      OCR
    </Badge>
  );
}

export function ConfidenceBadge({
  level,
}: {
  level: "high" | "medium" | "low" | "none";
}) {
  if (level === "none") return null;
  const label =
    level === "high"
      ? "High confidence"
      : level === "medium"
        ? "Medium confidence"
        : "Low confidence";
  return (
    <Badge tone={level} size="sm">
      <Dot level={level} />
      {label}
    </Badge>
  );
}

function Dot({ level }: { level: "high" | "medium" | "low" }) {
  const bg =
    level === "high"
      ? "var(--accent)"
      : level === "medium"
        ? "var(--text)"
        : "var(--text-muted)";
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: bg,
        display: "inline-block",
      }}
    />
  );
}
