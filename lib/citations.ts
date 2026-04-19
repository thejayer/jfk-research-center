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
};

export function formatCitation(doc: CitationInput): CitationFormats {
  const year =
    yearFrom(doc.startDate) ?? yearFrom(doc.endDate) ?? "n.d.";
  const author =
    doc.agency ?? doc.recordGroup ?? "U.S. National Archives";
  const collection =
    doc.collectionName ??
    "John F. Kennedy Assassination Records Collection";
  const url =
    doc.sourceUrl ??
    `https://catalog.archives.gov/id/${encodeURIComponent(doc.naid)}`;
  const rgSuffix = doc.recordGroup ? `, ${doc.recordGroup}` : "";
  const title = stripTrailingPeriod(doc.title);

  const bluebook =
    `${title}, NAID ${doc.naid} (${year})${rgSuffix}, ` +
    `${collection}, U.S. National Archives, ${url}.`;

  const chicago =
    `${author}. ${year}. "${title}." NAID ${doc.naid}. ` +
    `${collection}, U.S. National Archives. ${url}.`;

  const apa =
    `${author}. (${year}). ${title} [NAID ${doc.naid}]. ` +
    `${collection}. U.S. National Archives. ${url}`;

  return { bluebook, chicago, apa };
}

function yearFrom(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? m[1]! : null;
}

function stripTrailingPeriod(s: string): string {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
