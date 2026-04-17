import { NextResponse } from "next/server";
import { fetchTopic } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const res = await fetchTopic(slug);
    if (!res) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    return NextResponse.json(res, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/topic]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
