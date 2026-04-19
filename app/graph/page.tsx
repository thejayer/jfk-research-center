import type { Metadata } from "next";
import { fetchEntityCooccurrence } from "@/lib/api-client";
import { CooccurrenceGraphViz } from "@/components/graph/cooccurrence-graph";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network",
  description:
    "Force-directed graph of entity co-occurrences across the collection — who appears in records with whom, filterable by event-date range.",
};

export default async function GraphPage() {
  const graph = await fetchEntityCooccurrence();

  return (
    <div
      className="container"
      style={{ paddingTop: 40, paddingBottom: 96 }}
    >
      <header style={{ maxWidth: "68ch", marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Network
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
          }}
        >
          Entity co-occurrence
        </h1>
        <p
          style={{
            fontSize: "1.02rem",
            lineHeight: 1.65,
            color: "var(--text)",
          }}
        >
          Every pair of people and organizations that appears together in a
          record, aggregated over a user-selected date range. The goal is
          not to prove a connection — a shared mention only means the two
          names landed in the same document — but to surface who the
          collection treats as adjacent to whom. Use the range slider below
          to isolate specific eras: the 1963 investigation, the
          1976–79 HSCA period, the 1990s ARRB release era.
        </p>
      </header>

      <CooccurrenceGraphViz initial={graph} />
    </div>
  );
}
