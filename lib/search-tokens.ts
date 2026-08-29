/**
 * Query tokens for the cheap OCR lookup table.
 *
 * `sql/33` extracts `[a-z0-9]{3,}` from lowercase OCR text. Search must
 * tokenize the same way so `q=oswald` hits the `oswald` cluster instead of
 * scanning `jfk_text_chunks.chunk_text`.
 */

export const SEARCH_TOKEN_MIN_LENGTH = 3;
export const SEARCH_TOKEN_MAX_COUNT = 8;
export const SEARCH_TOKEN_PATTERN = /[a-z0-9]{3,}/g;

export function extractSearchTokens(query: string): string[] {
  const matches = query.toLowerCase().match(SEARCH_TOKEN_PATTERN) ?? [];
  return Array.from(new Set(matches)).slice(0, SEARCH_TOKEN_MAX_COUNT);
}

/** Exclusive end of a clustered prefix range for `token >= start AND token < end`. */
export function tokenPrefixEnd(token: string): string {
  if (!token) return "";
  const last = token.charCodeAt(token.length - 1);
  return token.slice(0, -1) + String.fromCharCode(last + 1);
}

export function ocrTokenRangeParams(
  tokens: readonly string[],
): Record<string, string> {
  const params: Record<string, string> = {};
  tokens.forEach((token, index) => {
    params[`ocrTok${index}`] = token;
    params[`ocrTok${index}End`] = tokenPrefixEnd(token);
  });
  return params;
}
