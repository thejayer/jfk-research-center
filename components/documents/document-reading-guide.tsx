import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type {
  DocumentReadingGuide as DocumentReadingGuideData,
  DocumentReadingGuideItem,
} from "@/lib/document-reading-guide";

const itemTypeLabel: Record<DocumentReadingGuideItem["type"], string> = {
  passage: "Passage",
  topic: "Topic",
  entity: "Entity",
  timeline: "Timeline",
  record: "Record",
};

/**
 * Sticky sidebar guide for close reading: OCR passage anchors first, followed
 * by nearby topic, entity, timeline, and record context.
 */
export function DocumentReadingGuide({
  guide,
}: {
  guide: DocumentReadingGuideData;
}) {
  const hasPassages = guide.passageJumps.length > 0;
  const hasContext = guide.contextLinks.length > 0;

  if (!hasPassages && !hasContext) return null;

  return (
    <section aria-label="Reading guide" style={panelStyle}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Reading guide
      </div>
      {hasPassages && (
        <GuideGroup title="Passage jumps">
          {guide.passageJumps.map((item) => (
            <GuideLink key={item.id} item={item} />
          ))}
        </GuideGroup>
      )}
      {hasContext && (
        <GuideGroup title="Context">
          {guide.contextLinks.map((item) => (
            <GuideLink key={item.id} item={item} />
          ))}
        </GuideGroup>
      )}
    </section>
  );
}

function GuideGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="muted" style={groupTitleStyle}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 7 }}>{children}</div>
    </div>
  );
}

function GuideLink({ item }: { item: DocumentReadingGuideItem }) {
  const content = (
    <>
      <span style={itemHeaderStyle}>
        <span className="eyebrow" style={itemTypeStyle}>
          {itemTypeLabel[item.type]}
        </span>
        <span className="muted" style={metaStyle}>
          {item.meta}
        </span>
      </span>
      <span style={labelStyle}>{item.label}</span>
    </>
  );

  if (item.href.startsWith("#")) {
    return (
      <a href={item.href} style={linkStyle}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} style={linkStyle}>
      {content}
    </Link>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: "16px 18px",
};

const groupTitleStyle: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  marginBottom: 7,
};

const linkStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "var(--text)",
  textDecoration: "none",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 10px",
};

const itemHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0,
};

const itemTypeStyle: CSSProperties = {
  color: "var(--accent)",
  fontSize: "0.66rem",
  letterSpacing: "0.08em",
};

const metaStyle: CSSProperties = {
  fontSize: "0.72rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "0.92rem",
  lineHeight: 1.3,
  letterSpacing: 0,
};
