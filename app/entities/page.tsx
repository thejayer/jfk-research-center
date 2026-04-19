import type { Metadata } from "next";
import Link from "next/link";
import { fetchEntities } from "@/lib/api-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entities",
  description:
    "People and organizations whose records structure every JFK inquiry — defendants, investigators, witnesses, and the agencies that hold the files.",
};

const TYPE_LABEL: Record<string, string> = {
  person: "Person",
  org: "Organization",
  place: "Place",
  concept: "Concept",
};

export default async function EntitiesIndexPage() {
  const entities = await fetchEntities();

  const people = entities.filter((e) => e.type === "person");
  const orgs = entities.filter((e) => e.type === "org");

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Entities
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
          People &amp; organizations
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          The people and institutions whose records structure every JFK
          inquiry: defendants, investigators, witnesses, and the agencies
          that hold the files. Each entity page collects the primary
          documents, the curated biographical facts with source citations,
          and the related people and topics the record associates with that
          name.
        </p>
      </header>

      {people.length > 0 && (
        <section aria-label="People" style={{ marginBottom: 56 }}>
          <SectionHeading
            eyebrow="People"
            title={`People — ${people.length}`}
          />
          <EntityGrid entities={people} />
        </section>
      )}

      {orgs.length > 0 && (
        <section aria-label="Organizations" style={{ marginBottom: 56 }}>
          <SectionHeading
            eyebrow="Organizations"
            title={`Organizations — ${orgs.length}`}
          />
          <EntityGrid entities={orgs} />
        </section>
      )}
    </div>
  );
}

function EntityGrid({
  entities,
}: {
  entities: Awaited<ReturnType<typeof fetchEntities>>;
}) {
  return (
    <ul
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14,
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {entities.map((e) => (
        <li key={e.slug}>
          <Link
            href={e.href}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "18px 20px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text)",
              height: "100%",
              minHeight: 140,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Badge tone="muted" size="sm">
                {TYPE_LABEL[e.type] ?? e.type}
              </Badge>
              {e.mentionCount !== undefined && e.mentionCount > 0 && (
                <span
                  className="muted num"
                  style={{ fontSize: "0.8rem" }}
                >
                  {formatNumber(e.mentionCount)} mentions
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.15rem",
                letterSpacing: "-0.005em",
                lineHeight: 1.25,
              }}
            >
              {e.name}
            </div>
            <p
              className="muted"
              style={{
                fontSize: "0.88rem",
                lineHeight: 1.55,
                flex: 1,
              }}
            >
              {e.summary}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
