import { NextResponse, type NextRequest } from "next/server";
import { fetchCorrections, type CorrectionStatus } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

const VALID: CorrectionStatus[] = ["new", "reviewing", "resolved", "rejected"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const statusRaw = url.searchParams.get("status");
  const status = VALID.find((v) => v === statusRaw);
  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get("limit") || "200")),
  );
  try {
    const data = await fetchCorrections({ status, limit });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/corrections] fetch failed", err);
    return NextResponse.json(
      { error: "failed to load corrections" },
      { status: 500 },
    );
  }
}
