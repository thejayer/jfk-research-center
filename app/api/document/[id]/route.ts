import { NextResponse, type NextRequest } from "next/server";
import { parseChunkParam } from "@/lib/document-reader";
import { fetchDocument } from "@/lib/warehouse";
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
  const chunkOrder = parseChunkParam(new URL(req.url).searchParams.get("chunk"));
  try {
    const res = await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(req.headers, "api_document"),
      () => fetchDocument(id, { chunkOrder }),
    );
    if (!res) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    // The in-process cache can serve a payload up to 24h old, so keep the
    // shared-cache window short: worst-case staleness is ~24h + 1h + 1h.
    return NextResponse.json(res, {
      headers: {
        "cache-control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/document]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
