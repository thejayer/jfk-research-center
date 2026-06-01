import Link from "next/link";
import type { ReactNode } from "react";
import type {
  DocumentReadingGuide as DocumentReadingGuideData,
  DocumentReadingGuideItem,
} from "@/lib/document-reading-guide";
import styles from "./document-reader.module.css";

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
    <section aria-label="Reading guide" className={styles.guidePanel}>
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
    <div className={styles.guideGroup}>
      <div className={`muted ${styles.guideGroupTitle}`}>
        {title}
      </div>
      <div className={styles.guideList}>{children}</div>
    </div>
  );
}

function GuideLink({ item }: { item: DocumentReadingGuideItem }) {
  const content = (
    <>
      <span className={styles.guideHeader}>
        <span className={`eyebrow ${styles.guideType}`}>
          {itemTypeLabel[item.type]}
        </span>
        <span className={`muted ${styles.guideMeta}`}>
          {item.meta}
        </span>
      </span>
      <span className={styles.guideLabel}>{item.label}</span>
    </>
  );

  if (item.href.startsWith("#")) {
    return (
      <a href={item.href} className={styles.guideLink}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={styles.guideLink}>
      {content}
    </Link>
  );
}
