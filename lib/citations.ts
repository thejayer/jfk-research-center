/**
 * Citation formatter for archival records. Generates Bluebook, Chicago, and
 * APA formats from document metadata. Used by the Cite button on document
 * pages.
 *
 * Citations reference the National Archives Catalog by NAID. For documents
 * whose canonical citation is tracked in `citation_registry` (the top-level
 * sources like the Warren Commission Report), prefer a hand-curated row
 * over the generated form — this formatter is the fallback for the long
 * tail of individual records.
 */

export type CitationFormats = {
  bluebook: string;
  chicago: string;
  apa: string;
};

export type CitationInput = {
  title: string;
  naid: string;
  agency?: string | null;
  recordGroup?: string | null;
  collectionName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sourceUrl?: string | null;
  /**
   * 1-based per-document OCR chunk ordinal. When set, the citation
   * deep-links to that chunk via #chunk-N and references the passage
   * as "at ¶ N" (Bluebook), "chunk N" (Chicago), "chunk N" (APA).
   */
  chunkOrder?: number | null;
  /** Public-facing site URL used when chunkOrder anchors a deep link. */
  siteUrl?: string | null;
};

export function formatCitation(doc: CitationInput): CitationFormats {
  const year =
    yearFrom(doc.startDate) ?? yearFrom(doc.endDate) ?? "n.d.";
  const author =
    doc.agency ?? doc.recordGroup ?? "U.S. National Archives";
  const collection =
    doc.collectionName ??
    "John F. Kennedy Assassination Records Collection";
  const archivesUrl =
    doc.sourceUrl ??
    `https://catalog.archives.gov/id/${encodeURIComponent(doc.naid)}`;
  const rgSuffix = doc.recordGroup ? `, ${doc.recordGroup}` : "";
  const title = stripTrailingPeriod(doc.title);

  const hasChunk = doc.chunkOrder != null && doc.chunkOrder > 0;
  const chunkAnchor = hasChunk ? `#chunk-${doc.chunkOrder}` : "";
  const deepUrl = hasChunk && doc.siteUrl
    ? `${stripTrailingSlash(doc.siteUrl)}${chunkAnchor}`
    : null;
  const blueChunk = hasChunk ? `, at ¶ ${doc.chunkOrder}` : "";
  const chicagoChunk = hasChunk ? `, chunk ${doc.chunkOrder}` : "";
  const apaChunk = hasChunk ? `, chunk ${doc.chunkOrder}` : "";
  const blueUrl = deepUrl ?? archivesUrl;
  const chicagoUrl = deepUrl ?? archivesUrl;
  const apaUrl = deepUrl ?? archivesUrl;

  const bluebook =
    `${title}, NAID ${doc.naid} (${year})${rgSuffix}${blueChunk}, ` +
    `${collection}, U.S. National Archives, ${blueUrl}.`;

  const chicago =
    `${author}. ${year}. "${title}." NAID ${doc.naid}${chicagoChunk}. ` +
    `${collection}, U.S. National Archives. ${chicagoUrl}.`;

  const apa =
    `${author}. (${year}). ${title} [NAID ${doc.naid}${apaChunk}]. ` +
    `${collection}. U.S. National Archives. ${apaUrl}`;

  return { bluebook, chicago, apa };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function yearFrom(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? m[1]! : null;
}

function stripTrailingPeriod(s: string): string {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
