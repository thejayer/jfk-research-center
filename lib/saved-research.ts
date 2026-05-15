const STORAGE_KEY = "jfkrc-saved-research";
const CHANGE_EVENT = "jfkrc:saved-research-changed";
const MAX_ITEMS = 80;

export type SavedResearchType =
  | "document"
  | "evidence"
  | "entity"
  | "topic"
  | "timeline"
  | "question";

export type SavedResearchItem = {
  id: string;
  type: SavedResearchType;
  sourceId: string;
  title: string;
  href: string;
  context?: string;
  savedAt: number;
};

export type SavedResearchInput = Omit<SavedResearchItem, "id" | "savedAt">;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TYPE_LABELS: Record<SavedResearchType, string> = {
  document: "Document",
  evidence: "Evidence",
  entity: "Entity",
  topic: "Topic",
  timeline: "Timeline",
  question: "Question",
};

export function savedResearchTypeLabel(type: SavedResearchType): string {
  return TYPE_LABELS[type];
}

export function savedResearchKey(input: Pick<SavedResearchItem, "type" | "sourceId">): string {
  return `${input.type}:${input.sourceId}`;
}

export function parseSavedResearchItems(value: unknown): SavedResearchItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: SavedResearchItem[] = [];
  for (const raw of value) {
    const item = normalizeSavedResearchItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items
    .toSorted((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_ITEMS);
}

export function listSavedResearchItems(storage = browserStorage()): SavedResearchItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseSavedResearchItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function addSavedResearchItem(
  input: SavedResearchInput,
  storage = browserStorage(),
  now = Date.now(),
): SavedResearchItem {
  const item = createSavedResearchItem(input, now);
  const next = [
    item,
    ...listSavedResearchItems(storage).filter((saved) => saved.id !== item.id),
  ].slice(0, MAX_ITEMS);
  persistSavedResearchItems(next, storage);
  return item;
}

export function removeSavedResearchItem(
  id: string,
  storage = browserStorage(),
): void {
  const next = listSavedResearchItems(storage).filter((item) => item.id !== id);
  persistSavedResearchItems(next, storage);
}

export function clearSavedResearchItems(storage = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    notifySavedResearchChanged();
  } catch {
    // Storage can be unavailable in private mode; the UI simply degrades.
  }
}

export function isResearchItemSaved(
  input: Pick<SavedResearchItem, "type" | "sourceId">,
  storage = browserStorage(),
): boolean {
  const id = savedResearchKey(input);
  return listSavedResearchItems(storage).some((item) => item.id === id);
}

function createSavedResearchItem(
  input: SavedResearchInput,
  savedAt: number,
): SavedResearchItem {
  return {
    id: savedResearchKey(input),
    type: input.type,
    sourceId: input.sourceId.trim(),
    title: input.title.trim() || "Untitled item",
    href: safeInternalHref(input.href) ?? "/",
    context: input.context?.trim() || undefined,
    savedAt,
  };
}

function normalizeSavedResearchItem(value: unknown): SavedResearchItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const type = item.type;
  const sourceId = item.sourceId;
  const title = item.title;
  const href = safeInternalHref(item.href);
  const savedAt = item.savedAt;
  if (
    !isSavedResearchType(type) ||
    typeof sourceId !== "string" ||
    !sourceId.trim() ||
    typeof title !== "string" ||
    !href ||
    typeof savedAt !== "number" ||
    !Number.isFinite(savedAt)
  ) {
    return null;
  }

  const context = typeof item.context === "string" ? item.context.trim() : "";
  return {
    id: savedResearchKey({ type, sourceId: sourceId.trim() }),
    type,
    sourceId: sourceId.trim(),
    title: title.trim() || "Untitled item",
    href,
    context: context || undefined,
    savedAt,
  };
}

function persistSavedResearchItems(
  items: SavedResearchItem[],
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifySavedResearchChanged();
  } catch {
    // Quota exceeded or storage disabled; keep the rest of the app usable.
  }
}

function notifySavedResearchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isSavedResearchType(value: unknown): value is SavedResearchType {
  return (
    value === "document" ||
    value === "evidence" ||
    value === "entity" ||
    value === "topic" ||
    value === "timeline" ||
    value === "question"
  );
}

function safeInternalHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("://")) {
    return null;
  }
  return href;
}
