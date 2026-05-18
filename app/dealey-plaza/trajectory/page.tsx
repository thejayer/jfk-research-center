import type { Metadata } from "next";
import Link from "next/link";
import { TrajectorySandbox } from "@/components/dealey-plaza/trajectory-sandbox";
import { fetchHistoricalDealeyPlazaWitnesses } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Dealey Plaza trajectory sandbox",
  description:
    "A deterministic 3D geometry sandbox for Dealey Plaza trajectory assumptions and ray math.",
};

export default async function DealeyPlazaTrajectoryPage() {
  const historicalWitnessPayload = await fetchHistoricalDealeyPlazaWitnesses();

  return (
    <div style={{ paddingBottom: 96 }}>
      <div className="container" style={{ paddingTop: 32, marginBottom: 26 }}>
        <div style={{ maxWidth: "76ch" }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Dealey Plaza / trajectory sandbox
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2rem, 1.45rem + 1.8vw, 3rem)",
              letterSpacing: 0,
              marginTop: 8,
              marginBottom: 14,
              lineHeight: 1.08,
            }}
          >
            Geometry first, conclusions last.
          </h1>
          <p
            className="muted"
            style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
          >
            This sandbox models a straight-line ray through a plaza-relative
            coordinate frame. The scene is not survey-grade and does not assert
            a shot origin; it gives researchers a controlled place to vary
            assumptions and inspect the resulting math.
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
              href="/dealey-plaza"
              style={{
                border: "1px solid var(--border)",
                padding: "8px 12px",
                color: "var(--text)",
                fontSize: "0.88rem",
              }}
            >
              Witness map
            </Link>
            <Link
              href="/topic/dealey-plaza"
              style={{
                border: "1px solid var(--border)",
                padding: "8px 12px",
                color: "var(--text)",
                fontSize: "0.88rem",
              }}
            >
              Source records
            </Link>
          </div>
        </div>
      </div>

      <div className="container">
        <TrajectorySandbox
          historicalWitnesses={historicalWitnessPayload.witnesses}
          historicalWitnessStatus={historicalWitnessPayload.status}
        />
      </div>
    </div>
  );
}
