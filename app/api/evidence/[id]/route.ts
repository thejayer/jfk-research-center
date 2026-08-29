import { NextResponse, type NextRequest } from "next/server";
import { fetchPhysicalEvidenceItem } from "@/lib/warehouse";
import {
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "@/lib/warehouse-request-context";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(req.headers, "api_evidence"),
      () => fetchPhysicalEvidenceItem(id),
    );
    if (!data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/evidence/:id] failed:", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
