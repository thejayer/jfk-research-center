import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="container"
      style={{
        padding: "120px 0",
        maxWidth: 720,
      }}
    >
      <div
        className="eyebrow"
        style={{ color: "var(--accent)", marginBottom: 12 }}
      >
        404 · Record not found
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          letterSpacing: "-0.02em",
          fontSize: "clamp(2rem, 1.4rem + 1.6vw, 2.6rem)",
          marginBottom: 14,
        }}
      >
        The page you requested is not in the archive.
      </h1>
      <p
        className="muted"
        style={{ maxWidth: "60ch", fontSize: "1rem", lineHeight: 1.6, marginBottom: 18 }}
      >
        It may have been moved, renamed, or not yet ingested from the bulk
        dataset. Try the search page or return to the front door of the archive.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/"
          style={{
            padding: "9px 16px",
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.92rem",
          }}
        >
          Return home
        </Link>
        <Link
          href="/search"
          style={{
            padding: "9px 16px",
            border: "1px solid var(--border-strong)",
            color: "var(--text)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.92rem",
          }}
        >
          Open search
        </Link>
      </div>
    </div>
  );
}
