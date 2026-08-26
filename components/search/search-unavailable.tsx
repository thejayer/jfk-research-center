import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import {
  SEARCH_UNAVAILABLE_BODY,
  SEARCH_UNAVAILABLE_HOME_LABEL,
  SEARCH_UNAVAILABLE_RETRY_LABEL,
  SEARCH_UNAVAILABLE_TITLE,
} from "@/lib/search-unavailable-copy";
import styles from "./search-workspace.module.css";

export {
  SEARCH_UNAVAILABLE_BODY,
  SEARCH_UNAVAILABLE_HOME_LABEL,
  SEARCH_UNAVAILABLE_RETRY_LABEL,
  SEARCH_UNAVAILABLE_TITLE,
} from "@/lib/search-unavailable-copy";

export function SearchUnavailable({
  query,
  retryHref = "/search",
  retryAction,
}: {
  query?: string;
  retryHref?: string;
  retryAction?: ReactNode;
}) {
  const trimmedQuery = query?.trim() ?? "";

  return (
    <section
      aria-labelledby="search-unavailable-title"
      className={styles.panel}
      data-search-unavailable="true"
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Search unavailable
      </div>
      <h1
        id="search-unavailable-title"
        className={styles.panelTitle}
        style={{ fontSize: "clamp(1.45rem, 1.2rem + 0.8vw, 2rem)" }}
      >
        {SEARCH_UNAVAILABLE_TITLE}
      </h1>
      <p
        className="muted"
        style={{ maxWidth: "62ch", fontSize: "0.95rem", lineHeight: 1.6 }}
      >
        {SEARCH_UNAVAILABLE_BODY}
      </p>
      {trimmedQuery ? (
        <p className="muted" style={{ marginTop: 10, fontSize: "0.9rem" }}>
          Last query: <mark>{trimmedQuery}</mark>
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 22,
        }}
      >
        {retryAction ?? (
          <LinkButton href={retryHref} variant="primary">
            {SEARCH_UNAVAILABLE_RETRY_LABEL}
          </LinkButton>
        )}
        <LinkButton href="/" variant="secondary">
          {SEARCH_UNAVAILABLE_HOME_LABEL}
        </LinkButton>
        <Link
          href="/entities"
          style={{
            alignSelf: "center",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Browse entities
        </Link>
      </div>
    </section>
  );
}
