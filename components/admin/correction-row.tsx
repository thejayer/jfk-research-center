"use client";

import { useState } from "react";
import type { CorrectionRow, CorrectionStatus } from "@/lib/warehouse";

const STATUSES: Array<{ value: CorrectionStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

export function CorrectionRowControls({ row }: { row: CorrectionRow }) {
  const [status, setStatus] = useState<CorrectionStatus>(row.status);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: CorrectionStatus) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(
        `/api/admin/corrections/${encodeURIComponent(row.submissionId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next, notes }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `${res.status}`);
      }
      setStatus(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {STATUSES.map((s) => {
          const active = s.value === status;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => save(s.value)}
              disabled={saving}
              aria-pressed={active}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                borderRadius: 999,
                border: "1px solid var(--border-strong)",
                background: active ? "var(--text)" : "transparent",
                color: active ? "var(--bg)" : "var(--text-muted)",
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Triage notes (saved with next status change)"
        rows={2}
        style={{
          width: "100%",
          fontSize: 12,
          padding: "6px 8px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--bg)",
          color: "var(--text)",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {saved && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Saved ✓
        </span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "#b91c1c" }}>
          Error: {error}
        </span>
      )}
    </div>
  );
}
