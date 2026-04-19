import Link from "next/link";

/**
 * Small "Report an error on this page" link that pre-fills the
 * corrections form via ?surface= and ?targetId=. Drop into the footer
 * or a quiet corner of any content surface where the curated text is
 * the editorial product (entity bios, topic summaries, AI articles,
 * timeline events, established facts, evidence items).
 */
export function ReportErrorLink({
  surface,
  targetId,
  className,
}: {
  surface: string;
  targetId: string;
  className?: string;
}) {
  const href =
    `/corrections?surface=${encodeURIComponent(surface)}` +
    `&targetId=${encodeURIComponent(targetId)}`;
  return (
    <Link
      href={href}
      className={className}
      style={{
        color: "var(--text-muted)",
        fontSize: "0.82rem",
        textDecoration: "underline dotted",
        textUnderlineOffset: 3,
      }}
    >
      Report an error on this page
    </Link>
  );
}
