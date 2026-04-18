import { NextResponse } from "next/server";
import { fetchCorpusManifest } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchCorpusManifest();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/corpus-manifest] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
