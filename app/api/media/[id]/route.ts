import { NextResponse } from "next/server";
import { getMediaAsset } from "@/lib/media-assets";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const asset = getMediaAsset(id);
  if (!asset) {
    return NextResponse.json({ error: "Media asset not found" }, { status: 404 });
  }
  return NextResponse.json(asset, {
    headers: {
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
