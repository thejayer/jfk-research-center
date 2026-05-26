import type { Metadata } from "next";
import { fetchEntityCooccurrence } from "@/lib/api-client";
import { CaseLinkChart } from "@/components/graph/case-link-chart";
import { parseCaseLinkChartUrlState } from "@/lib/case-link-chart-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Case link chart",
  description:
    "Investigation-style link chart of people, agencies, places, concepts, and official media connected across JFK records.",
};

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialUrlState = parseCaseLinkChartUrlState(await searchParams);
  const graph = await fetchEntityCooccurrence({
    yearFrom: initialUrlState.yearFrom,
    yearTo: initialUrlState.yearTo,
  });

  return (
    <div
      className="container"
      style={{ paddingTop: 40, paddingBottom: 96 }}
    >
      <header style={{ maxWidth: "68ch", marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Case link chart
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
          Map the case by people, agencies, places, concepts, and media
        </h1>
        <p
          style={{
            fontSize: "1.02rem",
            lineHeight: 1.65,
            color: "var(--text)",
          }}
        >
          A digital case board for seeing which entities appear together in
          the archive, plus official media records connected by curated
          metadata. Cards are grouped by type, lines are labeled by shared
          records or media links, and the date range lets you isolate the 1963
          investigation, the HSCA period, or later declassification eras. A
          shared mention is not proof of a relationship; it is a trailhead for
          reading the underlying records.
        </p>
      </header>

      <CaseLinkChart initial={graph} initialUrlState={initialUrlState} />
    </div>
  );
}
