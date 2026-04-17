import { NextResponse, type NextRequest } from "next/server";
import { fetchSearch } from "@/lib/warehouse";
import type { ConfidenceLevel } from "@/lib/api-types";

export const dynamic = "force-dynamic";

function multi(u: URL, key: string): string[] {
  return u.searchParams.getAll(key).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const modeRaw = url.searchParams.get("mode");
  const mode = modeRaw === "mention" ? "mention" : "document";

  const filters = {
    agencies: multi(url, "agency"),
    years: multi(url, "year"),
    entities: multi(url, "entity"),
    topics: multi(url, "topic"),
    confidence: multi(url, "confidence") as ConfidenceLevel[],
  };

  try {
    const data = await fetchSearch({ query: q, mode, filters });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/search] failed:", err);
    return NextResponse.json(
      { error: "warehouse search failed" },
      { status: 500 },
    );
  }
}
