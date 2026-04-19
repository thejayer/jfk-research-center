import type { Metadata } from "next";
import Link from "next/link";
import { fetchBibliographyIndex } from "@/lib/api-client";
import type { CitationType } from "@/lib/api-types";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bibliography",
  description:
    "Allowlisted citation registry — primary-source and reference works the site draws from, with Bluebook, Chicago, and APA formats for each.",
};

const TYPE_LABEL: Record<CitationType, string> = {
  WC: "Warren Commission",
  HSCA: "HSCA",
  ARRB: "ARRB",
  CHURCH: "Church Committee",
  REPORT: "Government reports",
  NARA: "NARA finding aids",
  BOOK: "Books",
  JOURNAL: "Journals",
  NEWS: "News",
  NAID: "NARA records",
};

export default async function BibliographyPage() {
  const data = await fetchBibliographyIndex();

  const byType = new Map<CitationType, typeof data.citations>();
  for (const c of data.citations) {
    const list = byType.get(c.type) ?? [];
    list.push(c);
    byType.set(c.type, list);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header style={{ maxWidth: "68ch", marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Bibliography
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.2rem",
            letterSpacing: "-0.02em",
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          Allowlisted citations
        </h1>
        <p
          className="muted"
          style={{ fontSize: "1.02rem", lineHeight: 1.65 }}
        >
          The primary-source and allowlisted reference works this site
          draws from. Each entry carries Bluebook, Chicago, and APA
          formats. Partisan blogs and self-published books are explicitly
          not on the allowlist &mdash; see the{" "}
          <Link href="/about/editorial-policy">editorial policy</Link> for
          the rationale.
        </p>
      </header>

      <nav
        aria-label="Types"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 32,
        }}
      >
        {data.countsByType.map((c) => (
          <a
            key={c.type}
            href={`#type-${c.type}`}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              fontSize: "0.82rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {TYPE_LABEL[c.type] ?? c.type} · {c.count}
          </a>
        ))}
      </nav>

      {data.countsByType.map((t) => {
        const list = byType.get(t.type) ?? [];
        return (
          <section
            key={t.type}
            id={`type-${t.type}`}
            style={{ marginBottom: 48 }}
          >
            <SectionHeading
              eyebrow={TYPE_LABEL[t.type] ?? t.type}
              title={`${TYPE_LABEL[t.type] ?? t.type} — ${t.count}`}
            />
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {list.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: "16px 18px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.02rem",
                      lineHeight: 1.35,
                      letterSpacing: "-0.005em",
                      marginBottom: 8,
                    }}
                  >
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </div>
                  <dl
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      columnGap: 12,
                      rowGap: 4,
                      margin: 0,
                      fontSize: "0.82rem",
                      lineHeight: 1.5,
                    }}
                  >
                    <dt
                      className="muted num"
                      style={{
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Bluebook
                    </dt>
                    <dd style={{ margin: 0, color: "var(--text)" }}>
                      {c.bluebook}
                    </dd>
                    <dt
                      className="muted num"
                      style={{
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Chicago
                    </dt>
                    <dd style={{ margin: 0, color: "var(--text)" }}>
                      {c.chicago}
                    </dd>
                    <dt
                      className="muted num"
                      style={{
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      APA
                    </dt>
                    <dd style={{ margin: 0, color: "var(--text)" }}>
                      {c.apa}
                    </dd>
                  </dl>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
