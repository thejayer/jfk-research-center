import { NextResponse } from "next/server";
import { fetchDealeyPlazaWitnesses } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchDealeyPlazaWitnesses();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[api/dealey-plaza]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
