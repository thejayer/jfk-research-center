import { type NextRequest } from "next/server";
import { fetchSearch } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  parseIntOrNull,
  preflight,
} from "@/lib/api-v1";
import { denyUnauthorizedPublicApi } from "@/lib/public-api-enforcement";
import { isSemanticSearchDisabled } from "@/lib/cost-controls";
import {
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "@/lib/warehouse-request-context";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/search/semantic
 *   ?q=     natural-language query (required)
 *   &limit= 1..50 (default 20)
 *
 * Embeds the query with Vertex text-embedding-005 and runs cosine
 * VECTOR_SEARCH over the 112k-row chunk_embeddings table built by
 * sql/31. Response shape matches the internal /api/search payload.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (isSemanticSearchDisabled()) {
    return errorResponse("semantic search temporarily disabled", 503);
  }

  const denied = await denyUnauthorizedPublicApi(req);
  if (denied) return denied;

  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return errorResponse("query param `q` is required", 400);

  const limit = Math.max(
    1,
    Math.min(50, parseIntOrNull(url.searchParams.get("limit")) ?? 20),
  );
  const requestContext = warehouseRequestContextFromHeaders(
    req.headers,
    "api_v1_semantic",
    "semantic",
  );

  try {
    const data = await withWarehouseRequestContext(requestContext, () =>
      fetchSearch({
        query: q,
        mode: "semantic",
        limit,
      })
    );
    // Semantic results hit Vertex per-call; keep s-maxage short so repeated
    // identical queries are cacheable but novel queries stay cheap.
    return jsonResponse(data, { cacheSeconds: 60 });
  } catch (err) {
    console.error("[api/v1/search/semantic] failed:", err);
    return errorResponse("semantic search failed");
  }
}
