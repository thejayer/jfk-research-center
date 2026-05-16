import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * Link rendered inside a context section.
 *
 * `href` may be internal or external, `label` is the visible title, `meta` is
 * the short relationship label, and `external` opens the link in a new tab.
 */
export type ResearchContextLink = {
  href: string;
  label: string;
  meta: string;
  external?: boolean;
};

/**
 * Prominent next-step link rendered in the panel action rail.
 *
 * `detail` should explain why the action is useful; `external` marks off-site
 * destinations so the panel can render safe target/rel attributes.
 */
export type ResearchContextAction = {
  href: string;
  label: string;
  detail: string;
  external?: boolean;
};

/**
 * A grouped list of related research links.
 *
 * `emptyText` is shown when the section has no links so pages can still explain
 * missing relationship coverage.
 */
export type ResearchContextSection = {
  title: string;
  emptyText: string;
  links: ResearchContextLink[];
};

/**
 * Renders a reusable research context panel with relationship sections and
 * suggested next moves.
 *
 * @param id Stable section id used for the heading relationship; defaults to
 * `research-context`.
 * @param eyebrow Small label above the title; defaults to `Research context`.
 * @param title Panel heading that names the current relationship hub.
 * @param description Short explanatory copy for the current page context.
 * @param sections Grouped relationship links shown in columns.
 * @param actions Suggested next-step links shown in the action rail.
 * @param actionEyebrow Accessible label and visual eyebrow for actions;
 * defaults to `Suggested moves`.
 * @returns The panel, or `null` when there are no section links and no actions.
 */
export function ResearchContextPanel({
  id = "research-context",
  eyebrow = "Research context",
  title,
  description,
  sections,
  actions,
  actionEyebrow = "Suggested moves",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description: string;
  sections: ResearchContextSection[];
  actions: ResearchContextAction[];
  actionEyebrow?: string;
}) {
  const hasSections = sections.some((section) => section.links.length > 0);
  const hasActions = actions.length > 0;

  if (!hasSections && !hasActions) return null;

  return (
    <section id={id} aria-labelledby={`${id}-title`} style={sectionStyle}>
      <div style={introStyle}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {eyebrow}
        </div>
        <h2 id={`${id}-title`} style={headingStyle}>
          {title}
        </h2>
        <p className="muted" style={introCopyStyle}>
          {description}
        </p>
      </div>

      <div style={columnsStyle}>
        {sections.map((section) => (
          <ContextColumn key={section.title} title={section.title}>
            {section.links.length > 0 ? (
              section.links.map((link) => (
                <ContextLink key={`${link.href}-${link.label}`} item={link} />
              ))
            ) : (
              <EmptyLine text={section.emptyText} />
            )}
          </ContextColumn>
        ))}
      </div>

      {hasActions && (
        <aside aria-label={actionEyebrow} style={movesStyle}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {actionEyebrow}
          </div>
          <div style={listStyle}>
            {actions.map((action) => (
              <MoveLink key={`${action.href}-${action.label}`} item={action} />
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}

function ContextColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={columnStyle}>
      <h3 style={columnHeadingStyle}>{title}</h3>
      <div style={listStyle}>{children}</div>
    </div>
  );
}

function ContextLink({ item }: { item: ResearchContextLink }) {
  const content = (
    <>
      <span style={textClampStyle}>{item.label}</span>
      <span className="muted" style={metaStyle}>
        {item.meta}
      </span>
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        style={contextLinkStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} style={contextLinkStyle}>
      {content}
    </Link>
  );
}

function MoveLink({ item }: { item: ResearchContextAction }) {
  const content = (
    <>
      <span style={textClampStyle}>
        <strong style={moveLabelStyle}>{item.label}</strong>
        <span className="muted" style={moveDetailStyle}>
          {item.detail}
        </span>
      </span>
      <ArrowRightIcon />
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        style={moveLinkStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} style={moveLinkStyle}>
      {content}
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.45 }}>
      {text}
    </p>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m9 4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 24,
  marginTop: 28,
  padding: 24,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, var(--accent-soft)), var(--surface))",
  boxShadow: "var(--shadow-sm)",
};

const introStyle: CSSProperties = {
  gridColumn: "1 / -1",
  maxWidth: 760,
};

const headingStyle: CSSProperties = {
  fontSize: "clamp(1.45rem, 1.25rem + 0.7vw, 2rem)",
  letterSpacing: 0,
  marginBottom: 8,
};

const introCopyStyle: CSSProperties = {
  maxWidth: "62ch",
  lineHeight: 1.55,
};

const columnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
  gap: 18,
  minWidth: 0,
};

const columnStyle: CSSProperties = {
  minWidth: 0,
};

const columnHeadingStyle: CSSProperties = {
  marginBottom: 10,
  fontFamily: "var(--font-sans)",
  fontSize: "0.86rem",
  fontWeight: 700,
  letterSpacing: 0,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const baseLinkStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  minWidth: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "color-mix(in srgb, var(--surface) 88%, transparent)",
  color: "var(--text)",
  textDecoration: "none",
};

const contextLinkStyle: CSSProperties = {
  ...baseLinkStyle,
  minHeight: 64,
  padding: "10px 12px",
  alignItems: "flex-start",
  flexDirection: "column",
};

const moveLinkStyle: CSSProperties = {
  ...baseLinkStyle,
  minHeight: 62,
  padding: "11px 13px",
  alignItems: "center",
};

const textClampStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  fontSize: "0.76rem",
  lineHeight: 1.35,
};

const movesStyle: CSSProperties = {
  borderTop: "1px solid var(--border)",
  paddingTop: 18,
  minWidth: 0,
};

const moveLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.88rem",
  lineHeight: 1.25,
};

const moveDetailStyle: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: "0.76rem",
  lineHeight: 1.35,
};
