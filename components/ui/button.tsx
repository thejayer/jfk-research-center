import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--text)",
    color: "var(--bg)",
    border: "1px solid var(--text)",
  },
  secondary: {
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border-strong)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid transparent",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: "0.85rem" },
  md: { padding: "9px 16px", fontSize: "0.95rem" },
  lg: { padding: "12px 22px", fontSize: "1rem" },
};

function baseStyle(variant: Variant, size: Size): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: "var(--radius-sm)",
    lineHeight: 1.2,
    fontWeight: 500,
    transition:
      "background var(--motion), color var(--motion), border-color var(--motion), transform var(--motion)",
    textDecoration: "none",
    ...sizeStyle[size],
    ...variantStyle[variant],
  };
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  type = "button",
  disabled,
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseStyle(variant, size),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  style,
  ariaLabel,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: Size;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        ...baseStyle(variant, size),
        ...style,
      }}
    >
      {children}
    </Link>
  );
}
