import { NextResponse } from "next/server";
import { fetchMediaIndex } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchMediaIndex();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/media] failed:", err);
    return NextResponse.json(
      { error: "media payload failed" },
      { status: 500 },
    );
  }
}
