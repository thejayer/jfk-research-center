import { NextResponse, type NextRequest } from "next/server";
import {
  applyRedactionAction,
  fetchRedactionDoc,
} from "@/lib/warehouse";
import { ADMIN_REVIEWER_ID } from "@/lib/admin-auth";
import type { RedactionAction, RedactionActionType } from "@/lib/api-types";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set<RedactionActionType>([
  "confirm",
  "reject",
  "needs_split",
  "confirm_all",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ document_id: string }> },
) {
  const { document_id } = await params;
  try {
    const doc = await fetchRedactionDoc(document_id);
    if (!doc) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  } catch (err) {
    console.error("[api/admin/redactions/:doc] fetch failed", err);
    return NextResponse.json(
      { error: "failed to load document" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ document_id: string }> },
) {
  const { document_id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const type = body.type as RedactionActionType | undefined;
  if (!type || !ALLOWED_ACTIONS.has(type)) {
    return NextResponse.json({ error: "invalid action type" }, { status: 400 });
  }

  const ids = Array.isArray(body.redactionIds)
    ? body.redactionIds.filter((x): x is string => typeof x === "string")
    : [];
  if (type !== "confirm_all" && ids.length === 0) {
    return NextResponse.json(
      { error: "redactionIds required" },
      { status: 400 },
    );
  }

  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 1000)
      : undefined;

  const action: RedactionAction = {
    type,
    redactionIds: ids,
    notes,
  };

  try {
    const result = await applyRedactionAction(
      document_id,
      action,
      ADMIN_REVIEWER_ID,
    );
    const doc = await fetchRedactionDoc(document_id);
    return NextResponse.json({ ...result, doc });
  } catch (err) {
    console.error("[api/admin/redactions/:doc] action failed", err);
    return NextResponse.json(
      { error: "action failed" },
      { status: 500 },
    );
  }
}
