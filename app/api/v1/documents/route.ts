import { type NextRequest } from "next/server";
import { fetchSearch } from "@/lib/warehouse";
import type { ConfidenceLevel } from "@/lib/api-types";
import {
  errorResponse,
  jsonResponse,
  parseIntOrNull,
  preflight,
} from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/documents
 *   ?q=          full-text query over title/description/OCR
 *   &topic=      (repeatable) topic slug filter
 *   &entity=     (repeatable) entity id filter
 *   &agency=     (repeatable) agency name filter
 *   &yearFrom=&yearTo= inclusive event-date range (YYYY)
 *   &limit=      1..200 (default 50)
 *
 * Response shape matches the internal /api/search payload so OpenAPI
 * consumers get the same facet data the web UI uses.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(200, parseIntOrNull(url.searchParams.get("limit")) ?? 50),
  );

  const filters = {
    agencies: url.searchParams.getAll("agency").filter(Boolean),
    yearFrom: parseIntOrNull(url.searchParams.get("yearFrom")),
    yearTo: parseIntOrNull(url.searchParams.get("yearTo")),
    entities: url.searchParams.getAll("entity").filter(Boolean),
    topics: url.searchParams.getAll("topic").filter(Boolean),
    confidence: url.searchParams
      .getAll("confidence")
      .filter(Boolean) as ConfidenceLevel[],
  };

  try {
    const data = await fetchSearch({
      query: url.searchParams.get("q") ?? "",
      mode: "document",
      filters,
      limit,
    });
    return jsonResponse(data, { cacheSeconds: 300 });
  } catch (err) {
    console.error("[api/v1/documents] failed:", err);
    return errorResponse("document search failed");
  }
}
