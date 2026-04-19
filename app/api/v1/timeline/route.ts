import { type NextRequest } from "next/server";
import { fetchCaseTimeline } from "@/lib/warehouse";
import { errorResponse, jsonResponse, preflight } from "@/lib/api-v1";
import type { CaseTimelineCategory } from "@/lib/api-types";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/timeline
 *   ?from=YYYY-MM-DD  inclusive
 *   &to=YYYY-MM-DD    inclusive
 *   &category=        (repeatable) biographical|operational|investigation|release|death
 *
 * Pre-aggregated category/decade counts are always returned alongside the
 * filtered events for convenience.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const categories = new Set(url.searchParams.getAll("category"));

  try {
    const data = await fetchCaseTimeline();
    const events = data.events.filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (categories.size > 0 && !categories.has(e.category)) return false;
      return true;
    });
    const appliedCategories = Array.from(categories) as CaseTimelineCategory[];
    return jsonResponse(
      {
        events,
        countsByCategory: data.countsByCategory,
        countsByDecade: data.countsByDecade,
        applied: { from, to, categories: appliedCategories },
      },
      { cacheSeconds: 600 },
    );
  } catch (err) {
    console.error("[api/v1/timeline] failed:", err);
    return errorResponse("timeline lookup failed");
  }
}
