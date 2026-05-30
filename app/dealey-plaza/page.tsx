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
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 20,
          alignItems: "start",
          marginBottom: 28,
        }}
      >
        <div style={{ maxWidth: "72ch" }}>
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
          A neutral research interface for comparing{" "}
          <strong>{data.witnesses.length}</strong> witness statements by
          stated position, perceived shot origin, reported shots, and source
          reference.
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          <Link
            href="/topic/dealey-plaza"
            style={{
              padding: "9px 14px",
              background: "var(--text)",
              color: "var(--bg)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.9rem",
            }}
          >
            Open topic dossier
          </Link>
          <Link
            href="/dealey-plaza/trajectory"
            style={{
              padding: "9px 14px",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.9rem",
            }}
          >
            Compare trajectories
          </Link>
        </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <section
            aria-labelledby="dealey-map-reading"
            style={{
              padding: 18,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
            }}
          >
            <h2
              id="dealey-map-reading"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.05rem",
                margin: 0,
              }}
            >
              Reading the map
            </h2>
            <ul
              style={{
                margin: "10px 0 0",
                paddingLeft: 18,
                color: "var(--text-muted)",
                lineHeight: 1.55,
                fontSize: "0.92rem",
              }}
            >
              <li>Pins represent witness-stated positions, not verified coordinates.</li>
              <li>Colors group each witness by perceived shot origin.</li>
              <li>The witness index mirrors the map for scan-and-compare research.</li>
            </ul>
          </section>
          <section
            aria-label="Method note"
            style={{
              padding: 18,
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-md)",
              background: "color-mix(in srgb, var(--surface) 70%, transparent)",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
              Method note
            </div>
            <p
              style={{
                margin: "8px 0 0",
                lineHeight: 1.6,
                fontSize: "0.92rem",
                color: "var(--text)",
              }}
            >
              Positions are based on each witness&apos;s own statement. The
              schematic is not survey-grade, and color does not privilege any
              hypothesis about shot origin.
            </p>
          </section>
        </div>
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
