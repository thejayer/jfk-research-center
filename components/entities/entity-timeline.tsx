import Link from "next/link";
import type { TimelineEvent } from "@/lib/api-types";

export function EntityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        borderLeft: "1px solid var(--border-strong)",
        paddingLeft: 22,
      }}
    >
      {events.map((e) => (
        <li
          key={e.id}
          id={e.id}
          style={{
            position: "relative",
            paddingBottom: 28,
            scrollMarginTop: 24,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: -27,
              top: 6,
              width: 10,
              height: 10,
              borderRadius: 999,
              border: "2px solid var(--accent)",
              background: "var(--bg)",
            }}
          />
          <div
            className="eyebrow num"
            style={{ marginBottom: 6, color: "var(--accent)" }}
          >
            {e.dateLabel}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              letterSpacing: 0,
              marginBottom: 6,
            }}
          >
            {e.title}
          </div>
          <p
            className="muted"
            style={{
              fontSize: "0.96rem",
              lineHeight: 1.6,
              maxWidth: "66ch",
              marginBottom: 8,
            }}
          >
            {e.description}
          </p>
          {e.relatedDocumentIds && e.relatedDocumentIds.length > 0 && (
            <div
              style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.85rem" }}
            >
              {e.relatedDocumentIds.map((id) => (
                <Link
                  key={id}
                  href={`/document/${id}`}
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <ArrowRightIcon />
                  document
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
