import { NextResponse, type NextRequest } from "next/server";
import { fetchCompare } from "@/lib/warehouse";
import { PUBLIC_ROUTE_CACHE_CONTROL, RECORD_ID_RE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const recordId = url.searchParams.get("record")?.trim();

  if (!recordId) {
    return NextResponse.json(
      { error: "record query parameter is required" },
      { status: 400 },
    );
  }
  if (!RECORD_ID_RE.test(recordId)) {
    return NextResponse.json(
      { error: "record query parameter is malformed" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchCompare(recordId);
    if (!data) {
      return NextResponse.json(
        { error: "Compare fixture not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(data, {
      headers: {
        "cache-control": PUBLIC_ROUTE_CACHE_CONTROL,
      },
    });
  } catch (err) {
    console.error("[api/compare] failed:", err);
    return NextResponse.json(
      { error: "warehouse compare failed" },
      { status: 500 },
    );
  }
}
