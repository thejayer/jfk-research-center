import { type NextRequest } from "next/server";
import { fetchAllEntities } from "@/lib/warehouse";
import { errorResponse, jsonResponse, preflight } from "@/lib/api-v1";
import { denyUnauthorizedPublicApi } from "@/lib/public-api-enforcement";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/v1/entities — list all curated entities with counts. */
export async function GET(req: NextRequest) {
  const denied = await denyUnauthorizedPublicApi(req);
  if (denied) return denied;

  try {
    const entities = await fetchAllEntities();
    return jsonResponse({ entities }, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/entities] failed:", err);
    return errorResponse("entity list failed");
  }
}
