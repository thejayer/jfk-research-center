import {
  historyChangeEvent,
  historyMaxItems,
  historyStorageKey,
} from "./constants";

export type ResearchHistoryType =
  | "document"
  | "evidence"
  | "entity"
  | "topic"
  | "timeline"
  | "question"
  | "media"
  | "search"
  | "path";

export type ResearchHistoryItem = {
  id: string;
  type: ResearchHistoryType;
  sourceId: string;
  title: string;
  href: string;
  context?: string;
  viewedAt: number;
};

export type ResearchHistoryInput = Omit<ResearchHistoryItem, "id" | "viewedAt">;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function researchHistoryTypeLabel(type: ResearchHistoryType): string {
  switch (type) {
    case "document":
      return "Document";
    case "evidence":
      return "Evidence";
    case "entity":
      return "Entity";
    case "topic":
      return "Topic";
    case "timeline":
      return "Timeline";
    case "question":
      return "Open question";
    case "media":
      return "Media";
    case "search":
      return "Search";
    case "path":
      return "Research path";
  }
}

export function researchHistoryKey(
  input: Pick<ResearchHistoryItem, "type" | "sourceId">,
): string {
  return `${input.type}:${input.sourceId.trim()}`;
}

export function parseResearchHistoryItems(value: unknown): ResearchHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: ResearchHistoryItem[] = [];
  for (const raw of value) {
    const item = normalizeResearchHistoryItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return [...items]
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, historyMaxItems);
}

export function listResearchHistoryItems(
  storage = browserStorage(),
): ResearchHistoryItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(historyStorageKey);
    if (!raw) return [];
    return parseResearchHistoryItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function addResearchHistoryItem(
  input: ResearchHistoryInput,
  storage = browserStorage(),
  now = Date.now(),
): ResearchHistoryItem {
  const item = createResearchHistoryItem(input, now);
  const next = [
    item,
    ...listResearchHistoryItems(storage).filter((saved) => saved.id !== item.id),
  ].slice(0, historyMaxItems);
  persistResearchHistoryItems(next, storage);
  return item;
}

export function removeResearchHistoryItem(
  id: string,
  storage = browserStorage(),
): void {
  const next = listResearchHistoryItems(storage).filter((item) => item.id !== id);
  persistResearchHistoryItems(next, storage);
}

export function clearResearchHistoryItems(storage = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(historyStorageKey);
    notifyResearchHistoryChanged();
  } catch {
    // Local history is convenience state; storage failures should not block UI.
  }
}

function createResearchHistoryItem(
  input: ResearchHistoryInput,
  viewedAt: number,
): ResearchHistoryItem {
  const sourceId = input.sourceId.trim();
  if (!sourceId) throw new Error("sourceId required");
  return {
    id: researchHistoryKey({ type: input.type, sourceId }),
    type: input.type,
    sourceId,
    title: input.title.trim() || "Untitled item",
    href: safeInternalHref(input.href) ?? "/",
    context: input.context?.trim() || undefined,
    viewedAt,
  };
}

function normalizeResearchHistoryItem(value: unknown): ResearchHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const type = item.type;
  const sourceId = item.sourceId;
  const title = item.title;
  const href = safeInternalHref(item.href);
  const viewedAt = item.viewedAt;
  if (
    !isResearchHistoryType(type) ||
    typeof sourceId !== "string" ||
    !sourceId.trim() ||
    typeof title !== "string" ||
    !href ||
    typeof viewedAt !== "number" ||
    !Number.isFinite(viewedAt)
  ) {
    return null;
  }
  const context = typeof item.context === "string" ? item.context.trim() : "";
  return {
    id: researchHistoryKey({ type, sourceId }),
    type,
    sourceId: sourceId.trim(),
    title: title.trim() || "Untitled item",
    href,
    context: context || undefined,
    viewedAt,
  };
}

function persistResearchHistoryItems(
  items: ResearchHistoryItem[],
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(historyStorageKey, JSON.stringify(items));
    notifyResearchHistoryChanged();
  } catch {
    // Quota exceeded or storage disabled; keep browsing unaffected.
  }
}

function notifyResearchHistoryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(historyChangeEvent));
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isResearchHistoryType(value: unknown): value is ResearchHistoryType {
  return (
    value === "document" ||
    value === "evidence" ||
    value === "entity" ||
    value === "topic" ||
    value === "timeline" ||
    value === "question" ||
    value === "media" ||
    value === "search" ||
    value === "path"
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
