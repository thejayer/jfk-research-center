import type { Metadata } from "next";
import Link from "next/link";
import { fetchBibliographyIndex } from "@/lib/api-client";
import type { CitationType } from "@/lib/api-types";
import { SectionHeading } from "@/components/ui/section-heading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bibliography",
  description:
    "Allowlisted citation registry for primary-source and reference works the site draws from, with Bluebook, Chicago, and APA formats for each.",
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

const PRIMARY_SOURCE_TYPES: CitationType[] = [
  "WC",
  "HSCA",
  "ARRB",
  "CHURCH",
  "REPORT",
  "NARA",
  "NAID",
];

export default async function BibliographyPage() {
  const data = await fetchBibliographyIndex();
  const totalEntries = data.citations.length;
  const primarySourceEntries = data.countsByType
    .filter((c) => PRIMARY_SOURCE_TYPES.includes(c.type))
    .reduce((sum, c) => sum + c.count, 0);

  const byType = new Map<CitationType, typeof data.citations>();
  for (const c of data.citations) {
    const list = byType.get(c.type) ?? [];
    list.push(c);
    byType.set(c.type, list);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 24,
          alignItems: "stretch",
          marginBottom: 34,
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Bibliography
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.2rem",
              letterSpacing: 0,
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
            The primary-source and allowlisted reference works this site draws
            from. Each entry carries Bluebook, Chicago, and APA formats.
            Partisan blogs and self-published books are explicitly not on the
            allowlist. See the{" "}
            <Link href="/about/editorial-policy">editorial policy</Link> for
            the rationale.
          </p>
        </div>
        <aside
          aria-label="Bibliography profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
            alignContent: "start",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Citation profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              ["Entries", totalEntries],
              ["Types", data.countsByType.length],
              ["Primary", primarySourceEntries],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  className="num"
                  style={{ fontSize: "1.25rem", color: "var(--text)" }}
                >
                  {value}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.68rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginTop: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Every visible citation is drawn from a source type the site can
            cite consistently across document, fact, entity, and topic pages.
          </p>
        </aside>
      </header>

      <nav
        aria-label="Types"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
          marginBottom: 36,
        }}
      >
        {data.countsByType.map((c) => (
          <a
            key={c.type}
            href={`#type-${c.type}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              fontSize: "0.84rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span>{TYPE_LABEL[c.type] ?? c.type}</span>
            <span className="muted num">{c.count}</span>
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
              title={`${TYPE_LABEL[t.type] ?? t.type} citations`}
              description={`${t.count} entries with Bluebook, Chicago, and APA formats.`}
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
                      letterSpacing: 0,
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
