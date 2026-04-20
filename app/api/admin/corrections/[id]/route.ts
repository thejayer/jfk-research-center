import { NextResponse, type NextRequest } from "next/server";
import {
  updateCorrectionStatus,
  type CorrectionStatus,
} from "@/lib/warehouse";

export const dynamic = "force-dynamic";

const VALID: CorrectionStatus[] = ["new", "reviewing", "resolved", "rejected"];

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: "bad submission id" }, { status: 400 });
  }
  let body: { status?: string; notes?: string };
  try {
    body = (await req.json()) as { status?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const status = VALID.find((v) => v === body.status);
  if (!status) {
    return NextResponse.json(
      { error: "status must be one of: " + VALID.join(", ") },
      { status: 400 },
    );
  }
  const notes =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

  try {
    await updateCorrectionStatus(id, status, notes || null);
  } catch (err) {
    console.error("[api/admin/corrections/[id]] update failed", err);
    return NextResponse.json(
      { error: "update failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, status, notes: notes || null });
}
