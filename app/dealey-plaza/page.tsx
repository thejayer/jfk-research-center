import type { Metadata } from "next";
import Link from "next/link";
import { fetchDealeyPlazaWitnesses } from "@/lib/api-client";
import { DealeyPlazaMap } from "@/components/dealey-plaza/dealey-plaza-map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dealey Plaza — interactive witness map",
  description:
    "Schematic map of 1963 Dealey Plaza with witness positions plotted from each witness's own statement. All reported shot origins are shown without color emphasis on any single hypothesis.",
};

export default async function DealeyPlazaPage() {
  const data = await fetchDealeyPlazaWitnesses();

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 96 }}>
      <header style={{ maxWidth: "72ch", marginBottom: 28 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Dealey Plaza
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          Witness positions, November 22, 1963
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          A schematic of Dealey Plaza with{" "}
          <strong>{data.witnesses.length}</strong> witnesses plotted at the
          stand point each described in their own statement. Pin colors
          encode where each witness perceived the shots came from. Use
          the legend chips above the map to filter; click any pin to
          read the statement summary, the number of shots reported, and
          the Warren Commission testimony reference where applicable.
        </p>
      </header>

      <DealeyPlazaMap data={data} />

      <section
        style={{
          marginTop: 48,
          maxWidth: "72ch",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.35rem",
            letterSpacing: "-0.005em",
            marginBottom: 8,
          }}
        >
          About this map
        </h2>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.65 }}>
          Witness statements are summarized from the Warren Commission
          Hearings (Vols. 2-7, 19, 24) and from finding aids at the U.S.
          National Archives and the Sixth Floor Museum. The schematic is
          drawn to approximate proportions of 1963 Dealey Plaza and is
          not a survey-grade representation. Pin positions are derived
          from each witness&rsquo;s own description of where they were
          standing — this map shows what each said, not where any of them
          in fact were.
        </p>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.65, marginTop: 12 }}>
          For broader context, see the{" "}
          <Link href="/topic/dealey-plaza">Dealey Plaza topic page</Link>{" "}
          for the underlying records, the{" "}
          <Link href="/evidence">physical evidence catalog</Link> for
          ballistic and photographic items, and{" "}
          <Link href="/established-facts">Established Facts</Link> for
          the agreed-on chronology.
        </p>
      </section>
    </div>
  );
}
