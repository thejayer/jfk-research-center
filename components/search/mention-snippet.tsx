import Link from "next/link";
import type { MentionExcerpt } from "@/lib/api-types";
import { Badge, ConfidenceBadge } from "@/components/ui/badge";
import { highlightHTML } from "@/lib/format";
import { SourceReliabilityBadge } from "@/components/research/source-reliability-badge";
import { sourceReliabilityForMentionSource } from "@/lib/source-reliability";
import styles from "./search-workspace.module.css";

export function MentionSnippet({
  mention,
  query,
  layout = "default",
}: {
  mention: MentionExcerpt;
  query?: string;
  layout?: "default" | "compact";
}) {
  const terms = [
    ...(query ? [query] : []),
    ...mention.matchedTerms,
  ];

  return (
    <article
      data-search-result="true"
      tabIndex={-1}
      className={
        layout === "compact"
          ? styles.mentionCompact
          : `search-result-focusable ${styles.mentionCard}`
      }
    >
      <p
        className={styles.mentionText}
        dangerouslySetInnerHTML={{
          __html: `“${highlightHTML(mention.excerpt, terms)}”`,
        }}
      />

      <div className={styles.mentionMeta}>
        <Link
          href={mention.documentHref}
          style={{ color: "var(--text)", fontWeight: 500 }}
        >
          {mention.documentTitle}
        </Link>
        {mention.pageLabel && (
          <>
            <span aria-hidden>·</span>
            <span>{mention.pageLabel}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>source: {mention.source}</span>
        <SourceReliabilityBadge
          kind={sourceReliabilityForMentionSource(mention.source)}
        />
        {typeof mention.score === "number" ? (
          <span
            className="num"
            style={{
              padding: "1px 7px",
              borderRadius: 999,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontSize: "0.74rem",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
            title="Semantic similarity"
          >
            {Math.round(mention.score * 100)}%
          </span>
        ) : (
          <ConfidenceBadge level={mention.confidence} />
        )}
        {mention.matchedTerms.length > 0 && layout === "default" && (
          <div
            style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}
          >
            {mention.matchedTerms.slice(0, 3).map((t) => (
              <Badge key={t} tone="muted" size="sm">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
