import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import type {
  EntityRelationshipNode,
  EntityRelationshipPath,
  EntityRelationshipStrength,
} from "@/lib/entity-relationship-paths";

const strengthLabel: Record<EntityRelationshipStrength, string> = {
  direct: "Direct record",
  context: "Context path",
  lead: "Research lead",
};

const nodeTypeLabel: Record<EntityRelationshipNode["type"], string> = {
  entity: "Entity",
  document: "Record",
  topic: "Topic",
  timeline: "Timeline",
  "related-entity": "Entity",
};

/**
 * Renders guided paths from an entity into linked records, timeline anchors,
 * topic lanes, and related entity profiles.
 */
export function EntityRelationshipPaths({
  entityName,
  paths,
}: {
  entityName: string;
  paths: EntityRelationshipPath[];
}) {
  return (
    <section
      aria-label={`${entityName} relationship paths`}
      style={{ marginTop: 56 }}
    >
      <SectionHeading
        eyebrow="Relationship paths"
        title="Guided paths through the record"
        description={`Follow compact, source-linked paths from ${entityName} into records, chronology, topic lanes, and related profiles. These paths show indexed relationships, not causal claims.`}
      />

      {paths.length > 0 ? (
        <div style={gridStyle}>
          {paths.map((path) => (
            <article key={path.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <Badge tone={path.strength === "direct" ? "accent" : "outline"} size="sm">
                  {strengthLabel[path.strength]}
                </Badge>
                <h3 style={cardTitleStyle}>{path.title}</h3>
              </div>
              <p className="muted" style={summaryStyle}>
                {path.summary}
              </p>

              <ol aria-label={`${path.title} nodes`} style={chainStyle}>
                <li style={stepStyle}>
                  <PathNode node={path.origin} />
                </li>
                {path.hops.map((hop, index) => (
                  <li key={`${path.id}-${hop.node.href}-${index}`} style={stepStyle}>
                    <ArrowIcon />
                    <PathNode node={hop.node} reason={hop.reason} />
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Not enough indexed links yet
          </div>
          <p className="muted" style={{ fontSize: "0.92rem", lineHeight: 1.55 }}>
            This profile does not yet have enough linked records, topic lanes, or
            chronology entries to build relationship paths. Mention search and
            document discovery remain available below.
          </p>
        </div>
      )}
    </section>
  );
}

function PathNode({
  node,
  reason,
}: {
  node: EntityRelationshipNode;
  reason?: string;
}) {
  return (
    <Link href={node.href} style={nodeStyle}>
      <span style={nodeHeaderStyle}>
        <span className="eyebrow" style={nodeTypeStyle}>
          {nodeTypeLabel[node.type]}
        </span>
        <span className="muted" style={nodeMetaStyle}>
          {node.meta}
        </span>
      </span>
      <span style={nodeLabelStyle}>{node.label}</span>
      {reason && (
        <span className="muted" style={reasonStyle}>
          {reason}
        </span>
      )}
    </Link>
  );
}

function ArrowIcon() {
  return (
    <span aria-hidden="true" style={arrowStyle}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 14,
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: "18px 18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "1.1rem",
  lineHeight: 1.2,
  letterSpacing: 0,
  fontWeight: 500,
};

const summaryStyle: CSSProperties = {
  fontSize: "0.88rem",
  lineHeight: 1.5,
};

const chainStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const stepStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 9,
  alignItems: "start",
};

const nodeStyle: CSSProperties = {
  gridColumn: "2",
  color: "var(--text)",
  textDecoration: "none",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
  background: "var(--surface-2)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const nodeHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0,
};

const nodeTypeStyle: CSSProperties = {
  fontSize: "0.67rem",
  letterSpacing: "0.08em",
  color: "var(--accent)",
};

const nodeMetaStyle: CSSProperties = {
  fontSize: "0.73rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const nodeLabelStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "0.98rem",
  lineHeight: 1.3,
  letterSpacing: 0,
};

const reasonStyle: CSSProperties = {
  fontSize: "0.78rem",
  lineHeight: 1.4,
};

const arrowStyle: CSSProperties = {
  gridColumn: "1",
  display: "inline-flex",
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "1px solid var(--border)",
  color: "var(--text-muted)",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 10,
};

const emptyStyle: CSSProperties = {
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  padding: "20px 22px",
};
