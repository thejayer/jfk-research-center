"use client";

import { useState, type FormEvent } from "react";

type Surface = { value: string; label: string };

const MAX_TEXT = 2000;

export function CorrectionsForm({
  surfaces,
  initialSurface,
  initialTargetId,
}: {
  surfaces: Surface[];
  initialSurface: string;
  initialTargetId: string;
}) {
  const [surface, setSurface] = useState(initialSurface);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [issue, setIssue] = useState("");
  const [suggestedFix, setSuggestedFix] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<
    "idle" | "submitting" | "ok" | "error"
  >("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrMsg(null);
    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          targetId,
          issue,
          suggestedFix,
          submitterEmail: email,
          website,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrMsg(data.error ?? "Submission failed.");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setIssue("");
      setSuggestedFix("");
      setEmail("");
    } catch {
      setErrMsg("Network error — please try again.");
      setStatus("error");
    }
  };

  if (status === "ok") {
    return (
      <div
        role="status"
        style={{
          marginTop: 32,
          maxWidth: "62ch",
          padding: "20px 22px",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.2rem",
            letterSpacing: "-0.005em",
            marginBottom: 8,
          }}
        >
          Submitted — thank you.
        </div>
        <p className="muted" style={{ fontSize: "0.92rem", lineHeight: 1.55 }}>
          Your report is queued for review. If you provided an email and
          the editor has follow-up questions, you may be contacted.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          style={{
            marginTop: 14,
            padding: "6px 14px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: 32,
        maxWidth: "62ch",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <Field label="Surface">
        <select
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          style={fieldStyle}
        >
          {surfaces.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Target ID"
        hint="Entity slug, NAID, topic slug, established-fact id, or similar. Optional for general issues."
      >
        <input
          type="text"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="e.g. oswald, 124-10369-10004, mexico-city"
          maxLength={200}
          style={fieldStyle}
        />
      </Field>

      <Field label="Issue" hint={`Required, max ${MAX_TEXT} chars.`}>
        <textarea
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          required
          maxLength={MAX_TEXT}
          rows={5}
          placeholder="Describe what's incorrect and where it appears."
          style={{ ...fieldStyle, fontFamily: "inherit" }}
        />
        <CharCount value={issue} max={MAX_TEXT} />
      </Field>

      <Field
        label="Suggested fix"
        hint={`Optional rewrite or correction, max ${MAX_TEXT} chars.`}
      >
        <textarea
          value={suggestedFix}
          onChange={(e) => setSuggestedFix(e.target.value)}
          maxLength={MAX_TEXT}
          rows={4}
          placeholder="(Optional) what should it say instead?"
          style={{ ...fieldStyle, fontFamily: "inherit" }}
        />
        <CharCount value={suggestedFix} max={MAX_TEXT} />
      </Field>

      <Field label="Email" hint="Optional. Only used if the editor needs to follow up.">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          placeholder="you@example.com"
          style={fieldStyle}
        />
      </Field>

      {/* Honeypot — hidden from users; bots fill everything. */}
      <div aria-hidden style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {errMsg && (
        <div
          role="alert"
          style={{
            color: "#b91c1c",
            fontSize: "0.9rem",
            border: "1px solid color-mix(in srgb, #b91c1c 30%, transparent)",
            background: "color-mix(in srgb, #b91c1c 10%, transparent)",
            padding: "10px 14px",
            borderRadius: 6,
          }}
        >
          {errMsg}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="submit"
          disabled={status === "submitting" || issue.trim() === ""}
          style={{
            padding: "8px 18px",
            background: "var(--text)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 999,
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor:
              status === "submitting" || issue.trim() === ""
                ? "not-allowed"
                : "pointer",
            opacity: status === "submitting" || issue.trim() === "" ? 0.6 : 1,
          }}
        >
          {status === "submitting" ? "Submitting…" : "Submit"}
        </button>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          Submissions queue for editorial review.
        </span>
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{label}</span>
      {hint && (
        <span
          className="muted"
          style={{ fontSize: "0.78rem", lineHeight: 1.4 }}
        >
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className="muted num"
      style={{ alignSelf: "flex-end", fontSize: "0.74rem", marginTop: -2 }}
    >
      {value.length}/{max}
    </span>
  );
}
