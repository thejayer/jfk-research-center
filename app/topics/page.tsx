import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchEstablishedFactsIndex,
  fetchOpenQuestionsIndex,
  fetchPhysicalEvidenceIndex,
  fetchTopic,
  fetchTopics,
} from "@/lib/api-client";
import type { TopicCard, TopicResponse } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Cross-cutting subjects for browsing the JFK Assassination Records Collection: investigations, agencies, and pivotal locations.",
};

export const dynamic = "force-dynamic";

type TopicTheme = "Investigations" | "Agencies" | "Places & Events";

type TopicBrowseItem = {
  topic: TopicCard;
  detail: TopicResponse | null;
  theme: TopicTheme;
  factCount: number;
  questionCount: number;
  openQuestionsHref: string | null;
};

const THEME_ORDER: TopicTheme[] = ["Investigations", "Agencies", "Places & Events"];

const THEME_DESCRIPTION: Record<TopicTheme, string> = {
  Investigations:
    "Official inquiries and review bodies that shaped the public record.",
  Agencies:
    "Institutional files, field offices, and intelligence or law-enforcement record lanes.",
  "Places & Events":
    "Locations and episodes where documents, people, and agency handling converge.",
};

function themeForTopic(topic: TopicCard): TopicTheme {
  const identity = `${topic.slug} ${topic.title}`.toLowerCase();
  const text = `${identity} ${topic.summary}`.toLowerCase();
  if (
    topic.slug === "cia" ||
    topic.slug === "fbi" ||
    identity.includes("cia") ||
    identity.includes("fbi")
  ) {
    return "Agencies";
  }
  if (
    text.includes("mexico") ||
    text.includes("dallas") ||
    text.includes("plaza") ||
    text.includes("city")
  ) {
    return "Places & Events";
  }
  if (text.includes("agency")) {
    return "Agencies";
  }
  return "Investigations";
}

function themeAnchor(theme: TopicTheme): string {
  return `theme-${theme.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default async function TopicsPage() {
  const [topics, openQuestions, establishedFacts, evidence] = await Promise.all([
    fetchTopics(),
    fetchOpenQuestionsIndex(),
    fetchEstablishedFactsIndex(),
    fetchPhysicalEvidenceIndex(),
  ]);

  const details = await Promise.all(
    topics.map((topic) => fetchTopic(topic.slug).catch(() => null)),
  );
  const detailsBySlug = new Map(
    details
      .filter((detail): detail is TopicResponse => Boolean(detail))
      .map((detail) => [detail.topic.slug, detail]),
  );
  const questionsBySlug = new Map(
    openQuestions.topics.map((topic) => [topic.slug, topic]),
  );
  const topicSlugs = new Set(topics.map((topic) => topic.slug));
  const slugByTitle = new Map(
    topics.map((topic) => [normalizeTitle(topic.title), topic.slug]),
  );
  const factsBySlug = new Map<string, number>();
  for (const topic of establishedFacts.countsByTopic) {
    const slug = topicSlugs.has(topic.topicId)
      ? topic.topicId
      : slugByTitle.get(normalizeTitle(topic.topicTitle));
    if (slug) factsBySlug.set(slug, topic.count);
  }

  const topicItems: TopicBrowseItem[] = topics
    .map((topic) => {
      const openQuestionTopic = questionsBySlug.get(topic.slug);
      return {
        topic,
        detail: detailsBySlug.get(topic.slug) ?? null,
        theme: themeForTopic(topic),
        factCount: factsBySlug.get(topic.slug) ?? 0,
        questionCount: openQuestionTopic?.questionCount ?? 0,
        openQuestionsHref: openQuestionTopic?.href ?? null,
      };
    })
    .toSorted((a, b) => b.topic.documentCount - a.topic.documentCount);

  const documentCount = topics.reduce(
    (total, topic) => total + topic.documentCount,
    0,
  );
  const entityCount = new Set(
    details.flatMap((detail) =>
      detail?.relatedEntities.map((entity) => entity.slug) ?? [],
    ),
  ).size;
  const openQuestionCount = topicItems.reduce(
    (total, item) => total + item.questionCount,
    0,
  );
  const establishedFactCount = topicItems.reduce(
    (total, item) => total + item.factCount,
    0,
  );
  const largestTopic = topicItems[0]?.topic;
  const themes = THEME_ORDER.map((theme) => ({
    theme,
    items: topicItems.filter((item) => item.theme === theme),
  })).filter((group) => group.items.length > 0);
  const primaryTheme =
    themes.find((group) => group.theme === "Investigations") ?? themes[0];

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 96 }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Home
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--text)" }}>Topics</span>
      </nav>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "start",
          paddingTop: 40,
          paddingBottom: 34,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Browse the archive
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              letterSpacing: 0,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Browse the record by subject
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 0.9rem + 0.4vw, 1.22rem)",
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            Topics are research lanes: each one gathers primary records,
            people, organizations, passages, open questions, and settled facts
            into a single dossier path.
          </p>
          <p
            className="muted"
            style={{ fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 18 }}
          >
            Use this index when you know the subject area but not the document
            title. The cards below show where each lane connects to evidence,
            established findings, unresolved threads, and related entities.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {primaryTheme && (
              <LinkButton href={`#${themeAnchor(primaryTheme.theme)}`} size="sm">
                Start with {primaryTheme.theme.toLowerCase()}
              </LinkButton>
            )}
            <LinkButton href="/search" variant="secondary" size="sm">
              Search all records
            </LinkButton>
          </div>
        </div>

        <aside
          aria-label="Topic index profile"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div className="eyebrow" style={{ color: "var(--text-muted)" }}>
            Topic profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["Topics", topics.length],
              ["Documents", documentCount],
              ["Entities", entityCount],
              ["Questions", openQuestionCount],
            ].map(([label, value]) => (
              <ProfileStat key={label} label={String(label)} value={value} />
            ))}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Largest lane:{" "}
            <span style={{ color: "var(--text)" }}>
              {largestTopic?.title ?? "None yet"}
            </span>
            . {formatNumber(establishedFactCount)} established facts are linked
            to topic dossiers.
          </p>
        </aside>
      </header>

      <nav
        aria-label="Topic themes"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 10,
          marginTop: 26,
          marginBottom: 42,
        }}
      >
        {themes.map((group) => (
          <a
            key={group.theme}
            href={`#${themeAnchor(group.theme)}`}
            style={{
              display: "grid",
              gap: 8,
              padding: "13px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span>{group.theme}</span>
              <span className="muted num">{group.items.length}</span>
            </span>
            <span className="muted" style={{ fontSize: "0.78rem", lineHeight: 1.4 }}>
              {THEME_DESCRIPTION[group.theme]}
            </span>
          </a>
        ))}
      </nav>

      {themes.map((group) => (
        <section
          key={group.theme}
          id={themeAnchor(group.theme)}
          aria-label={`${group.theme} topics`}
          style={{
            marginBottom: 58,
            scrollMarginTop: "calc(var(--header-height) + 20px)",
          }}
        >
          <SectionHeading
            eyebrow={`${formatNumber(group.items.length)} topics`}
            title={group.theme}
            description={THEME_DESCRIPTION[group.theme]}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {group.items.map((item) => (
              <TopicBrowseCard key={item.topic.slug} item={item} />
            ))}
          </div>
        </section>
      ))}

      <section
        aria-label="Evidence and reading paths"
        style={{
          marginTop: 72,
          padding: "28px 30px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0, maxWidth: "68ch" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Evidence layer
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.28rem",
              letterSpacing: 0,
              marginBottom: 6,
            }}
          >
            Follow topics into physical evidence
          </div>
          <p className="muted" style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>
            Topic dossiers organize the document record. The evidence catalog
            keeps the physical side of the case separate, with{" "}
            {formatNumber(evidence.items.length)} cataloged items across{" "}
            {formatNumber(evidence.categories.length)} evidence categories.
          </p>
        </div>
        <LinkButton href="/evidence" variant="primary">
          Open evidence catalog
          <ArrowRightIcon />
        </LinkButton>
      </section>
    </div>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 6px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "1.08rem" }}>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.62rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TopicBrowseCard({ item }: { item: TopicBrowseItem }) {
  const entityPreview = item.detail?.relatedEntities.slice(0, 3) ?? [];
  const documentPreview = item.detail?.topDocuments.slice(0, 2) ?? [];
  const searchHref = `/search?topic=${encodeURIComponent(item.topic.slug)}`;

  return (
    <article
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: "18px 20px",
        display: "grid",
        gap: 14,
        minHeight: 360,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.topic.eyebrow && (
            <span className="eyebrow" style={{ color: "var(--text-muted)" }}>
              {item.topic.eyebrow}
            </span>
          )}
          <Badge tone="muted" size="sm">
            {item.theme}
          </Badge>
        </div>
        <span className="muted num" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
          {formatNumber(item.topic.documentCount)}
        </span>
      </div>

      <div>
        <Link
          href={item.topic.href}
          style={{
            color: "var(--text)",
            textDecoration: "none",
            fontFamily: "var(--font-serif)",
            fontSize: "1.25rem",
            lineHeight: 1.25,
            letterSpacing: 0,
          }}
        >
          {item.topic.title}
        </Link>
        <p
          className="muted"
          style={{ fontSize: "0.9rem", lineHeight: 1.55, marginTop: 8 }}
        >
          {item.topic.summary}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        <MiniMetric label="Docs" value={item.topic.documentCount} />
        <MiniMetric label="Facts" value={item.factCount} />
        <MiniMetric label="Open" value={item.questionCount} />
      </div>

      {entityPreview.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Key entities
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {entityPreview.map((entity) => (
              <Link
                key={entity.slug}
                href={entity.href}
                style={{
                  padding: "2px 8px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 4,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  fontSize: "0.74rem",
                }}
              >
                {entity.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {documentPreview.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Source trail
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {documentPreview.map((document) => (
              <Link
                key={document.id}
                href={document.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: "0.82rem",
                  lineHeight: 1.35,
                }}
              >
                <span style={{ minWidth: 0 }}>{document.title}</span>
                <span className="muted num" style={{ whiteSpace: "nowrap" }}>
                  Doc
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <LinkButton href={item.topic.href} size="sm" variant="primary">
          Open dossier
        </LinkButton>
        <LinkButton href={searchHref} size="sm" variant="secondary">
          Search topic
        </LinkButton>
        {item.openQuestionsHref && (
          <Link
            href={item.openQuestionsHref}
            style={{
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            Open questions
            <ArrowRightIcon />
          </Link>
        )}
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 6px",
        textAlign: "center",
      }}
    >
      <div className="num" style={{ fontSize: "0.96rem" }}>
        {formatNumber(value)}
      </div>
      <div
        className="muted"
        style={{
          fontSize: "0.58rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
