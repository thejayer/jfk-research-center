import type { DocumentDetail } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";

export function DocumentHeader({ doc }: { doc: DocumentDetail }) {
  return (
    <header
      style={{
        paddingTop: 40,
        paddingBottom: 28,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
          color: "var(--text-muted)",
          fontSize: "0.86rem",
        }}
      >
        {doc.documentType && <span>{doc.documentType}</span>}
        {doc.agency && (
          <>
            <Dot />
            <span>{doc.agency}</span>
          </>
        )}
        {doc.dateLabel && (
          <>
            <Dot />
            <span>{doc.dateLabel}</span>
          </>
        )}
        <Dot />
        <span>
          NAID <span className="num">{doc.naid}</span>
        </span>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.7rem, 1.3rem + 1.4vw, 2.5rem)",
          letterSpacing: "-0.015em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        {doc.title}
      </h1>

      {doc.subtitle && (
        <div
          className="muted"
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "1.05rem",
            marginBottom: 18,
          }}
        >
          {doc.subtitle}
        </div>
      )}

      {doc.description && (
        <p
          style={{
            maxWidth: "70ch",
            fontSize: "1rem",
            lineHeight: 1.65,
            color: "var(--text)",
          }}
        >
          {doc.description}
        </p>
      )}

      {doc.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          {doc.tags.map((t) => (
            <Badge key={t} tone="neutral" size="sm">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </header>
  );
}

function Dot() {
  return (
    <span aria-hidden style={{ color: "var(--border-strong)" }}>
      ·
    </span>
  );
}
