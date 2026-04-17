"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBar({
  autoFocus,
  size = "md",
  placeholder = "Search the JFK archive",
}: {
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params?.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global "/" shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    const mode = params?.get("mode");
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (mode === "mention") next.set("mode", "mention");
    router.push(`/search?${next.toString()}`);
  }

  const height = size === "lg" ? 60 : 46;
  const fontSize = size === "lg" ? "1.1rem" : "0.98rem";

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search archive"
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        transition:
          "border-color var(--motion), box-shadow var(--motion), background var(--motion)",
        height,
        paddingLeft: 16,
        paddingRight: 6,
        boxShadow: size === "lg" ? "var(--shadow-md)" : "var(--shadow-sm)",
        width: "100%",
      }}
      onFocusCapture={(e) => {
        (e.currentTarget as HTMLFormElement).style.borderColor = "var(--accent)";
      }}
      onBlurCapture={(e) => {
        (e.currentTarget as HTMLFormElement).style.borderColor =
          "var(--border-strong)";
      }}
    >
      <SearchIcon />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search query"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text)",
          marginLeft: 10,
          fontSize,
          fontFamily: "inherit",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          style={{
            color: "var(--text-muted)",
            marginRight: 6,
            padding: "6px 8px",
            fontSize: "0.82rem",
          }}
        >
          clear
        </button>
      )}
      <button
        type="submit"
        style={{
          height: height - 12,
          padding: "0 16px",
          background: "var(--text)",
          color: "var(--bg)",
          borderRadius: "var(--radius-sm)",
          fontWeight: 500,
          fontSize: "0.9rem",
        }}
      >
        Search
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M13.5 13.5 L10.5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
