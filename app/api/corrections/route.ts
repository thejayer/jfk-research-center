import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { insertCorrection } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

const ALLOWED_SURFACES = new Set([
  "entity_bio",
  "entity_timeline",
  "entity_facts",
  "topic_summary",
  "topic_article",
  "open_questions_thread",
  "established_fact",
  "evidence_item",
  "timeline_event",
  "document_metadata",
  "ai_summary",
  "other",
]);

const MAX_TEXT = 2000;
const MAX_EMAIL = 200;

function trimTo(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function isValidEmail(s: string): boolean {
  if (s === "") return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Honeypot — legitimate users never see this field, so any value =
  // bot. Return 200 to keep crawlers from learning the discriminator.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const surface = trimTo(body.surface, 64) || "other";
  if (!ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json(
      { error: "unknown surface" },
      { status: 400 },
    );
  }

  const targetId = trimTo(body.targetId, 200);
  const issue = trimTo(body.issue, MAX_TEXT);
  const suggestedFix = trimTo(body.suggestedFix, MAX_TEXT);
  const submitterEmail = trimTo(body.submitterEmail, MAX_EMAIL);

  if (!issue) {
    return NextResponse.json(
      { error: "issue is required" },
      { status: 400 },
    );
  }
  if (!isValidEmail(submitterEmail)) {
    return NextResponse.json(
      { error: "invalid email" },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent") ?? "";

  try {
    await insertCorrection({
      submissionId: randomUUID(),
      surface,
      targetId,
      issue,
      suggestedFix,
      submitterEmail,
      userAgent,
    });
  } catch (err) {
    console.error("[api/corrections] insert failed", err);
    return NextResponse.json(
      { error: "submission failed; please try again later" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
