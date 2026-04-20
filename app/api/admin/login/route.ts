import { NextResponse, type NextRequest } from "next/server";
import {
  issueSessionCookie,
  clearedSessionCookie,
  tokenMatches,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!tokenMatches(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  const cookie = await issueSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}

export async function DELETE() {
  const cookie = clearedSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
