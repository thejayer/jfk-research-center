import { NextResponse, type NextRequest } from "next/server";
import { fetchHome } from "@/lib/warehouse";
import {
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "@/lib/warehouse-request-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(req.headers, "api_home"),
      () => fetchHome(),
    );
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/home] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
