import Link from "next/link";
import type { OpenQuestionThread } from "@/lib/api-types";
import { TENSION_ORDER, tensionLabel } from "./tension-labels";

export function OpenQuestionsThreadList({
  threads,
}: {
  threads: OpenQuestionThread[];
}) {
  if (threads.length === 0) return null;

  const buckets = new Map<string, OpenQuestionThread[]>();
  for (const t of threads) {
    const key = t.tensionType ?? "other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }

  const orderedKeys = [
    ...TENSION_ORDER.filter((k) => buckets.has(k)),
    ...Array.from(buckets.keys()).filter(
      (k) => !TENSION_ORDER.includes(k as (typeof TENSION_ORDER)[number]),
    ),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {orderedKeys.map((key) => {
        const items = buckets.get(key)!;
        return (
          <section key={key} aria-label={tensionLabel(key)}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.2rem",
                  letterSpacing: "-0.005em",
                  fontWeight: 500,
                }}
              >
                {tensionLabel(key)}
              </h3>
              <span
                className="muted num"
                style={{ fontSize: "0.82rem" }}
              >
                {items.length}
              </span>
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {items.map((t) => (
                <ThreadItem key={t.id} thread={t} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ThreadItem({ thread }: { thread: OpenQuestionThread }) {
  return (
    <li
      style={{
        padding: "18px 20px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.02rem",
          lineHeight: 1.4,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {thread.question}
      </div>
      {thread.summary && (
        <p
          style={{
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            marginBottom: 10,
          }}
        >
          {thread.summary}
        </p>
      )}
      {thread.supportingDocIds.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 4,
          }}
        >
          {thread.supportingDocIds.map((id) => (
            <Link
              key={id}
              href={`/document/${encodeURIComponent(id)}`}
              style={{
                padding: "2px 8px",
                fontSize: "0.72rem",
                letterSpacing: "0.02em",
                color: "var(--text-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 999,
                textDecoration: "none",
                background: "var(--bg)",
              }}
              title={`Open document ${id}`}
            >
              {id}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
