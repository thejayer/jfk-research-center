import Link from "next/link";
import type { DocumentCard, MentionExcerpt } from "@/lib/api-types";
import { Badge, OcrBadge } from "@/components/ui/badge";

export function TopicEvidenceTrail({
  documents,
  mentions,
  documentsHref,
}: {
  documents: DocumentCard[];
  mentions: MentionExcerpt[];
  documentsHref: string;
}) {
  if (documents.length === 0 && mentions.length === 0) return null;

  const featuredDocuments = documents.slice(0, 4);
  const leadMention = mentions[0];

  return (
    <section
      aria-label="Topic evidence trail"
      style={{
        marginTop: 28,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div className="topic-evidence-trail">
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
                Records that frame the inquiry
              </h2>
            </div>
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
              Full topic set
              <ArrowRightIcon />
            </Link>
          </div>

          {featuredDocuments.length > 0 && (
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
                    {document.dateLabel ?? document.documentType ?? "Record"}
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
            Representative passage
          </div>
          {leadMention ? (
            <Link
              href={leadMention.documentHref}
              style={{
                color: "var(--text)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textDecoration: "none",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.02rem",
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                "{trimExcerpt(leadMention.excerpt)}"
              </p>
              <div
                className="muted"
                style={{ fontSize: "0.8rem", lineHeight: 1.4 }}
              >
                {leadMention.documentTitle}
              </div>
            </Link>
          ) : featuredDocuments[0] ? (
            <Link
              href={featuredDocuments[0].href}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: "var(--text)",
                textDecoration: "none",
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
                {featuredDocuments[0].title}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {featuredDocuments[0].hasOcr && <OcrBadge />}
                {featuredDocuments[0].tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} tone="muted" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Link>
          ) : (
            <p className="muted" style={{ fontSize: "0.92rem" }}>
              No representative passage is available yet.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function trimExcerpt(value: string): string {
  return value.length > 210 ? `${value.slice(0, 210).trim()}...` : value;
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
