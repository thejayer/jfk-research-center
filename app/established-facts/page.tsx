import type { Metadata } from "next";
import Link from "next/link";
import { fetchEstablishedFactsIndex } from "@/lib/api-client";
import type {
  EstablishedFact,
  EstablishedFactCategory,
  EstablishedFactConfidence,
} from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNumber } from "@/lib/format";

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

const CONFIDENCE_META: Record<
  EstablishedFactConfidence,
  { summary: string; tone: string; accent: string }
> = {
  Settled: {
    summary: "Broad official agreement",
    tone: "Record floor",
    accent: "var(--cat-investigation)",
  },
  "Well-supported": {
    summary: "Strong record support",
    tone: "High confidence",
    accent: "var(--cat-biographical)",
  },
  Contested: {
    summary: "Official record tension",
    tone: "Handled separately",
    accent: "var(--accent)",
  },
};

const CATEGORY_LABELS: Record<EstablishedFactCategory, string> = {
  ballistic: "Ballistic",
  witness: "Witness",
  medical: "Medical",
  chronology: "Chronology",
  documentary: "Documentary",
  operational: "Operational",
  legal: "Legal",
};

function confidenceAnchor(confidence: EstablishedFactConfidence): string {
  return `tier-${confidence.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default async function EstablishedFactsPage() {
  const data = await fetchEstablishedFactsIndex();
  const totalFacts = data.facts.length;
  const topicCount = new Set(data.facts.map((fact) => fact.topicId)).size;
  const citationCount = new Set(
    data.facts.flatMap((fact) => fact.supportingCitations),
  ).size;
  const documentCount = new Set(
    data.facts.flatMap((fact) => fact.supportingNaids),
  ).size;

  const byConfidence = new Map<EstablishedFactConfidence, EstablishedFact[]>();
  for (const fact of data.facts) {
    const list = byConfidence.get(fact.confidence) ?? [];
    list.push(fact);
    byConfidence.set(fact.confidence, list);
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Established Facts</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 40,
          paddingBottom: 34,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Record floor
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            What the record agrees on
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            This catalog is the counterweight to{" "}
            <Link href="/open-questions">Open Questions</Link>: a focused map
            of findings that can be stated without collapsing every dispute
            into the same bucket.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 18 }}
          >
            Each entry is grouped by confidence tier, tied back to a topic,
            and sourced through the citation registry or archival document
            links. Contested items stay visible, but they are treated as record
            tensions rather than settled ground.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <LinkButton href="#tier-settled" variant="primary" size="sm">
              Start with settled facts
            </LinkButton>
            <LinkButton href="/open-questions" variant="secondary" size="sm">
              Compare open questions
            </LinkButton>
          </div>
        </div>

        <aside
          aria-label="Established facts profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Evidence profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["Facts", totalFacts],
              ["Topics", topicCount],
              ["Citations", citationCount],
              ["Docs", documentCount],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 6px",
                  textAlign: "center",
                }}
              >
                <div className="num" style={{ fontSize: "1.12rem" }}>
                  {formatNumber(Number(value))}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.62rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginTop: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Confidence labels keep settled findings, strong support, and
            official record conflicts in separate lanes.
          </p>
        </aside>
      </header>

      <section
        aria-label="Confidence and topic overview"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 20,
          marginTop: 26,
          marginBottom: 44,
        }}
      >
        <nav
          aria-label="Confidence tiers"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
          }}
        >
          {data.countsByConfidence
            .filter((c) => c.count > 0)
            .map((c) => {
              const meta = CONFIDENCE_META[c.confidence];
              return (
                <a
                  key={c.confidence}
                  href={`#${confidenceAnchor(c.confidence)}`}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: "14px 14px 13px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    color: "var(--text)",
                    textDecoration: "none",
                    minHeight: 156,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "1.18rem",
                          lineHeight: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        {c.confidence}
                      </div>
                      <div
                        className="muted"
                        style={{
                          fontSize: "0.72rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {meta.tone}
                      </div>
                    </div>
                    <span
                      className="num"
                      style={{
                        minWidth: 34,
                        height: 34,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        border: "1px solid var(--border-strong)",
                        color: meta.accent,
                      }}
                    >
                      {c.count}
                    </span>
                  </div>
                  <p
                    className="muted"
                    style={{ fontSize: "0.82rem", lineHeight: 1.5 }}
                  >
                    {meta.summary}. {CONFIDENCE_DESCRIPTION[c.confidence]}
                  </p>
                </a>
              );
            })}
        </nav>

        <aside
          aria-label="Topics represented"
          style={{
            borderLeft: "1px solid var(--border)",
            paddingLeft: 18,
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
        >
          <div className="eyebrow">Topics represented</div>
          {data.countsByTopic.map((topic) => (
            <Link
              key={topic.topicId}
              href={`/topic/${encodeURIComponent(topic.topicId)}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
                color: "var(--text)",
                textDecoration: "none",
                paddingBottom: 10,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ minWidth: 0 }}>{topic.topicTitle ?? topic.topicId}</span>
              <span className="muted num">{topic.count}</span>
            </Link>
          ))}
        </aside>
      </section>

      {CONFIDENCE_ORDER.map((tier) => {
        const facts = byConfidence.get(tier) ?? [];
        if (facts.length === 0) return null;
        const meta = CONFIDENCE_META[tier];
        return (
          <section
            key={tier}
            id={confidenceAnchor(tier)}
            style={{
              marginBottom: 58,
              scrollMarginTop: "calc(var(--header-height) + 20px)",
            }}
            aria-label={tier}
          >
            <SectionHeading
              eyebrow={tier}
              title={`${tier} facts`}
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
              {facts.map((fact, index) => (
                <EstablishedFactCard
                  key={fact.id}
                  fact={fact}
                  index={index + 1}
                  accent={meta.accent}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function EstablishedFactCard({
  fact,
  index,
  accent,
}: {
  fact: EstablishedFact;
  index: number;
  accent: string;
}) {
  const sourceCount =
    fact.supportingCitations.length + fact.supportingNaids.length;

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 16,
        padding: "20px 22px 20px 18px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <div
        aria-hidden
        className="num"
        style={{
          width: 34,
          height: 34,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          color: accent,
          fontSize: "0.86rem",
        }}
      >
        {String(index).padStart(2, "0")}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {fact.topicTitle && (
            <Link
              href={fact.topicHref}
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
              {fact.topicTitle}
            </Link>
          )}
          <Badge tone="muted" size="sm">
            {CATEGORY_LABELS[fact.category]}
          </Badge>
          <span
            className="muted"
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {sourceCount} {sourceCount === 1 ? "source" : "sources"}
          </span>
        </div>

        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.08rem, 1rem + 0.25vw, 1.24rem)",
            lineHeight: 1.35,
            letterSpacing: 0,
            color: "var(--text)",
            marginBottom: 10,
          }}
        >
          {fact.claim}
        </div>

        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.65,
            color: "var(--text)",
            marginBottom: sourceCount > 0 ? 12 : 0,
          }}
        >
          {fact.longForm}
        </p>

        {sourceCount > 0 && (
          <div
            aria-label="Supporting sources"
            className="muted"
            style={{
              fontSize: "0.78rem",
              lineHeight: 1.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span style={{ letterSpacing: "0.04em" }}>Sources:</span>
            {fact.supportingCitations.map((citation) => (
              <Link
                key={citation}
                href={`/bibliography#${encodeURIComponent(citation)}`}
                className="num"
                style={{
                  padding: "1px 7px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                {citation}
              </Link>
            ))}
            {fact.supportingNaids.map((naid) => (
              <Link
                key={naid}
                href={`/document/${encodeURIComponent(naid)}`}
                className="num"
                style={{
                  padding: "1px 7px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                NAID {naid}
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
