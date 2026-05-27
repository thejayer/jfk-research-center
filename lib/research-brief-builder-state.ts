import type { Dispatch, SetStateAction } from "react";
import type { SavedResearchItem } from "./saved-research";

export const researchBriefDraftStorageKey = "jfkrc-research-brief-draft-v1";

export type BriefDraft = {
  title: string;
  question: string;
  notes: string;
  orderedIds: string[];
  selectedIds?: string[];
};

export function orderItems(
  items: SavedResearchItem[],
  orderedIds: string[],
): SavedResearchItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ordered: SavedResearchItem[] = [];
  const placed = new Set<string>();
  for (const id of orderedIds) {
    const item = itemById.get(id);
    if (!item || placed.has(item.id)) continue;
    placed.add(item.id);
    ordered.push(item);
  }
  return [
    ...ordered,
    ...items.filter((item) => !placed.has(item.id)),
  ];
}

export function mergeOrderedIds(
  items: SavedResearchItem[],
  orderedIds: string[],
): string[] {
  return orderItems(items, orderedIds).map((item) => item.id);
}

export function filterExistingIds(
  items: SavedResearchItem[],
  ids: string[],
): string[] {
  const existing = new Set(items.map((item) => item.id));
  return ids.filter((id) => existing.has(id));
}

export function toggleSelected(
  id: string,
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>,
): void {
  setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}

export function moveItem(
  id: string,
  delta: -1 | 1,
  setOrderedIds: Dispatch<SetStateAction<string[]>>,
): void {
  setOrderedIds((current) => {
    const index = current.indexOf(id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
    const next = [...current];
    const [item] = next.splice(index, 1);
    if (!item) return current;
    next.splice(nextIndex, 0, item);
    return next;
  });
}

export function readDraft(): BriefDraft | null {
  try {
    const raw = window.localStorage.getItem(researchBriefDraftStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefDraft>;
    const draft: BriefDraft = {
      title: typeof parsed.title === "string" ? parsed.title : "JFK research brief",
      question: typeof parsed.question === "string" ? parsed.question : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      orderedIds: uniqueStringIds(parsed.orderedIds),
    };
    if (Array.isArray(parsed.selectedIds)) {
      draft.selectedIds = uniqueStringIds(parsed.selectedIds);
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeDraft(draft: BriefDraft): void {
  try {
    window.localStorage.setItem(
      researchBriefDraftStorageKey,
      JSON.stringify(draft),
    );
  } catch {
    // Local-only draft state should never block the builder.
  }
}

function uniqueStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((id): id is string => typeof id === "string")),
  );
}
