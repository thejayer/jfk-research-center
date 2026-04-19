"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  addSavedSearch,
  listSavedSearches,
  removeSavedSearch,
  type SavedSearch,
} from "@/lib/saved-searches";

export function SavedSearches() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [composing, setComposing] = useState(false);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    setMounted(true);
    setItems(listSavedSearches());
    const sync = () => setItems(listSavedSearches());
    window.addEventListener("jfkrc:saved-searches-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("jfkrc:saved-searches-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const currentUrl = useMemo(() => {
    const qs = params?.toString() ?? "";
    return qs ? `${pathname}?${qs}` : pathname ?? "/search";
  }, [pathname, params]);

  const hasSomethingToSave = useMemo(() => {
    if (!params) return false;
    const q = params.get("q") ?? "";
    if (q.trim()) return true;
    for (const key of ["agency", "year", "entity", "topic", "confidence"]) {
      if (params.getAll(key).length > 0) return true;
    }
    return false;
  }, [params]);

  const defaultName = useMemo(() => {
    if (!params) return "";
    const q = params.get("q")?.trim();
    if (q) return q;
    const parts: string[] = [];
    for (const key of ["entity", "topic", "agency", "year"] as const) {
      const vs = params.getAll(key);
      if (vs.length) parts.push(vs.join(", "));
    }
    return parts.join(" · ") || "Filtered search";
  }, [params]);

  if (!mounted) return null;

  function onSave() {
    addSavedSearch({ name: draftName || defaultName, url: currentUrl });
    setComposing(false);
    setDraftName("");
  }

  return (
    <section
      aria-label="Saved searches"
      style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          className="eyebrow"
          style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
        >
          Saved searches
          {items.length > 0 ? ` · ${items.length}` : ""}
        </span>
        {hasSomethingToSave && !composing && (
          <button
            type="button"
            onClick={() => {
              setDraftName(defaultName);
              setComposing(true);
            }}
            style={{
              fontSize: "0.78rem",
              color: "var(--accent)",
              padding: "2px 0",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        )}
      </div>

      {composing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Name this search"
            aria-label="Saved search name"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "4px 8px",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "0.82rem",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "4px 10px",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              background: "var(--text)",
              color: "var(--bg)",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setComposing(false);
              setDraftName("");
            }}
            aria-label="Cancel"
            style={{
              padding: "4px 8px",
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p
          className="muted"
          style={{ fontSize: "0.8rem", margin: 0, color: "var(--text-muted)" }}
        >
          {hasSomethingToSave
            ? "Save this search to return to it later."
            : "Searches you save will appear here."}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {items.map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.85rem",
              }}
            >
              <Link
                href={s.url}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: s.url === currentUrl ? "var(--accent)" : "var(--text)",
                }}
                title={s.name}
              >
                {s.name}
              </Link>
              <button
                type="button"
                onClick={() => removeSavedSearch(s.id)}
                aria-label={`Delete saved search: ${s.name}`}
                style={{
                  color: "var(--text-muted)",
                  padding: "2px 4px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
