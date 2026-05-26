import { describe, expect, it } from "vitest";
import type { SavedResearchItem } from "../saved-research";
import {
  formatResearchBriefMarkdown,
  formatResearchBriefPlainText,
  normalizeResearchBriefItems,
} from "../research-brief";

const savedItems: SavedResearchItem[] = [
  {
    id: "document:wc-report-1964",
    type: "document",
    sourceId: "wc-report-1964",
    title: "Warren Commission Report",
    href: "/document/wc-report-1964",
    context: "Primary source",
    savedAt: Date.UTC(2026, 4, 25),
  },
  {
    id: "media:jfkl-jfkwhp-1963-11-22-b",
    type: "media",
    sourceId: "jfkl-jfkwhp-1963-11-22-b",
    title: "Dallas arrival media",
    href: "/media/jfkl-jfkwhp-1963-11-22-b",
    context: "Public domain likely / External reference",
    savedAt: Date.UTC(2026, 4, 26),
  },
];

describe("research brief helpers", () => {
  it("normalizes saved items into citation-ordered brief sources", () => {
    const normalized = normalizeResearchBriefItems([
      savedItems[0]!,
      {
        ...savedItems[0]!,
        title: "Duplicate",
      },
      {
        ...savedItems[1]!,
        href: "https://example.com/external",
      },
      savedItems[1]!,
    ]);

    expect(normalized).toEqual([
      expect.objectContaining({
        citationNumber: 1,
        typeLabel: "Document",
        title: "Warren Commission Report",
        savedDate: "2026-05-25",
      }),
      expect.objectContaining({
        citationNumber: 2,
        typeLabel: "Media",
        href: "/media/jfkl-jfkwhp-1963-11-22-b",
      }),
    ]);
  });

  it("formats a citation-oriented Markdown export", () => {
    expect(
      formatResearchBriefMarkdown({
        title: "Oswald paper trail",
        question: "What source chain matters first?",
        notes: "Keep claims narrow.\n\nCite every jump.",
        generatedAt: "2026-05-26T12:00:00.000Z",
        items: savedItems,
      }),
    ).toContain(
      [
        "# Oswald paper trail",
        "",
        "**Research question:** What source chain matters first?",
        "",
        "**Prepared:** 2026-05-26",
        "",
        "## Working notes",
        "",
        "Keep claims narrow.",
        "",
        "Cite every jump.",
        "",
        "## Selected sources",
        "",
        "1. [Warren Commission Report](/document/wc-report-1964) - Document - Primary source",
        "2. [Dallas arrival media](/media/jfkl-jfkwhp-1963-11-22-b) - Media - Public domain likely / External reference",
      ].join("\n"),
    );
  });

  it("formats a readable plain-text export", () => {
    const text = formatResearchBriefPlainText({
      title: "Dealey Plaza source stack",
      items: savedItems.slice(0, 1),
    });

    expect(text).toContain("Dealey Plaza source stack\n=========================");
    expect(text).toContain("1. Warren Commission Report");
    expect(text).toContain("Source: /document/wc-report-1964");
    expect(text).toContain("[1] Document: Warren Commission Report");
  });
});
