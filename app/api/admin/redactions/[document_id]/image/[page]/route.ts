import { NextResponse, type NextRequest } from "next/server";
import { Storage } from "@google-cloud/storage";

export const dynamic = "force-dynamic";

// Overlay PNGs live at gs://jfk-vault-ocr/review/<document_id>/page_NNN.png.
// We proxy them through Cloud Run rather than signing URLs because the
// runtime SA lacks the iam.serviceAccounts.signBlob permission to self-sign.
// Bandwidth is trivial at admin-tool scale.

const BUCKET = process.env.REDACTION_REVIEW_BUCKET || "jfk-vault-ocr";

let _storage: Storage | null = null;
function gcs(): Storage {
  if (!_storage) _storage = new Storage();
  return _storage;
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
    const [exists] = await gcs().bucket(BUCKET).file(objectPath).exists();
    if (!exists) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const [buf] = await gcs().bucket(BUCKET).file(objectPath).download();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": "image/png",
        // Overlays rarely change; cache 5 min in browser, 1 hour in CDN.
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[api/admin/redactions/:doc/image/:p] download failed", err);
    return NextResponse.json(
      { error: "image fetch failed" },
      { status: 500 },
    );
  }
}
