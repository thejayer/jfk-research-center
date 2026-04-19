import { NextResponse } from "next/server";
import { fetchEstablishedFactsIndex } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchEstablishedFactsIndex();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/established-facts] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
