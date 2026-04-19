import { type NextRequest } from "next/server";
import { fetchDocument } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
  preflight,
} from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/documents/{naid}
 * Returns the full document record plus related entities and related docs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ naid: string }> },
) {
  const { naid } = await params;
  try {
    const data = await fetchDocument(naid);
    if (!data) return notFoundResponse(`document ${naid} not found`);
    return jsonResponse(data, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/documents/:naid] failed:", err);
    return errorResponse("document lookup failed");
  }
}
