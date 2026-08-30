import type { DocumentDetail } from "@/lib/api-types";
import { documentSourceLinks } from "@/lib/document-reader";
import styles from "./document-reader.module.css";

export function SourceLinks({ doc }: { doc: DocumentDetail }) {
  const links = documentSourceLinks(doc);

  return (
    <aside
      aria-label="Source links"
      className={styles.sourcePanel}
    >
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        Source
      </div>
      {links.length === 0 ? (
        <p
          className="muted"
          style={{ fontSize: "0.9rem" }}
        >
          No external source link is recorded for this item.
        </p>
      ) : (
        <ul className={styles.sourceList}>
          {links.map((l) => (
            <li
              key={l.href}
              className={styles.sourceItem}
            >
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className={styles.sourceLink}
              >
                {l.label}
                <ExternalLinkIcon />
              </a>
              {l.note && (
                <div
                  className={`muted ${styles.sourceNote}`}
                >
                  {l.note}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {doc.citation && (
        <>
          <div
            className="eyebrow"
            style={{ marginTop: 20, marginBottom: 8 }}
          >
            Citation
          </div>
          <p
            className={styles.sourceCitation}
          >
            {doc.citation}
          </p>
        </>
      )}
    </aside>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ marginLeft: 6, verticalAlign: "-0.12em" }}
    >
      <path
        d="M6.5 4H4.75A1.75 1.75 0 0 0 3 5.75v5.5C3 12.22 3.78 13 4.75 13h5.5A1.75 1.75 0 0 0 12 11.25V9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 3h4v4M8 8l5-5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
