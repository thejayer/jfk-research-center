import type { DocumentDetail } from "@/lib/api-types";

export function SourceLinks({ doc }: { doc: DocumentDetail }) {
  const links: Array<{ label: string; href: string; note?: string }> = [];
  if (doc.sourceUrl)
    links.push({
      label: "National Archives Catalog",
      href: doc.sourceUrl,
      note: "Original record page",
    });
  if (doc.digitalObjectUrl && doc.digitalObjectUrl !== doc.sourceUrl)
    links.push({
      label: "Digital object",
      href: doc.digitalObjectUrl,
      note: "PDF or scanned file",
    });

  return (
    <aside
      aria-label="Source links"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "20px 22px",
      }}
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
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {links.map((l) => (
            <li
              key={l.href}
              style={{ padding: "8px 0", fontSize: "0.9rem", lineHeight: 1.45 }}
            >
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--link)" }}
              >
                {l.label}
                <span aria-hidden style={{ marginLeft: 6 }}>↗</span>
              </a>
              {l.note && (
                <div
                  className="muted"
                  style={{ fontSize: "0.8rem", marginTop: 2 }}
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
            style={{
              fontSize: "0.83rem",
              lineHeight: 1.55,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {doc.citation}
          </p>
        </>
      )}
    </aside>
  );
}
