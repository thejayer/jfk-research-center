import {
  savedResearchTypeLabel,
  type SavedResearchItem,
} from "./saved-research";

export type ResearchBriefItem = SavedResearchItem & {
  citationNumber: number;
  typeLabel: string;
  savedDate: string;
};

export type ResearchBriefInput = {
  title?: string;
  question?: string;
  notes?: string;
  items: readonly SavedResearchItem[];
  generatedAt?: Date | number | string;
};

const defaultTitle = "JFK research brief";

/**
 * Converts saved tray entries into numbered brief sources.
 *
 * Invalid hrefs are dropped defensively, duplicate saved item ids keep the
 * first occurrence, and source order is preserved so user reordering controls
 * the exported citation sequence.
 */
export function normalizeResearchBriefItems(
  items: readonly SavedResearchItem[],
): ResearchBriefItem[] {
  const seen = new Set<string>();
  const briefItems: ResearchBriefItem[] = [];

  for (const item of items) {
    if (seen.has(item.id) || !isSafeInternalHref(item.href)) continue;
    seen.add(item.id);
    briefItems.push({
      ...item,
      title: cleanInlineText(item.title) || "Untitled source",
      context: cleanInlineText(item.context),
      href: item.href.trim(),
      sourceId: item.sourceId.trim(),
      citationNumber: briefItems.length + 1,
      typeLabel: savedResearchTypeLabel(item.type),
      savedDate: formatBriefDate(item.savedAt),
    });
  }

  return briefItems;
}

/**
 * Formats a saved-source brief as Markdown.
 *
 * @param input ResearchBriefInput; title/question use cleanInlineText, notes
 * use cleanBlockText, items use normalizeResearchBriefItems, and optional
 * generatedAt is formatted with formatBriefDate.
 * @returns Markdown with escaped text/link labels, selected-source and
 * reference sections, empty-item messages, and a trailing newline.
 */
export function formatResearchBriefMarkdown(input: ResearchBriefInput): string {
  const title = cleanInlineText(input.title) || defaultTitle;
  const question = cleanInlineText(input.question);
  const notes = cleanBlockText(input.notes);
  const items = normalizeResearchBriefItems(input.items);
  const generatedDate =
    input.generatedAt === undefined ? "" : formatBriefDate(input.generatedAt);
  const lines: string[] = [`# ${escapeMarkdownText(title)}`, ""];

  if (question) {
    lines.push(`**Research question:** ${escapeMarkdownText(question)}`, "");
  }

  if (generatedDate) {
    lines.push(`**Prepared:** ${generatedDate}`, "");
  }

  if (notes) {
    lines.push("## Working notes", "", escapeMarkdownText(notes), "");
  }

  lines.push("## Selected sources", "");
  if (items.length === 0) {
    lines.push("No saved sources selected.", "");
  } else {
    for (const item of items) {
      const context = item.context ? ` - ${escapeMarkdownText(item.context)}` : "";
      lines.push(
        `${item.citationNumber}. [${escapeMarkdownLinkText(item.title)}](${item.href}) - ${item.typeLabel}${context}`,
      );
    }
    lines.push("");
  }

  lines.push("## References", "");
  if (items.length === 0) {
    lines.push("No references yet.");
  } else {
    for (const item of items) {
      const context = item.context ? ` - ${escapeMarkdownText(item.context)}` : "";
      lines.push(
        `[${item.citationNumber}] ${item.typeLabel}: [${escapeMarkdownLinkText(item.title)}](${item.href})${context}`,
      );
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Formats a saved-source brief as plain text.
 *
 * @param input ResearchBriefInput; title/question use cleanInlineText, notes
 * use cleanBlockText, items use normalizeResearchBriefItems, and optional
 * generatedAt is formatted with formatBriefDate.
 * @returns Plain text with heading, selected-source and reference sections,
 * empty-item messages, and a trailing newline.
 */
export function formatResearchBriefPlainText(input: ResearchBriefInput): string {
  const title = cleanInlineText(input.title) || defaultTitle;
  const question = cleanInlineText(input.question);
  const notes = cleanBlockText(input.notes);
  const items = normalizeResearchBriefItems(input.items);
  const generatedDate =
    input.generatedAt === undefined ? "" : formatBriefDate(input.generatedAt);
  const lines: string[] = [title, "=".repeat(title.length), ""];

  if (question) {
    lines.push(`Research question: ${question}`, "");
  }

  if (generatedDate) {
    lines.push(`Prepared: ${generatedDate}`, "");
  }

  if (notes) {
    lines.push("Working notes", "", notes, "");
  }

  lines.push("Selected sources", "");
  if (items.length === 0) {
    lines.push("No saved sources selected.", "");
  } else {
    for (const item of items) {
      lines.push(`${item.citationNumber}. ${item.title}`);
      lines.push(`   Type: ${item.typeLabel}`);
      lines.push(`   Source: ${item.href}`);
      if (item.context) lines.push(`   Context: ${item.context}`);
    }
    lines.push("");
  }

  lines.push("References", "");
  if (items.length === 0) {
    lines.push("No references yet.");
  } else {
    for (const item of items) {
      const context = item.context ? ` - ${item.context}` : "";
      lines.push(`[${item.citationNumber}] ${item.typeLabel}: ${item.title} (${item.href})${context}`);
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function cleanInlineText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanBlockText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSafeInternalHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  return Boolean(href) && href.startsWith("/") && !href.startsWith("//") && !href.includes("://");
}

function formatBriefDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toISOString().slice(0, 10);
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/</g, "\\<").replace(/>/g, "\\>");
}

function escapeMarkdownLinkText(value: string): string {
  return escapeMarkdownText(value)
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}
