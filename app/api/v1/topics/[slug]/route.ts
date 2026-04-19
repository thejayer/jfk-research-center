import { type NextRequest } from "next/server";
import { fetchTopic } from "@/lib/warehouse";
import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
  preflight,
} from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/v1/topics/{slug} — full topic record. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const data = await fetchTopic(slug);
    if (!data) return notFoundResponse(`topic ${slug} not found`);
    return jsonResponse(data, { cacheSeconds: 600 });
  } catch (err) {
    console.error("[api/v1/topics/:slug] failed:", err);
    return errorResponse("topic lookup failed");
  }
}
