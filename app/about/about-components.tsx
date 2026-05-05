import Link from "next/link";
import type { ReactNode } from "react";

export type AboutNavItem = {
  href: string;
  label: string;
  detail: string;
};

export function AboutHero({
  eyebrow = "About",
  title,
  children,
  aside,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: aside
          ? "minmax(0, 1fr) minmax(260px, 340px)"
          : "minmax(0, 1fr)",
        gap: 28,
        alignItems: "end",
        paddingBottom: 30,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ maxWidth: "74ch", minWidth: 0 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          {eyebrow}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2rem, 1.5rem + 1.5vw, 3rem)",
            letterSpacing: 0,
            marginTop: 8,
            marginBottom: 14,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        <div
          className="muted"
          style={{ fontSize: "1.05rem", lineHeight: 1.62, maxWidth: "64ch" }}
        >
          {children}
        </div>
      </div>
      {aside}
    </header>
  );
}

export function AboutNav({ items }: { items: AboutNavItem[] }) {
  return (
    <nav
      aria-label="About pages"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 18,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        Trust pages
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 12,
              alignItems: "center",
              color: "var(--text)",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.04rem",
                  lineHeight: 1.25,
                  letterSpacing: 0,
                }}
              >
                {item.label}
              </span>
              <span
                className="muted"
                style={{
                  display: "block",
                  marginTop: 2,
                  fontSize: "0.78rem",
                  lineHeight: 1.35,
                }}
              >
                {item.detail}
              </span>
            </span>
            <ArrowRightIcon />
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
        marginTop: 28,
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
          }}
        >
          <div
            className="num"
            style={{ fontSize: "1.2rem", color: "var(--text)", fontWeight: 600 }}
          >
            {stat.value}
          </div>
          <div className="eyebrow" style={{ marginTop: 6 }}>
            {stat.label}
          </div>
          <p
            className="muted"
            style={{ marginTop: 6, fontSize: "0.78rem", lineHeight: 1.4 }}
          >
            {stat.hint}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AboutSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 34, scrollMarginTop: 96 }}>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.45rem",
          marginBottom: 10,
          letterSpacing: 0,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "1rem", lineHeight: 1.72, color: "var(--text)" }}>
        {children}
      </div>
    </section>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div style={{ marginTop: 44 }}>
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.92rem",
          fontWeight: 600,
        }}
      >
        <ArrowLeftIcon />
        {label}
      </Link>
    </div>
  );
}

export function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <path
        d="M3 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m8.75 4.25 3.75 3.75-3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <path
        d="M13 8H4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.25 4.25 3.5 8l3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
