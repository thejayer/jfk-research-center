import { isArchiveIdentifierQuery } from "./cost-controls";

/**
 * Known record document-type labels. A query routes to the title path only
 * when its label is one of these, written in uppercase as in NARA record
 * titles ("MEMORANDUM: …", "CABLE: …").
 */
export const DOCUMENT_TYPE_LABELS: ReadonlySet<string> = new Set([
  "airgram",
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

export type SearchRoute = "title" | "default";

/**
 * Title matching key: whitespace before a colon removed ("MEMO : X" ->
 * "memo: x"), other whitespace runs collapsed, lowercase. Must stay in step
 * with the stored-title expression in buildTitleSearchSql.
 */
export function normalizeTitleQuery(query: string): string {
  return query.trim().replace(/\s*:/g, ":").replace(/\s+/g, " ").toLowerCase();
}

/**
 * True for queries shaped like a record title: a known document-type label
 * written in uppercase, a colon, then text. Mixed-case or lowercase labels
 * ("memo: oswald"), labels that aren't known document types ("SUBJECT: x",
 * "SECRET: x", "CIA: oswald") and phrases ("WHO WAS OSWALD: a profile")
 * stay on the keyword path.
 */
export function isTitleLikeQuery(query: string): boolean {
  const match = /^([A-Za-z][A-Za-z0-9./-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./-]*){0,3})\s*:(?!\/\/)\s*\S/.exec(
    query.trim(),
  );
  if (!match) return false;

  const label = match[1];
  if (label !== label.toUpperCase()) return false;
  return DOCUMENT_TYPE_LABELS.has(normalizeTitleQuery(label));
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
