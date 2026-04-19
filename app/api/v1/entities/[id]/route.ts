import { type NextRequest } from "next/server";
import { fetchEntity } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
  preflight,
} from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/entities/{id}
 * `id` is the entity slug (e.g. "oswald", "warren-commission").
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
