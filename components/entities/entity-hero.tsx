import type { EntityDetail } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatYearRange } from "@/lib/format";

export function EntityHero({ entity }: { entity: EntityDetail }) {
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
        paddingBottom: 48,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
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
          letterSpacing: "-0.02em",
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

      {entity.aliases.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            Also known as
          </div>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            {entity.aliases.map((a) => (
              <Badge key={a} tone="outline" size="sm">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <dl
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 20,
          maxWidth: 640,
        }}
      >
        {entity.documentCount !== undefined && (
          <Stat label="Documents" value={formatNumber(entity.documentCount)} />
        )}
        {entity.mentionCount !== undefined && (
          <Stat label="Mentions" value={formatNumber(entity.mentionCount)} />
        )}
      </dl>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="num"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.8rem",
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
          marginTop: 6,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
