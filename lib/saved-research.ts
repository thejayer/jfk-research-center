import {
  changeEvent,
  maxItems,
  storageKey,
  typeLabels,
} from "./constants";

export type SavedResearchType = keyof typeof typeLabels;

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

/** Returns the user-facing label for a saved research item type. */
export function savedResearchTypeLabel(type: SavedResearchType): string {
  return typeLabels[type];
}

/** Builds the stable storage identity for a saved item from type and source id. */
export function savedResearchKey(input: Pick<SavedResearchItem, "type" | "sourceId">): string {
  return `${input.type}:${input.sourceId.trim()}`;
}

/**
 * Coerces unknown stored JSON into valid saved items.
 *
 * Invalid entries are dropped, duplicate ids are ignored after the first valid
 * occurrence, the result is sorted newest-first, and the list is capped to the
 * configured storage limit.
 */
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
  return [...items]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, maxItems);
}

/**
 * Reads saved research items from storage.
 *
 * Missing storage, malformed JSON, or unavailable browser storage all resolve
 * to an empty list so the client UI can degrade without throwing.
 */
export function listSavedResearchItems(storage = browserStorage()): SavedResearchItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    return parseSavedResearchItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Creates or replaces a saved research item, then persists it newest-first.
 *
 * Re-saving the same type/source pair deduplicates by stable id and moves the
 * item to the front of the tray.
 */
export function addSavedResearchItem(
  input: SavedResearchInput,
  storage = browserStorage(),
  now = Date.now(),
): SavedResearchItem {
  const item = createSavedResearchItem(input, now);
  const next = [
    item,
    ...listSavedResearchItems(storage).filter((saved) => saved.id !== item.id),
  ].slice(0, maxItems);
  persistSavedResearchItems(next, storage);
  return item;
}

/** Removes one saved item by stable id and persists the remaining list. */
export function removeSavedResearchItem(
  id: string,
  storage = browserStorage(),
): void {
  const next = listSavedResearchItems(storage).filter((item) => item.id !== id);
  persistSavedResearchItems(next, storage);
}

/**
 * Clears all saved research items.
 *
 * Storage failures are ignored because this feature is local-only convenience
 * state and must not break page interaction.
 */
export function clearSavedResearchItems(storage = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
    notifySavedResearchChanged();
  } catch {
    // Storage can be unavailable in private mode; the UI simply degrades.
  }
}

/** Checks whether a type/source pair is currently saved in storage. */
export function isResearchItemSaved(
  input: Pick<SavedResearchItem, "type" | "sourceId">,
  storage = browserStorage(),
): boolean {
  const id = savedResearchKey(input);
  return listSavedResearchItems(storage).some((item) => item.id === id);
}

// Normalizes fresh user/page input into the persisted schema.
function createSavedResearchItem(
  input: SavedResearchInput,
  savedAt: number,
): SavedResearchItem {
  const trimmedSourceId = input.sourceId.trim();
  if (!trimmedSourceId) {
    throw new Error("sourceId required");
  }
  return {
    id: savedResearchKey({ type: input.type, sourceId: trimmedSourceId }),
    type: input.type,
    sourceId: trimmedSourceId,
    title: input.title.trim() || "Untitled item",
    href: safeInternalHref(input.href) ?? "/",
    context: input.context?.trim() || undefined,
    savedAt,
  };
}

// Accepts only persisted records that match the current schema and safe hrefs.
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

// Persists the complete list and notifies same-tab listeners; failures are soft.
function persistSavedResearchItems(
  items: SavedResearchItem[],
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(items));
    notifySavedResearchChanged();
  } catch {
    // Quota exceeded or storage disabled; keep the rest of the app usable.
  }
}

// Broadcasts same-tab changes; cross-tab sync is handled by the storage event.
function notifySavedResearchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(changeEvent));
}

// Reads browser storage defensively because some modes throw on localStorage access.
function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isSavedResearchType(value: unknown): value is SavedResearchType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(typeLabels, value)
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
