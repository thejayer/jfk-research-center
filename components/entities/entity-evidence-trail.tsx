import Link from "next/link";
import type { DocumentCard, TimelineEvent } from "@/lib/api-types";
import { Badge, OcrBadge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export function EntityEvidenceTrail({
  events,
  documents,
  documentsHref,
  entityName,
}: {
  events: TimelineEvent[];
  documents: DocumentCard[];
  documentsHref?: string;
  entityName: string;
}) {
  if (events.length === 0 && documents.length === 0) return null;

  const featuredEvents = events.slice(0, 4);
  const featuredDocuments = documents.slice(0, 4);
  const featuredDocument = documents[0];

  return (
    <section
      aria-label={`${entityName} evidence trail`}
      style={{
        marginTop: 28,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.45fr)",
        }}
        className="entity-evidence-trail"
      >
        <div style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Evidence trail
              </div>
              <h2
                style={{
                  fontSize: "1.35rem",
                  letterSpacing: 0,
                  fontWeight: 500,
                }}
              >
                Dates and records at a glance
              </h2>
            </div>
            {documentsHref && (
              <Link
                href={documentsHref}
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Full document set
                <ArrowRightIcon />
              </Link>
            )}
          </div>

          {featuredEvents.length > 0 ? (
            <ol
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {featuredEvents.map((event) => (
                <li
                  key={event.id}
                  style={{
                    borderTop: "2px solid var(--accent)",
                    paddingTop: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="eyebrow num"
                    style={{
                      color: "var(--accent)",
                      marginBottom: 7,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {event.dateLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1rem",
                      lineHeight: 1.25,
                      letterSpacing: 0,
                    }}
                  >
                    {event.title}
                  </div>
                </li>
              ))}
            </ol>
          ) : featuredDocuments.length > 0 ? (
            <ol
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {featuredDocuments.map((document) => (
                <li
                  key={document.id}
                  style={{
                    borderTop: "2px solid var(--accent)",
                    paddingTop: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="eyebrow num"
                    style={{
                      color: "var(--accent)",
                      marginBottom: 7,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {document.dateLabel ?? "Record"}
                  </div>
                  <Link
                    href={document.href}
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1rem",
                      lineHeight: 1.25,
                      letterSpacing: 0,
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    {document.title}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted" style={{ fontSize: "0.92rem" }}>
              No chronology or highlighted records have been curated yet.
            </p>
          )}
        </div>

        <aside
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--surface-2)",
            padding: "20px 22px",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Lead record
          </div>
          {featuredDocument ? (
            <Link
              href={featuredDocument.href}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: "var(--text)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.08rem",
                  lineHeight: 1.25,
                  letterSpacing: 0,
                }}
              >
                {featuredDocument.title}
              </div>
              <div
                className="muted"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  alignItems: "center",
                  fontSize: "0.8rem",
                }}
              >
                {featuredDocument.agency && <span>{featuredDocument.agency}</span>}
                {featuredDocument.dateLabel && <span>{featuredDocument.dateLabel}</span>}
                <span>
                  NAID <span className="num">{featuredDocument.naid}</span>
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {featuredDocument.hasOcr && <OcrBadge />}
                {featuredDocument.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} tone="muted" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Link>
          ) : (
            <p className="muted" style={{ fontSize: "0.92rem" }}>
              No top document has been attached yet.
            </p>
          )}
          {documents.length > 0 && (
            <div
              className="muted num"
              style={{
                marginTop: 14,
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {formatNumber(documents.length)} highlighted records
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
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
