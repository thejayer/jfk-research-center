import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  href?: string;
  as?: "div" | "article" | "section";
  padded?: boolean;
  elevate?: boolean;
  style?: CSSProperties;
};

function cardStyle({
  padded,
  elevate,
  interactive,
}: {
  padded: boolean;
  elevate: boolean;
  interactive: boolean;
}): CSSProperties {
  return {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: padded ? "20px 22px" : 0,
    boxShadow: elevate ? "var(--shadow-md)" : "none",
    transition:
      "border-color var(--motion), background var(--motion), transform var(--motion)",
    color: "var(--text)",
    display: "block",
    textDecoration: "none",
    cursor: interactive ? "pointer" : "default",
  };
}

export function Card({
  children,
  href,
  as = "article",
  padded = true,
  elevate = false,
  style,
}: CardProps) {
  const s = {
    ...cardStyle({ padded, elevate, interactive: !!href }),
    ...style,
  };

  if (href) {
    return (
      <Link
        href={href}
        style={s}
        className="card-link"
      >
        {children}
      </Link>
    );
  }

  const Tag = as;
  return <Tag style={s}>{children}</Tag>;
}
