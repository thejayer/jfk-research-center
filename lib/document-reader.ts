import { formatNumber } from "./format";

/**
 * Helpers for the page-at-a-time document reader.
 *
 * Shareable locations use `?chunk=N#chunk-N` so the server can paint the
 * requested OCR page on first load. `#chunk-N` alone remains readable, but
 * hashes are not visible to SSR.
 */

export function parseHashChunk(hash: string): number | null {
  const match = /^#?chunk-(-?\d+)$/.exec(hash);
  return match ? Number(match[1]) : null;
}

/**
 * Prefer a hash target when it disagrees with `?chunk=`. After the first
 * page turn the query is written by replaceState; in-page `#chunk-N`
 * clicks would otherwise be ignored.
 */
export function requestedReaderChunk(
  search: string | URLSearchParams,
  hash: string,
): { chunk: number | null; hashOnly: boolean } {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const fromQuery = parseChunkParam(params.get("chunk"));
  const fromHash = parseHashChunk(hash);
  if (fromHash != null && fromHash !== fromQuery) {
    return { chunk: fromHash, hashOnly: fromQuery == null };
  }
  return {
    chunk: fromQuery ?? fromHash,
    hashOnly: fromQuery == null && fromHash != null,
  };
}

/** Hide the SSR first page only while a hash-only target is still in flight. */
export function shouldHideOcrForHashDeepLink(input: {
  hideUntilLoad: boolean;
  settled: boolean;
}): boolean {
  return input.hideUntilLoad && !input.settled;
}

/** Ignore OCR responses that finished after a newer page turn started. */
export function isLatestReaderLoad(generation: number, latest: number): boolean {
  return generation === latest;
}

export function parseChunkParam(
  value: string | string[] | undefined | null,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return null;
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export function parseOcrJumpInput(
  value: string,
):
  | { kind: "chunk"; order: number }
  | { kind: "page-label"; label: string }
  | { kind: "invalid" } {
  const trimmed = value.trim();
  if (!trimmed) return { kind: "invalid" };
  const pageMatch = /^(?:p(?:age)?\.?\s*)(\d+)$/i.exec(trimmed);
  if (pageMatch) {
    return { kind: "page-label", label: `p. ${pageMatch[1]}` };
  }
  if (/^-?\d+$/.test(trimmed)) {
    return { kind: "chunk", order: Number(trimmed) };
  }
  return { kind: "invalid" };
}

export function documentReaderHref(
  documentId: string,
  chunkOrder?: number | null,
): string {
  const base = `/document/${encodeURIComponent(documentId)}`;
  if (chunkOrder == null || !Number.isFinite(chunkOrder)) return base;
  const order = Math.trunc(chunkOrder);
  return `${base}?chunk=${order}#chunk-${order}`;
}

export function replaceDocumentReaderUrl(chunkOrder: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set("chunk", String(chunkOrder));
  url.hash = `chunk-${chunkOrder}`;
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function parsePageLabelNumber(
  label: string | null | undefined,
): number | null {
  if (!label) return null;
  const match = /\b(?:p(?:age)?\.?\s*)(\d+)\b/i.exec(label.trim());
  return match ? Number(match[1]) : null;
}

export function archivalPageCount(input: {
  pageCount?: number | null;
  lastPageLabel?: string | null;
}): { count: number; estimated: boolean } | null {
  if (input.pageCount && input.pageCount > 0) {
    return { count: input.pageCount, estimated: false };
  }
  const fromLabel = parsePageLabelNumber(input.lastPageLabel);
  if (fromLabel && fromLabel > 0) {
    return { count: fromLabel, estimated: true };
  }
  return null;
}

/** Hide NARA `pageCount` 0; show "~N" only when an archival pageLabel exists. */
export function formatArchivalPageCount(input: {
  pageCount?: number | null;
  lastPageLabel?: string | null;
}): { label: string; value: string } | null {
  const pages = archivalPageCount(input);
  if (!pages) return null;
  return {
    label: pages.estimated ? "Archival pages" : "Pages",
    value: `${pages.estimated ? "~" : ""}${formatNumber(pages.count)}`,
  };
}

export function formatOcrReaderStatus(input: {
  pageLabel?: string | null;
  lastPageLabel?: string | null;
  chunkCount?: number | null;
  loading?: boolean;
}): string {
  const current = parsePageLabelNumber(input.pageLabel);
  const last = parsePageLabelNumber(input.lastPageLabel);
  const parts: string[] = [];
  if (current != null && last != null) {
    parts.push(`Page ${formatNumber(current)} of ~${formatNumber(last)}`);
  } else if (input.pageLabel?.trim()) {
    parts.push(input.pageLabel.trim());
  } else {
    parts.push("OCR page");
  }
  if (input.chunkCount && input.chunkCount > 0) {
    parts.push(`${formatNumber(input.chunkCount)} OCR pages`);
  }
  if (input.loading) parts.push("loading");
  return parts.join(" · ");
}

/**
 * Warehouse titles after sql/10a + sql/10:
 *   empty NARA title → "Untitled {doc_type}" or null → "Untitled Record"
 * Live corpus also uses exact placeholders WITHHELD / [RESTRICTED].
 * Do not treat a real NARA sentence that happens to start with
 * "Untitled" as generic (e.g. "Untitled memo concerning Oswald").
 */
const GENERIC_TITLE_KEYS = new Set([
  "",
  "untitled",
  "untitled record",
  "n a",
  "na",
  "none",
  "unknown",
  "title withheld",
  "withheld",
  "restricted",
]);

const RECORD_TYPE_WORDS = new Set([
  "paper",
  "textual",
  "document",
  "cable",
  "memo",
  "memorandum",
  "letter",
  "report",
  "dispatch",
  "telegram",
  "airtel",
  "file",
  "routing",
  "slip",
  "message",
  "transcript",
  "form",
]);

const PROSE_WORDS = new Set([
  "concerning",
  "regarding",
  "about",
  "re",
  "from",
  "to",
  "of",
  "on",
  "for",
  "with",
  "and",
  "the",
  "a",
  "an",
]);

const DESCRIPTION_KINDS: Array<{ re: RegExp; label: string }> = [
  { re: /\bbulky(\s+enc(?:losure)?)?\b/i, label: "bulky file" },
  { re: /\brouting\s+slip\b/i, label: "routing slip" },
  { re: /\bairtel\b/i, label: "airtel" },
  { re: /\bmemorandum\b|\bmemos?\b/i, label: "memo" },
  { re: /\bcable\b/i, label: "cable" },
  { re: /\bdispatch\b/i, label: "dispatch" },
  { re: /\btelegram\b/i, label: "telegram" },
  { re: /\bletter\b/i, label: "letter" },
  { re: /\breport\b/i, label: "report" },
];

export function normalizeTitleKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isGenericDocumentTitle(
  title: string | null | undefined,
  documentType?: string | null,
): boolean {
  const trimmed = title?.trim() ?? "";
  const key = normalizeTitleKey(trimmed);
  if (GENERIC_TITLE_KEYS.has(key)) return true;

  const typeKey = normalizeTitleKey(documentType);
  if (typeKey && key === typeKey) return true;

  if (!/^untitled\b/i.test(trimmed)) return false;
  const rest = normalizeTitleKey(trimmed.replace(/^untitled\b/i, ""));
  if (!rest) return true;
  if (typeKey && rest === typeKey) return true;
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.some((word) => PROSE_WORDS.has(word))) return false;
  return words.every((word) => RECORD_TYPE_WORDS.has(word));
}

function kindFromDocumentType(documentType?: string | null): string | null {
  const key = normalizeTitleKey(documentType);
  if (!key) return null;
  if (/\bpaper\b/.test(key) && /\b(textual|document)\b/.test(key)) {
    return "paper";
  }
  if (/\bairtel\b/.test(key)) return "airtel";
  if (/\brouting\b/.test(key) && /\bslip\b/.test(key)) return "routing slip";
  if (/\bmemorandum\b|\bmemo\b/.test(key)) return "memo";
  if (/\bcable\b/.test(key)) return "cable";
  if (/\bdispatch\b/.test(key)) return "dispatch";
  if (/\btelegram\b/.test(key)) return "telegram";
  if (/\bletter\b/.test(key)) return "letter";
  if (/\breport\b/.test(key)) return "report";
  if (/\bfile\b/.test(key)) return "file";
  if (key.length > 32) return null;
  return key;
}

function kindFromDescription(description?: string | null): string | null {
  if (!description) return null;
  for (const { re, label } of DESCRIPTION_KINDS) {
    if (re.test(description)) return label;
  }
  return null;
}

export type DocumentTitleInput = {
  title?: string | null;
  naid?: string | null;
  agency?: string | null;
  description?: string | null;
  documentType?: string | null;
};

export function displayDocumentTitle(doc: DocumentTitleInput): string {
  if (!isGenericDocumentTitle(doc.title, doc.documentType)) {
    return doc.title!.trim();
  }
  const leftover = doc.title?.replace(/^untitled\b/i, "") ?? "";
  const kind =
    kindFromDescription(doc.description) ??
    kindFromDocumentType(doc.documentType) ??
    kindFromDocumentType(leftover) ??
    "record";
  const agency = doc.agency?.trim();
  if (agency) return `${agency} ${kind}`;
  if (kind !== "record") return kind.charAt(0).toUpperCase() + kind.slice(1);
  const naid = doc.naid?.trim();
  return naid ? `NAID ${naid}` : "Untitled record";
}

/** Display title plus the raw warehouse/NARA title for API consumers. */
export function documentDisplayFields(doc: DocumentTitleInput): {
  title: string;
  sourceTitle: string | null;
} {
  const sourceTitle = doc.title?.trim() || null;
  return {
    title: displayDocumentTitle(doc),
    sourceTitle,
  };
}

export function isPdfUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return /\.pdf$/i.test(url.pathname);
  } catch {
    return /\.pdf(?:[?#]|$)/i.test(href);
  }
}

export type DocumentSourceLink = {
  kind: "pdf" | "catalog";
  href: string;
  label: string;
  note: string;
};

export function documentSourceLinks(doc: {
  sourceUrl?: string | null;
  digitalObjectUrl?: string | null;
}): DocumentSourceLink[] {
  const hrefs = [doc.digitalObjectUrl, doc.sourceUrl].filter(
    (href): href is string => Boolean(href),
  );
  const seen = new Set<string>();
  const links: DocumentSourceLink[] = [];
  for (const href of hrefs) {
    if (seen.has(href)) continue;
    seen.add(href);
    if (isPdfUrl(href)) {
      links.push({
        kind: "pdf",
        href,
        label: "NARA scan (PDF)",
        note: "Archival PDF / scanned pages",
      });
    } else {
      links.push({
        kind: "catalog",
        href,
        label: "National Archives Catalog",
        note: "Catalog record page",
      });
    }
  }
  return links;
}

export function primaryDocumentAction(doc: {
  sourceUrl?: string | null;
  digitalObjectUrl?: string | null;
}): { href: string; label: string } | null {
  const links = documentSourceLinks(doc);
  const pdf = links.find((link) => link.kind === "pdf");
  if (pdf) return { href: pdf.href, label: "Open PDF" };
  if (links[0]) return { href: links[0].href, label: "Open catalog record" };
  return null;
}
