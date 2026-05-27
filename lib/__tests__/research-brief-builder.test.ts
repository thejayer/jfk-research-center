import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedResearchItem } from "../saved-research";
import {
  filterExistingIds,
  mergeOrderedIds,
  moveItem,
  orderItems,
  readDraft,
  researchBriefDraftStorageKey,
  toggleSelected,
  writeDraft,
} from "../research-brief-builder-state";

const savedItems: SavedResearchItem[] = [
  {
    id: "document:wc-report-1964",
    type: "document",
    sourceId: "wc-report-1964",
    title: "Warren Commission Report",
    href: "/document/wc-report-1964",
    savedAt: Date.UTC(2026, 4, 25),
  },
  {
    id: "media:zapruder-film",
    type: "media",
    sourceId: "zapruder-film",
    title: "Zapruder film",
    href: "/media/zapruder-film",
    savedAt: Date.UTC(2026, 4, 26),
  },
  {
    id: "topic:dealey-plaza",
    type: "topic",
    sourceId: "dealey-plaza",
    title: "Dealey Plaza",
    href: "/topic/dealey-plaza",
    savedAt: Date.UTC(2026, 4, 27),
  },
];

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

function installStorage(storage = new MemoryStorage()) {
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

function stateHarness<T>(initial: T) {
  let current = initial;
  const setState: Dispatch<SetStateAction<T>> = (next) => {
    current =
      typeof next === "function"
        ? (next as (value: T) => T)(current)
        : next;
  };
  return {
    get current() {
      return current;
    },
    setState,
  };
}

describe("research brief builder state helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates deduped draft ids from localStorage", () => {
    const storage = installStorage();
    storage.setItem(
      researchBriefDraftStorageKey,
      JSON.stringify({
        title: "Draft title",
        question: 42,
        notes: "Working notes",
        orderedIds: [
          "media:zapruder-film",
          "media:zapruder-film",
          "document:wc-report-1964",
          313,
        ],
        selectedIds: [
          "document:wc-report-1964",
          "document:wc-report-1964",
          "missing:item",
          false,
        ],
      }),
    );

    expect(readDraft()).toEqual({
      title: "Draft title",
      question: "",
      notes: "Working notes",
      orderedIds: ["media:zapruder-film", "document:wc-report-1964"],
      selectedIds: ["document:wc-report-1964", "missing:item"],
    });
  });

  it("distinguishes missing selectedIds from an explicit empty selection", () => {
    const storage = installStorage();
    storage.setItem(
      researchBriefDraftStorageKey,
      JSON.stringify({
        title: "None selected",
        orderedIds: [],
        selectedIds: [],
      }),
    );

    const emptyDraft = readDraft();
    const restoredEmptyIds = filterExistingIds(
      savedItems,
      emptyDraft?.selectedIds !== undefined
        ? emptyDraft.selectedIds
        : savedItems.map((item) => item.id),
    );
    expect(emptyDraft?.selectedIds).toEqual([]);
    expect(restoredEmptyIds).toEqual([]);

    storage.setItem(
      researchBriefDraftStorageKey,
      JSON.stringify({
        title: "Legacy draft",
        orderedIds: [],
      }),
    );
    const legacyDraft = readDraft();
    const restoredLegacyIds = filterExistingIds(
      savedItems,
      legacyDraft?.selectedIds !== undefined
        ? legacyDraft.selectedIds
        : savedItems.map((item) => item.id),
    );
    expect(legacyDraft).not.toHaveProperty("selectedIds");
    expect(restoredLegacyIds).toEqual(savedItems.map((item) => item.id));
  });

  it("persists draft state without throwing", () => {
    const storage = installStorage();

    writeDraft({
      title: "Saved draft",
      question: "What changed?",
      notes: "Keep citations tight.",
      orderedIds: ["topic:dealey-plaza"],
      selectedIds: [],
    });

    expect(
      JSON.parse(storage.getItem(researchBriefDraftStorageKey) ?? "null"),
    ).toEqual({
      title: "Saved draft",
      question: "What changed?",
      notes: "Keep citations tight.",
      orderedIds: ["topic:dealey-plaza"],
      selectedIds: [],
    });
  });

  it("orders saved items, merges missing ids, and filters unknown selections", () => {
    expect(
      orderItems(savedItems, [
        "media:zapruder-film",
        "missing:item",
        "document:wc-report-1964",
        "media:zapruder-film",
      ]).map((item) => item.id),
    ).toEqual([
      "media:zapruder-film",
      "document:wc-report-1964",
      "topic:dealey-plaza",
    ]);
    expect(
      mergeOrderedIds(savedItems, [
        "media:zapruder-film",
        "missing:item",
        "document:wc-report-1964",
      ]),
    ).toEqual([
      "media:zapruder-film",
      "document:wc-report-1964",
      "topic:dealey-plaza",
    ]);
    expect(
      filterExistingIds(savedItems, [
        "document:wc-report-1964",
        "missing:item",
      ]),
    ).toEqual(["document:wc-report-1964"]);
  });

  it("toggles selections and moves ordered ids through React setters", () => {
    const selected = stateHarness(new Set(["document:wc-report-1964"]));
    toggleSelected("document:wc-report-1964", selected.setState);
    expect([...selected.current]).toEqual([]);
    toggleSelected("media:zapruder-film", selected.setState);
    expect([...selected.current]).toEqual(["media:zapruder-film"]);

    const ordered = stateHarness([
      "document:wc-report-1964",
      "media:zapruder-film",
      "topic:dealey-plaza",
    ]);
    moveItem("media:zapruder-film", -1, ordered.setState);
    expect(ordered.current).toEqual([
      "media:zapruder-film",
      "document:wc-report-1964",
      "topic:dealey-plaza",
    ]);
    moveItem("media:zapruder-film", -1, ordered.setState);
    expect(ordered.current).toEqual([
      "media:zapruder-film",
      "document:wc-report-1964",
      "topic:dealey-plaza",
    ]);
  });
});
