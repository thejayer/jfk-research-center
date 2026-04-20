"use client";

import { useState, useMemo } from "react";
import type {
  RedactionDocDetail,
  RedactionDetection,
  RedactionActionType,
} from "@/lib/api-types";

export default function RedactionReviewer({
  initialDoc,
}: {
  initialDoc: RedactionDocDetail;
}) {
  const [doc, setDoc] = useState<RedactionDocDetail>(initialDoc);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  // Group detections by page; empty pages are included so they render in order.
  const pages = useMemo(() => {
    const byPage = new Map<number, RedactionDetection[]>();
    for (const d of doc.detections) {
      const arr = byPage.get(d.pageNum) ?? [];
      arr.push(d);
      byPage.set(d.pageNum, arr);
    }
    return Array.from(byPage.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([pageNum, detections]) => ({ pageNum, detections }));
  }, [doc]);

  async function submit(
    type: RedactionActionType,
    redactionIds: string[] | undefined,
  ) {
    setErr(null);
    const key =
      type === "confirm_all"
        ? "confirm_all"
        : `${type}:${(redactionIds ?? []).join(",")}`;
    setPending((p) => new Set(p).add(key));
    try {
      const res = await fetch(
        `/api/admin/redactions/${doc.documentId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, redactionIds }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body?.error || "action failed");
        return;
      }
      const data = await res.json();
      if (data.doc) setDoc(data.doc);
    } catch {
      setErr("action failed");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          disabled={doc.unreviewedCount === 0 || pending.has("confirm_all")}
          onClick={() => submit("confirm_all", undefined)}
          style={primaryButton(doc.unreviewedCount === 0)}
        >
          {pending.has("confirm_all")
            ? "Confirming…"
            : `Confirm all ${doc.unreviewedCount} unreviewed`}
        </button>
        {err && (
          <span role="alert" style={{ color: "var(--danger, #c33)", fontSize: 13 }}>
            {err}
          </span>
        )}
      </div>

      {pages.map(({ pageNum, detections }) => (
        <PageBlock
          key={pageNum}
          documentId={doc.documentId}
          pageNum={pageNum}
          detections={detections}
          onAction={submit}
          pending={pending}
        />
      ))}
    </section>
  );
}

function PageBlock({
  documentId,
  pageNum,
  detections,
  onAction,
  pending,
}: {
  documentId: string;
  pageNum: number;
  detections: RedactionDetection[];
  onAction: (
    type: RedactionActionType,
    redactionIds: string[] | undefined,
  ) => void;
  pending: Set<string>;
}) {
  const src = `/api/admin/redactions/${documentId}/image/${pageNum}`;
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        gap: 20,
        marginBottom: 32,
        paddingBottom: 32,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 0.5,
            color: "var(--muted)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Page {pageNum} · {detections.length} detection
          {detections.length === 1 ? "" : "s"}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Page ${pageNum} overlay`}
          style={{
            width: "100%",
            maxWidth: "100%",
            border: "1px solid var(--border)",
            background: "#fff",
          }}
          loading="lazy"
        />
      </div>
      <div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {detections.map((d, idx) => (
            <li
              key={d.redactionId}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                marginBottom: 8,
                opacity: d.reviewStatus === "rejected" ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                #{idx + 1} ·{" "}
                {d.areaPct != null ? `${d.areaPct.toFixed(2)}%` : "—"} ·{" "}
                {d.confidence != null
                  ? `ext ${d.confidence.toFixed(2)}`
                  : "ext —"}
              </div>
              <div style={{ marginBottom: 6 }}>
                <StatusPill status={d.reviewStatus} />
              </div>
              {d.reviewStatus === "unreviewed" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    disabled={pending.has(`confirm:${d.redactionId}`)}
                    onClick={() => onAction("confirm", [d.redactionId])}
                    style={smallButton("confirm")}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={pending.has(`reject:${d.redactionId}`)}
                    onClick={() => onAction("reject", [d.redactionId])}
                    style={smallButton("reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={pending.has(`needs_split:${d.redactionId}`)}
                    onClick={() =>
                      onAction("needs_split", [d.redactionId])
                    }
                    style={smallButton("split")}
                  >
                    Split
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const { bg, fg, label } = STATUS_STYLE[status] ?? STATUS_STYLE.unreviewed;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        background: bg,
        color: fg,
        borderRadius: 3,
      }}
    >
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<
  string,
  { bg: string; fg: string; label: string }
> = {
  unreviewed: { bg: "#eee", fg: "#444", label: "unreviewed" },
  confirmed: { bg: "#1e8a3a", fg: "#fff", label: "confirmed" },
  rejected: { bg: "#9b2f2f", fg: "#fff", label: "rejected" },
  needs_split: { bg: "#b25c00", fg: "#fff", label: "needs split" },
  auto_confirmed: { bg: "#2b5797", fg: "#fff", label: "auto" },
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    fontSize: 13,
    borderRadius: 4,
    border: "1px solid var(--border-strong)",
    background: disabled ? "var(--border)" : "var(--fg)",
    color: disabled ? "var(--muted)" : "var(--bg)",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function smallButton(kind: "confirm" | "reject" | "split"): React.CSSProperties {
  const palette = {
    confirm: { bg: "#1e8a3a", fg: "#fff" },
    reject: { bg: "#9b2f2f", fg: "#fff" },
    split: { bg: "#555", fg: "#fff" },
  }[kind];
  return {
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 3,
    border: "none",
    background: palette.bg,
    color: palette.fg,
    cursor: "pointer",
  };
}
