import { isArchiveIdentifierQuery } from "./cost-controls";

/**
 * Known record document-type labels. A query routes to the title path only
 * when its label is written in uppercase, as in NARA record titles
 * ("MEMORANDUM: …", "CABLE: …").
 */
const DOCUMENT_TYPE_LABELS = new Set([
  "airtel",
  "cable",
  "correspondence",
  "dispatch",
  "fbi report",
  "information report",
  "letter",
  "memo",
  "memorandum",
  "notes",
  "photograph",
  "report",
  "routing slip",
  "telegram",
  "teletype",
  "testimony",
  "textual record",
  "transmittal",
]);

/** Unknown single-word uppercase labels (e.g. AIRGRAM) need at least this many letters. */
const GENERIC_LABEL_MIN_LETTERS = 5;

export type SearchRoute = "title" | "default";

export function normalizeTitleQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True for queries shaped like a record title: an uppercase document-type
 * label, a colon, then text. The label must be uppercase and either a known
 * document type or a single word of 5+ letters. Mixed-case or lowercase
 * labels ("memo: oswald"), short acronyms ("CIA: oswald", "FYI: x") and
 * multi-word phrases that aren't document types ("WHO WAS OSWALD: a
 * profile") stay on the keyword path.
 */
export function isTitleLikeQuery(query: string): boolean {
  const match = /^([A-Za-z][A-Za-z0-9./-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./-]*){0,3})\s*:(?!\/\/)\s*\S/.exec(
    query.trim(),
  );
  if (!match) return false;

  const label = match[1];
  if (label !== label.toUpperCase()) return false;
  const normalizedLabel = normalizeTitleQuery(label);
  if (DOCUMENT_TYPE_LABELS.has(normalizedLabel)) return true;
  return new RegExp(`^[A-Z]{${GENERIC_LABEL_MIN_LETTERS},}$`).test(label);
}

/**
 * Which warehouse path a search takes. fetchSearchUncached routes with this
 * and the search cache key includes it, so queries that differ only by case
 * but route differently ("AIRGRAM: X" vs "AIRgram: X") never share an entry.
 */
export function searchRoute(input: { query: string; mode: string }): SearchRoute {
  const query = input.query.trim();
  if (input.mode !== "document" || !query) return "default";
  if (isArchiveIdentifierQuery(query)) return "default";
  return isTitleLikeQuery(query) ? "title" : "default";
}
