import { NextResponse, type NextRequest } from "next/server";
import { fetchEntityCooccurrence } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

function parseInt0(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  try {
    const data = await fetchEntityCooccurrence({
      yearFrom: parseInt0(url.searchParams.get("yearFrom")),
      yearTo: parseInt0(url.searchParams.get("yearTo")),
      minCount: parseInt0(url.searchParams.get("minCount")),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/graph] failed:", err);
    return NextResponse.json(
      { error: "graph payload failed" },
      { status: 500 },
    );
  }
}
