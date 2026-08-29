import { NextResponse, type NextRequest } from "next/server";
import { fetchDocumentOcrPage } from "@/lib/warehouse";
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
  const rawChunk = new URL(req.url).searchParams.get("chunk");
  const chunkOrder =
    rawChunk != null && /^-?\d+$/.test(rawChunk) ? Number(rawChunk) : null;

  try {
    const res = await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(req.headers, "api_document_ocr"),
      () => fetchDocumentOcrPage(id, chunkOrder),
    );
    if (!res) {
      return NextResponse.json({ error: "OCR page not found" }, { status: 404 });
    }
    return NextResponse.json(res, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[api/document/ocr]", err);
    return NextResponse.json(
      { error: "warehouse query failed" },
      { status: 500 },
    );
  }
}
