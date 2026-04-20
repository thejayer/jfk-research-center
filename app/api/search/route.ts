import { NextResponse, type NextRequest } from "next/server";
import { fetchSearch } from "@/lib/warehouse";
import type { ConfidenceLevel } from "@/lib/api-types";

export const dynamic = "force-dynamic";

function multi(u: URL, key: string): string[] {
  return u.searchParams.getAll(key).filter(Boolean);
}

function parseIntOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const modeRaw = url.searchParams.get("mode");
  const mode =
    modeRaw === "mention"
      ? "mention"
      : modeRaw === "semantic"
        ? "semantic"
        : "document";

  const filters = {
    agencies: multi(url, "agency"),
    yearFrom: parseIntOrNull(url.searchParams.get("yearFrom")),
    yearTo: parseIntOrNull(url.searchParams.get("yearTo")),
    entities: multi(url, "entity"),
    topics: multi(url, "topic"),
    confidence: multi(url, "confidence") as ConfidenceLevel[],
  };

  const offsetRaw = parseIntOrNull(url.searchParams.get("offset"));
  const offset = offsetRaw && offsetRaw > 0 ? offsetRaw : 0;
  const limitRaw = parseIntOrNull(url.searchParams.get("limit"));
  const limit = limitRaw && limitRaw > 0 && limitRaw <= 200 ? limitRaw : undefined;

  try {
    const data = await fetchSearch({ query: q, mode, filters, limit, offset });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/search] failed:", err);
    return NextResponse.json(
      { error: "warehouse search failed" },
      { status: 500 },
    );
  }
}
