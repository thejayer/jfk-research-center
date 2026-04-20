import Link from "next/link";
import { buildSearchUrl, type ParsedSearch } from "@/lib/search";
import { formatNumber } from "@/lib/format";

export function PaginationControls({
  q,
  mode,
  filters,
  page,
  pageSize,
  total,
}: {
  q: string;
  mode: ParsedSearch["mode"];
  filters: ParsedSearch["filters"];
  page: number;
  pageSize: number;
  total: number;
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const first = (clampedPage - 1) * pageSize + 1;
  const last = Math.min(clampedPage * pageSize, total);
  const prevHref =
    clampedPage > 1
      ? buildSearchUrl(q, mode, filters, clampedPage - 1)
      : null;
  const nextHref =
    clampedPage < totalPages
      ? buildSearchUrl(q, mode, filters, clampedPage + 1)
      : null;

  return (
    <nav
      aria-label="Search result pages"
      style={{
        marginTop: 28,
        paddingTop: 20,
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div
        className="num muted"
        style={{ fontSize: "0.82rem", letterSpacing: "0.02em" }}
      >
        Results {formatNumber(first)}&ndash;{formatNumber(last)} of{" "}
        {formatNumber(total)} &middot; page {formatNumber(clampedPage)} of{" "}
        {formatNumber(totalPages)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PageButton
          href={prevHref}
          label="← Previous"
          ariaLabel="Go to previous page"
        />
        <PageButton
          href={nextHref}
          label="Next →"
          ariaLabel="Go to next page"
        />
      </div>
    </nav>
  );
}

function PageButton({
  href,
  label,
  ariaLabel,
}: {
  href: string | null;
  label: string;
  ariaLabel: string;
}) {
  const base = {
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: "0.85rem",
    border: "1px solid var(--border-strong)",
    textDecoration: "none" as const,
  };
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="muted"
        style={{
          ...base,
          color: "var(--text-muted)",
          background: "transparent",
          opacity: 0.5,
          cursor: "not-allowed",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        ...base,
        color: "var(--text)",
        background: "var(--surface)",
      }}
    >
      {label}
    </Link>
  );
}
