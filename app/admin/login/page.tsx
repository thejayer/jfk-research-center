"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/redactions";
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.replace(next);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setErr(body?.error || "login failed");
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "120px auto",
        padding: "0 20px",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
        Admin
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Restricted area. Enter the access token to continue.
      </p>
      <form onSubmit={onSubmit}>
        <input
          type="password"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="access token"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 14,
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        />
        {err && (
          <p
            role="alert"
            style={{
              color: "var(--danger, #c33)",
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !token}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            background: "var(--fg)",
            color: "var(--bg)",
            fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
            opacity: !token ? 0.6 : 1,
          }}
        >
          {submitting ? "…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
