import { NextResponse, type NextRequest } from "next/server";
import { fetchEntity } from "@/lib/warehouse";
import {
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "@/lib/warehouse-request-context";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const res = await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(req.headers, "api_entity"),
      () => fetchEntity(slug),
    );
    if (!res) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }
    return NextResponse.json(res, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/entity]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
