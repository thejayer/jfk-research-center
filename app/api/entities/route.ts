import { NextResponse } from "next/server";
import { fetchAllEntities } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entities = await fetchAllEntities();
    return NextResponse.json(
      { entities },
      {
        headers: {
          "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    console.error("[api/entities] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
