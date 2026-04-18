import type { EntityFact } from "@/lib/api-types";
import { formatDate } from "@/lib/format";

/**
 * Structured quick-facts block for an entity page. Backed by the
 * jfk_curated.entity_facts table (sql/19). Each fact carries a source
 * citation rendered as a small label next to the value.
 */
export function EntityQuickFacts({ facts }: { facts: EntityFact[] }) {
  if (facts.length === 0) return null;

  const FACT_LABELS: Record<string, string> = {
    born: "Born",
    died: "Died",
    birth_name: "Birth name",
    aliases: "Aliases",
    enlisted_marines: "Enlisted",
    marine_assignment: "Marine assignment",
    defected_ussr: "Defected",
    married: "Married",
    married_oswald: "Married",
    returned_us: "Returned to U.S.",
    residence_1963: "Residence, 1963",
    employer_1963: "Employer, 1963",
    mexico_city_visit: "Mexico City visit",
    arrested: "Arrested",
    business_1963: "Business, 1963",
    shot_oswald: "Shot Oswald",
    convicted: "Convicted",
    conviction_reversed: "Conviction reversed",
    wc_testimony_appearances: "WC testimony",
    role_1963: "Role, 1963",
    tenure: "Tenure",
    ci_tenure: "CI tenure",
    role_in_case: "Role in the case",
    established: "Established",
    chair: "Chair",
    general_counsel: "General Counsel",
    chief_counsel: "Chief Counsel",
    members: "Members",
    witnesses: "Witnesses",
    report_delivered: "Report delivered",
    report_published: "Report published",
    hearings_volumes: "Hearings volumes",
    scope: "Scope",
    central_finding_jfk: "Central finding (JFK)",
    acoustic_rebuttal: "Acoustic rebuttal",
    founded: "Founded",
    headquarters: "Headquarters",
    dci_nov_1963: "DCI, Nov 1963",
    director_nov_1963: "Director, Nov 1963",
    key_components_in_case: "Key components",
    primary_components_in_case: "Primary components",
    arrived_us: "Arrived in U.S.",
  };

  return (
    <section
      aria-label="Quick facts"
      style={{
        marginTop: 28,
        marginBottom: 36,
        padding: "18px 22px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 14,
        }}
      >
        Quick facts
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, auto) 1fr",
          rowGap: 10,
          columnGap: 18,
          margin: 0,
          fontSize: "0.92rem",
          lineHeight: 1.5,
        }}
      >
        {facts.map((f, i) => (
          <div key={i} style={{ display: "contents" }}>
            <dt
              className="muted"
              style={{ fontSize: "0.82rem", letterSpacing: "0.01em" }}
            >
              {FACT_LABELS[f.key] ?? humanize(f.key)}
            </dt>
            <dd style={{ margin: 0, color: "var(--text)" }}>
              <span>{f.value}</span>
              <span
                title={`Source: ${f.sourceType} · ${f.sourceRef} · confidence: ${f.confidence}`}
                className="muted"
                style={{
                  marginLeft: 8,
                  fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {f.sourceType}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
