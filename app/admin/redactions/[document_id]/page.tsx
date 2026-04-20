import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchRedactionDoc } from "@/lib/warehouse";
import RedactionReviewer from "@/components/admin/redaction-reviewer";

export const dynamic = "force-dynamic";

export default async function AdminRedactionDetailPage({
  params,
}: {
  params: Promise<{ document_id: string }>;
}) {
  const { document_id } = await params;
  const doc = await fetchRedactionDoc(document_id);
  if (!doc) notFound();

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 20px" }}>
      <nav style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        <Link href="/admin/redactions" style={{ color: "var(--muted)" }}>
          ← back to queue
        </Link>
      </nav>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            fontWeight: 600,
            margin: "0 0 6px",
          }}
        >
          {doc.documentId}
        </h1>
        {doc.title && (
          <p style={{ fontSize: 14, marginBottom: 8 }}>{doc.title}</p>
        )}
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {[doc.agency, doc.releaseSet, doc.numPages ? `${doc.numPages} pages` : null]
            .filter(Boolean)
            .join(" · ")}{" "}
          · <strong>{doc.unreviewedCount}</strong>/{doc.totalDetections} unreviewed
        </p>
      </header>

      <RedactionReviewer initialDoc={doc} />
    </main>
  );
}
