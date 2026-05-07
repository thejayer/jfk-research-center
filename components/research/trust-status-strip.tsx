import type { CSSProperties } from "react";
import type { DocumentCard, DocumentDetail } from "@/lib/api-types";

type TrustStatusStripProps = {
  doc?: DocumentCard | DocumentDetail;
  statuses?: Array<{
    label: string;
    value: string;
    tone?: "good" | "warn" | "neutral";
  }>;
  compact?: boolean;
};

export function TrustStatusStrip({
  doc,
  statuses,
  compact = false,
}: TrustStatusStripProps) {
  const items =
    statuses ??
    (doc
      ? [
          {
            label: "Source",
            value: doc.agency ?? "Archival record",
            tone: "neutral" as const,
          },
          {
            label: "Text",
            value: doc.hasOcr ? "OCR available" : "Metadata only",
            tone: doc.hasOcr ? ("good" as const) : ("warn" as const),
          },
          {
            label: "Record",
            value: doc.naid ? `NAID ${doc.naid}` : "Indexed",
            tone: "neutral" as const,
          },
        ]
      : []);

  if (items.length === 0) return null;

  return (
    <div
      aria-label="Source status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? 6 : 8,
      }}
    >
      {items.map((item) => (
        <span
          key={`${item.label}-${item.value}`}
          style={{
            ...statusChipStyle,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: compact ? 24 : 28,
            padding: compact ? "3px 8px" : "4px 10px",
            borderRadius: 999,
            background: statusBackground(item.tone),
            color: "var(--text)",
            fontSize: compact ? "0.72rem" : "0.78rem",
            lineHeight: 1.2,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor(item.tone),
              flexShrink: 0,
            }}
          />
          <span className="muted" style={{ fontWeight: 600 }}>
            {item.label}
          </span>
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function statusColor(tone: "good" | "warn" | "neutral" | undefined) {
  if (tone === "good") return "var(--accent)";
  if (tone === "warn") return "var(--text-muted)";
  return "var(--border-strong)";
}

function statusBackground(tone: "good" | "warn" | "neutral" | undefined) {
  if (tone === "good") {
    return "color-mix(in srgb, var(--accent-soft) 52%, var(--surface))";
  }
  return "var(--surface)";
}

const statusChipStyle: CSSProperties = {
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-sm)",
  transition:
    "border-color var(--motion), background var(--motion), box-shadow var(--motion)",
};
