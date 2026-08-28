import { type NextRequest } from "next/server";
import { fetchAllTopics } from "@/lib/warehouse";
import { errorResponse, jsonResponse, preflight } from "@/lib/api-v1";
import { denyUnauthorizedPublicApi } from "@/lib/public-api-enforcement";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/v1/topics — list the curated topic catalog. */
export async function GET(req: NextRequest) {
  const denied = await denyUnauthorizedPublicApi(req);
  if (denied) return denied;

  try {
    const topics = await fetchAllTopics();
    return jsonResponse({ topics }, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/topics] failed:", err);
    return errorResponse("topic list failed");
  }
}
