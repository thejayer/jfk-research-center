import { NextResponse } from "next/server";
import { fetchOpenQuestionsIndex } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchOpenQuestionsIndex();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/open-questions]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
