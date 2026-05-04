import type { Metadata } from "next";
import { fetchEntities } from "@/lib/api-client";
import { EntityExplorer } from "@/components/entities/entity-explorer";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entities",
  description:
    "People and organizations whose records structure every JFK inquiry: defendants, investigators, witnesses, and the agencies that hold the files.",
};

export default async function EntitiesIndexPage() {
  const entities = await fetchEntities();
  const { peopleCount, orgCount, mentionCount } = entities.reduce(
    (stats, entity) => {
      if (entity.type === "person") stats.peopleCount += 1;
      if (entity.type === "org") stats.orgCount += 1;
      stats.mentionCount += entity.mentionCount ?? 0;
      return stats;
    },
    { peopleCount: 0, orgCount: 0, mentionCount: 0 },
  );

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "74ch", marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Entities
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: 0,
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          People &amp; organizations
        </h1>
        <p className="muted" style={{ fontSize: "1.02rem", lineHeight: 1.65 }}>
          The people and institutions whose records structure every JFK
          inquiry: defendants, investigators, witnesses, and the agencies
          that hold the files. Each entity page collects the primary
          documents, the curated biographical facts with source citations,
          and the related people and topics the record associates with that
          name.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginTop: 24,
            maxWidth: 620,
          }}
        >
          <EntityStat label="Entities" value={entities.length} />
          <EntityStat label="People" value={peopleCount} />
          <EntityStat label="Organizations" value={orgCount} />
          <EntityStat label="Mentions" value={mentionCount} />
        </div>
      </header>

      {entities.length === 0 ? (
        <EmptyState
          title="No entities yet"
          description="The entity roster is empty or failed to load. Try the main search while we investigate."
          action={<LinkButton href="/search">Go to search &rarr;</LinkButton>}
        />
      ) : (
        <EntityExplorer entities={entities} />
      )}
    </div>
  );
}

function EntityStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        borderLeft: "2px solid var(--accent)",
        paddingLeft: 12,
      }}
    >
      <div
        className="num"
        style={{
          color: "var(--text)",
          fontSize: "1.05rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(value)}
      </div>
      <div
        className="eyebrow"
        style={{ color: "var(--text-muted)", fontSize: "0.66rem" }}
      >
        {label}
      </div>
    </div>
  );
}
