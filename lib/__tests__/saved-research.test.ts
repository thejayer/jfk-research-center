import { describe, expect, it } from "vitest";
import {
  addSavedResearchItem,
  clearSavedResearchItems,
  isResearchItemSaved,
  listSavedResearchItems,
  parseSavedResearchItems,
  removeSavedResearchItem,
  savedResearchKey,
  savedResearchTypeLabel,
  type SavedResearchType,
} from "../saved-research";

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

describe("saved research storage", () => {
  it("labels every saved research type", () => {
    const labels: Record<SavedResearchType, string> = {
      document: "Document",
      evidence: "Evidence",
      entity: "Entity",
      topic: "Topic",
      timeline: "Timeline",
      question: "Question",
    };

    for (const [type, label] of Object.entries(labels) as Array<
      [SavedResearchType, string]
    >) {
      expect(savedResearchTypeLabel(type)).toBe(label);
    }
  });

  it("builds stable keys from trimmed source ids", () => {
    expect(
      savedResearchKey({
        type: "document",
        sourceId: "  wc-report-1964  ",
      }),
    ).toBe("document:wc-report-1964");
  });

  it("persists, deduplicates, and sorts saved research items", () => {
    const storage = new MemoryStorage();

    addSavedResearchItem(
      {
        type: "document",
        sourceId: "  wc-report-1964  ",
        title: "Warren Commission Report",
        href: "/document/wc-report-1964",
        context: "Document",
      },
      storage,
      100,
    );
    addSavedResearchItem(
      {
        type: "document",
        sourceId: "wc-report-1964",
        title: "Updated title",
        href: "/document/wc-report-1964",
      },
      storage,
      200,
    );

    expect(listSavedResearchItems(storage)).toEqual([
      expect.objectContaining({
        id: "document:wc-report-1964",
        sourceId: "wc-report-1964",
        title: "Updated title",
        savedAt: 200,
      }),
    ]);
  });

  it("removes and clears saved research items", () => {
    const storage = new MemoryStorage();
    addSavedResearchItem(
      {
        type: "evidence",
        sourceId: "ce-399",
        title: "Commission Exhibit 399",
        href: "/evidence/ce-399",
      },
      storage,
      100,
    );

    expect(isResearchItemSaved({ type: "evidence", sourceId: "ce-399" }, storage)).toBe(true);
    removeSavedResearchItem("evidence:ce-399", storage);
    expect(listSavedResearchItems(storage)).toHaveLength(0);

    addSavedResearchItem(
      {
        type: "topic",
        sourceId: "dealey-plaza",
        title: "Dealey Plaza",
        href: "/topic/dealey-plaza",
      },
      storage,
      200,
    );
    clearSavedResearchItems(storage);
    expect(listSavedResearchItems(storage)).toHaveLength(0);
  });

  it("drops invalid and unsafe stored entries", () => {
    const parsed = parseSavedResearchItems([
      {
        type: "entity",
        sourceId: "  lee-harvey-oswald  ",
        title: "Lee Harvey Oswald",
        href: "/entity/lee-harvey-oswald",
        savedAt: 200,
      },
      {
        type: "entity",
        sourceId: "bad",
        title: "Bad link",
        href: "javascript:alert(1)",
        savedAt: 300,
      },
      {
        type: "unsupported",
        sourceId: "x",
        title: "Unsupported",
        href: "/x",
        savedAt: 400,
      },
    ]);

    expect(parsed).toEqual([
      expect.objectContaining({
        id: "entity:lee-harvey-oswald",
        sourceId: "lee-harvey-oswald",
        href: "/entity/lee-harvey-oswald",
      }),
    ]);
  });
});
