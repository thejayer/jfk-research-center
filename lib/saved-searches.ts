/**
 * Local-storage saved searches. Client-only — callers must guard against
 * SSR use themselves, or rely on the safe `typeof window` checks here.
 *
 * Stored under `jfkrc-saved-searches` as a JSON array. Capped at 50 items
 * (oldest evicted) so a runaway user can't bloat localStorage.
 */

const STORAGE_KEY = "jfkrc-saved-searches";
const MAX_ITEMS = 50;

export type SavedSearch = {
  id: string;
  name: string;
  /** Relative path, starting with `/search?`. */
  url: string;
  createdAt: number;
};

export function listSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedSearch);
  } catch {
    return [];
  }
}

export function addSavedSearch(input: {
  name: string;
  url: string;
}): SavedSearch {
  const entry: SavedSearch = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || "Untitled search",
    url: input.url,
    createdAt: Date.now(),
  };
  const next = [entry, ...listSavedSearches()].slice(0, MAX_ITEMS);
  persist(next);
  return entry;
}

export function removeSavedSearch(id: string): void {
  const next = listSavedSearches().filter((s) => s.id !== id);
  persist(next);
}

function persist(items: SavedSearch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("jfkrc:saved-searches-changed"));
  } catch {
    // Quota exceeded, private mode with storage disabled — degrade silently.
  }
}

function isSavedSearch(v: unknown): v is SavedSearch {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.url === "string" &&
    typeof o.createdAt === "number"
  );
}
