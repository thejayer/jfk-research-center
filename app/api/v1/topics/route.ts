import { fetchAllTopics } from "@/lib/warehouse";
import { errorResponse, jsonResponse, preflight } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/v1/topics — list the curated topic catalog. */
export async function GET() {
  try {
    const topics = await fetchAllTopics();
    return jsonResponse({ topics }, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/topics] failed:", err);
    return errorResponse("topic list failed");
  }
}
