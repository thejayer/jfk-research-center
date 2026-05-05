import type { EntityDetail } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatNumber, formatYearRange } from "@/lib/format";

export function EntityHero({
  entity,
  searchHref,
  documentsHref,
}: {
  entity: EntityDetail;
  searchHref: string;
  documentsHref?: string;
}) {
  const years = formatYearRange(entity.born, entity.died) ?? entity.activeYears;
  const typeLabel =
    entity.type === "person"
      ? "Person"
      : entity.type === "org"
        ? "Organization"
        : entity.type === "place"
          ? "Place"
          : "Concept";

  return (
    <header
      style={{
        paddingTop: 48,
        paddingBottom: 38,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="entity-profile-hero">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <Badge tone="accent" size="sm">
              {typeLabel}
            </Badge>
            {years && (
              <span className="muted num" style={{ fontSize: "0.88rem" }}>
                {years}
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 18,
            }}
          >
            {entity.name}
          </h1>

          {entity.headline && (
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.1rem, 0.9rem + 0.5vw, 1.35rem)",
                color: "var(--text)",
                maxWidth: "62ch",
                lineHeight: 1.45,
                marginBottom: 18,
              }}
            >
              {entity.headline}
            </p>
          )}

          <p
            className="muted"
            style={{ maxWidth: "68ch", fontSize: "1rem", lineHeight: 1.65 }}
          >
            {entity.description}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 24,
            }}
          >
            <LinkButton href={searchHref} variant="primary">
              Search mentions
              <ArrowRightIcon />
            </LinkButton>
            {documentsHref && (
              <LinkButton href={documentsHref} variant="secondary">
                View documents
                <ArrowRightIcon />
              </LinkButton>
            )}
          </div>
        </div>

        <aside
          aria-label={`${entity.name} research profile`}
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "18px 20px",
            boxShadow: "var(--shadow-sm)",
            alignSelf: "start",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Research profile
          </div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 14,
              margin: 0,
            }}
          >
            {entity.documentCount !== undefined && (
              <Stat label="Documents" value={formatNumber(entity.documentCount)} />
            )}
            {entity.mentionCount !== undefined && (
              <Stat label="Mentions" value={formatNumber(entity.mentionCount)} />
            )}
            {years && <Stat label="Coverage" value={years} compact />}
          </dl>

          {entity.aliases.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Also known as
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {entity.aliases.map((a) => (
                  <Badge key={a} tone="outline" size="sm">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: compact ? "1.2rem" : "1.8rem",
          letterSpacing: 0,
          lineHeight: 1.1,
          marginTop: 6,
        }}
      >
        {value}
      </dd>
    </div>
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
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
