import { NextResponse } from "next/server";
import { fetchOcrProgress } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchOcrProgress();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/ocr-progress] failed", err);
    return NextResponse.json(
      { error: "failed to load OCR progress" },
      { status: 500 },
    );
  }
}
