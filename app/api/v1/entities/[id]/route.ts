import { type NextRequest } from "next/server";
import { fetchEntity } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
  preflight,
} from "@/lib/api-v1";
import { denyUnauthorizedPublicApi } from "@/lib/public-api-enforcement";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/entities/{id}
 * `id` is the entity slug (e.g. "oswald", "warren-commission").
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await denyUnauthorizedPublicApi(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const data = await fetchEntity(id);
    if (!data) return notFoundResponse(`entity ${id} not found`);
    return jsonResponse(data, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/entities/:id] failed:", err);
    return errorResponse("entity lookup failed");
  }
}
