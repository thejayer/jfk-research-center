import { NextResponse } from "next/server";
import { fetchAllTopics } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const topics = await fetchAllTopics();
    return NextResponse.json(
      { topics },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
        },
      },
    );
  } catch (err) {
    console.error("[api/topics] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
