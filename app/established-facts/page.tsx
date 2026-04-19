import type { Metadata } from "next";
import Link from "next/link";
import { fetchEstablishedFactsIndex } from "@/lib/api-client";
import type {
  EstablishedFact,
  EstablishedFactConfidence,
} from "@/lib/api-types";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Established Facts",
  description:
    "Catalog of settled and well-supported findings in the JFK assassination case, drawn from the Warren Commission, HSCA, Church Committee, ARRB, and independent review panels.",
};

const CONFIDENCE_ORDER: EstablishedFactConfidence[] = [
  "Settled",
  "Well-supported",
  "Contested",
];

const CONFIDENCE_DESCRIPTION: Record<EstablishedFactConfidence, string> = {
  Settled:
    "Agreed across the Warren Commission, HSCA, and ARRB records. No credible dispute in the official investigative record.",
  "Well-supported":
    "Agreed by most official investigations. A minority critique exists, but the evidentiary record is strong.",
  Contested:
    "The record itself is inconsistent across investigative bodies or on the evidence. Presented honestly as unresolved.",
};

export default async function EstablishedFactsPage() {
  const data = await fetchEstablishedFactsIndex();

  const byConfidence = new Map<EstablishedFactConfidence, EstablishedFact[]>();
  for (const f of data.facts) {
    const list = byConfidence.get(f.confidence) ?? [];
    list.push(f);
    byConfidence.set(f.confidence, list);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Established Facts
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          What the record agrees on
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          This catalog is the counterweight to{" "}
          <Link href="/open-questions">Open Questions</Link>. It lists the
          findings the Warren Commission, HSCA, ARRB, Church Committee, and
          independent review panels substantially agree on — alongside a
          smaller set of claims where the official record itself is
          inconsistent. Each fact is grouped by a confidence tier and
          sourced to the citation registry.
        </p>
      </header>

      <nav
        aria-label="Confidence tiers"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 40,
        }}
      >
        {data.countsByConfidence
          .filter((c) => c.count > 0)
          .map((c) => (
            <a
              key={c.confidence}
              href={`#tier-${c.confidence.toLowerCase().replace(/-/g, "")}`}
              style={{
                padding: "8px 16px",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                fontSize: "0.86rem",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {c.confidence} · {c.count}
            </a>
          ))}
      </nav>

      {CONFIDENCE_ORDER.map((tier) => {
        const facts = byConfidence.get(tier) ?? [];
        if (facts.length === 0) return null;
        return (
          <section
            key={tier}
            id={`tier-${tier.toLowerCase().replace(/-/g, "")}`}
            style={{ marginBottom: 56 }}
            aria-label={tier}
          >
            <SectionHeading
              eyebrow={tier}
              title={`${tier} — ${facts.length} facts`}
              description={CONFIDENCE_DESCRIPTION[tier]}
            />
            <ol
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {facts.map((f) => (
                <li
                  key={f.id}
                  style={{
                    padding: "20px 22px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {f.topicTitle && (
                      <Link
                        href={f.topicHref}
                        style={{
                          fontSize: "0.72rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          padding: "2px 8px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 4,
                          textDecoration: "none",
                        }}
                      >
                        {f.topicTitle}
                      </Link>
                    )}
                    <span
                      className="muted"
                      style={{
                        fontSize: "0.72rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {f.category}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.15rem",
                      lineHeight: 1.35,
                      letterSpacing: "-0.005em",
                      color: "var(--text)",
                      marginBottom: 10,
                    }}
                  >
                    {f.claim}
                  </div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.65,
                      color: "var(--text)",
                      marginBottom: 10,
                    }}
                  >
                    {f.longForm}
                  </p>
                  {(f.supportingCitations.length > 0 ||
                    f.supportingNaids.length > 0) && (
                    <div
                      className="muted"
                      style={{
                        fontSize: "0.78rem",
                        lineHeight: 1.5,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <span style={{ letterSpacing: "0.04em" }}>
                        Sources:
                      </span>
                      {f.supportingCitations.map((c) => (
                        <span
                          key={c}
                          className="num"
                          style={{
                            padding: "1px 6px",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                          }}
                        >
                          {c}
                        </span>
                      ))}
                      {f.supportingNaids.map((n) => (
                        <Link
                          key={n}
                          href={`/document/${encodeURIComponent(n)}`}
                          className="num"
                          style={{
                            padding: "1px 6px",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                          }}
                        >
                          NAID {n}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
