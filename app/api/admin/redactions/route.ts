import { NextResponse, type NextRequest } from "next/server";
import { fetchRedactionQueue } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.max(
    1,
    Math.min(500, Number(req.nextUrl.searchParams.get("limit") || "100")),
  );
  try {
    const data = await fetchRedactionQueue(limit);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/redactions] queue fetch failed", err);
    return NextResponse.json(
      { error: "failed to load queue" },
      { status: 500 },
    );
  }
}
