import { describe, expect, it } from "vitest";
import {
  addResearchHistoryItem,
  clearResearchHistoryItems,
  listResearchHistoryItems,
  parseResearchHistoryItems,
  removeResearchHistoryItem,
  researchHistoryKey,
  researchHistoryTypeLabel,
  type ResearchHistoryType,
} from "../research-history";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("research history storage", () => {
  it("labels every history type", () => {
    const labels: Record<ResearchHistoryType, string> = {
      document: "Document",
      evidence: "Evidence",
      entity: "Entity",
      topic: "Topic",
      timeline: "Timeline",
      question: "Open question",
      search: "Search",
      path: "Research path",
    };

    for (const [type, label] of Object.entries(labels) as Array<
      [ResearchHistoryType, string]
    >) {
      expect(researchHistoryTypeLabel(type)).toBe(label);
    }
  });

  it("uses stable trimmed keys", () => {
    expect(
      researchHistoryKey({ type: "document", sourceId: "  wc-report-1964 " }),
    ).toBe("document:wc-report-1964");
  });

  it("persists newest-first and deduplicates repeat views", () => {
    const storage = new MemoryStorage();
    addResearchHistoryItem(
      {
        type: "document",
        sourceId: " wc-report-1964 ",
        title: "Warren Commission Report",
        href: "/document/wc-report-1964",
      },
      storage,
      100,
    );
    addResearchHistoryItem(
      {
        type: "document",
        sourceId: "wc-report-1964",
        title: "Updated report title",
        href: "/document/wc-report-1964",
        context: "NAID 305052",
      },
      storage,
      200,
    );

    expect(listResearchHistoryItems(storage)).toEqual([
      expect.objectContaining({
        id: "document:wc-report-1964",
        sourceId: "wc-report-1964",
        title: "Updated report title",
        context: "NAID 305052",
        viewedAt: 200,
      }),
    ]);
  });

  it("drops unsafe stored entries", () => {
    const parsed = parseResearchHistoryItems([
      {
        type: "search",
        sourceId: "oswald",
        title: "Search: Oswald",
        href: "/search?q=Oswald",
        viewedAt: 100,
      },
      {
        type: "search",
        sourceId: "bad",
        title: "Bad search",
        href: "javascript:alert(1)",
        viewedAt: 200,
      },
      {
        type: "unsupported",
        sourceId: "bad",
        title: "Bad type",
        href: "/bad",
        viewedAt: 300,
      },
    ]);

    expect(parsed).toEqual([
      expect.objectContaining({
        id: "search:oswald",
        href: "/search?q=Oswald",
      }),
    ]);
  });

  it("removes and clears history items", () => {
    const storage = new MemoryStorage();
    addResearchHistoryItem(
      {
        type: "entity",
        sourceId: "oswald",
        title: "Lee Harvey Oswald",
        href: "/entity/oswald",
      },
      storage,
      100,
    );

    removeResearchHistoryItem("entity:oswald", storage);
    expect(listResearchHistoryItems(storage)).toHaveLength(0);

    addResearchHistoryItem(
      {
        type: "topic",
        sourceId: "dealey-plaza",
        title: "Dealey Plaza",
        href: "/topic/dealey-plaza",
      },
      storage,
      200,
    );
    clearResearchHistoryItems(storage);
    expect(listResearchHistoryItems(storage)).toHaveLength(0);
  });
});
