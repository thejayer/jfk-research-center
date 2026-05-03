import { NextResponse, type NextRequest } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const dynamic = "force-dynamic";

// Overlay PNGs live at gs://jfk-vault-ocr/review/<document_id>/page_NNN.png.
// We proxy them through Cloud Run rather than signing URLs because the
// runtime SA lacks the iam.serviceAccounts.signBlob permission to self-sign.
// Bandwidth is trivial at admin-tool scale.

const BUCKET = process.env.REDACTION_REVIEW_BUCKET || "jfk-vault-ocr";
const GCS_FETCH_TIMEOUT_MS = 10_000;

let authClient: GoogleAuth | null = null;
function gcsAuth(): GoogleAuth {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/devstorage.read_only"],
    });
  }
  return authClient;
}

async function accessToken(): Promise<string> {
  const client = await gcsAuth().getClient();
  const token = await client.getAccessToken();
  const value = typeof token === "string" ? token : token?.token;
  if (!value) throw new Error("missing GCS access token");
  return value;
}

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ document_id: string; page: string }> },
) {
  const { document_id, page } = await params;

  // Coerce page to zero-padded int; refuse anything non-numeric or negative.
  const pageNum = Number(page);
  if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > 1000) {
    return NextResponse.json({ error: "invalid page" }, { status: 400 });
  }
  // document_id must be a well-formed NARA-style id — no slashes or "..".
  if (!/^[A-Za-z0-9_\-]{2,64}$/.test(document_id)) {
    return NextResponse.json({ error: "invalid doc id" }, { status: 400 });
  }

  const padded = String(pageNum).padStart(3, "0");
  const objectPath = `review/${document_id}/page_${padded}_overlay.png`;

  try {
    const token = await accessToken();
    const url = new URL(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
        BUCKET,
      )}/o/${encodeURIComponent(objectPath)}`,
    );
    url.searchParams.set("alt", "media");

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(GCS_FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (!res.ok) {
      throw new Error(`GCS media fetch failed: ${res.status}`);
    }

    const body = new Uint8Array(await res.arrayBuffer());
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "image/png",
        // Overlays rarely change; cache 5 min in browser, 1 hour in CDN.
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[api/admin/redactions/:doc/image/:p] download failed", err);
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "image fetch timed out" },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "image fetch failed" },
      { status: 500 },
    );
  }
}
