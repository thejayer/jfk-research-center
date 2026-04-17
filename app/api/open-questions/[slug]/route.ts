import { NextResponse } from "next/server";
import { fetchOpenQuestionsTopic } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const data = await fetchOpenQuestionsTopic(slug);
    if (!data) {
      return NextResponse.json(
        { error: "Open questions not found for topic" },
        { status: 404 },
      );
    }
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/open-questions/slug]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
