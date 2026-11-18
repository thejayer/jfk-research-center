/**
 * Query tokens for the cheap OCR lookup table.
 *
 * `sql/33` indexes lowercase `[a-z0-9]{3,}` tokens. OCR lookup uses the
 * same tokenization and matches whole tokens in the clustered table.
 */

export const SEARCH_TOKEN_MIN_LENGTH = 3;
export const SEARCH_TOKEN_MAX_COUNT = 8;
export const SEARCH_TOKEN_PATTERN = new RegExp(
  `[a-z0-9]{${SEARCH_TOKEN_MIN_LENGTH},}`,
  "g",
);

/** Common function words. Keep archival terms such as memo and subject searchable. */
export const OCR_LOOKUP_STOPWORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "from", "that", "this", "was", "were", "are",
  "has", "had", "have", "not", "but", "his", "her", "its", "they", "them",
  "their", "you", "your", "who", "whom", "which", "what", "when", "where",
  "why", "how", "into", "onto", "upon", "about", "than", "then", "there",
  "these", "those", "been", "being", "will", "would", "could", "should",
  "can", "did", "does", "all", "any", "our", "out", "per", "via",
]);

function searchTokenMatches(query: string): string[] {
  return query.toLowerCase().match(SEARCH_TOKEN_PATTERN) ?? [];
}

export function extractSearchTokens(query: string): string[] {
  const matches = searchTokenMatches(query);
  return Array.from(new Set(matches)).slice(0, SEARCH_TOKEN_MAX_COUNT);
}

export function ocrLookupTokens(query: string): string[] {
  const matches = searchTokenMatches(query).filter(
    (token) => !OCR_LOOKUP_STOPWORDS.has(token),
  );
  return Array.from(new Set(matches)).slice(0, SEARCH_TOKEN_MAX_COUNT);
}

export function ocrTokenParams(tokens: readonly string[]): Record<string, string> {
  const params: Record<string, string> = {};
  tokens.forEach((token, index) => {
    params[`ocrTok${index}`] = token;
  });
  return params;
}
