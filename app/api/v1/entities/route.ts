import { fetchAllEntities } from "@/lib/warehouse";
import { errorResponse, jsonResponse, preflight } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/v1/entities — list all curated entities with counts. */
export async function GET() {
  try {
    const entities = await fetchAllEntities();
    return jsonResponse({ entities }, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/entities] failed:", err);
    return errorResponse("entity list failed");
  }
}
