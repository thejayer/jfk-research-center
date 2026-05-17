import { type NextRequest } from "next/server";
import { fetchSearch } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  parseIntOrNull,
  preflight,
} from "@/lib/api-v1";
import { findPublicApiEndpointPolicy } from "@/lib/public-api-access";
import { enforcePublicApiAccess } from "@/lib/public-api-enforcement";

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
  const policy = findPublicApiEndpointPolicy("GET", url.pathname);
  if (policy) {
    const access = await enforcePublicApiAccess(req, policy);
    if (!access.ok) return access.response;
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return errorResponse("query param `q` is required", 400);

  const limit = Math.max(
    1,
    Math.min(50, parseIntOrNull(url.searchParams.get("limit")) ?? 20),
  );

  try {
    const data = await fetchSearch({
      query: q,
      mode: "semantic",
      limit,
    });
    // Semantic results hit Vertex per-call; keep s-maxage short so repeated
    // identical queries are cacheable but novel queries stay cheap.
    return jsonResponse(data, { cacheSeconds: 60 });
  } catch (err) {
    console.error("[api/v1/search/semantic] failed:", err);
    return errorResponse("semantic search failed");
  }
}
