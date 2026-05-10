/**
 * normalizeSourceUrl cleans NARA release PDF URLs before they reach document UI.
 *
 * It accepts a source URL string, null, or undefined and returns either the
 * normalized string or null for nullish input. It only rewrites URLs whose
 * hostname is "www.archives.gov" and whose path contains a "releases" segment.
 * After that segment, only adjacent duplicate 4-digit year segments are
 * collapsed; all other path segments, query strings, and fragments are
 * preserved. Parse errors return the original input unchanged.
 *
 * Example:
 * https://www.archives.gov/files/research/jfk/releases/2023/2023/doc.pdf
 * becomes
 * https://www.archives.gov/files/research/jfk/releases/2023/doc.pdf
 */
export function normalizeSourceUrl(url: string | null | undefined): string | null {
  if (url == null) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.archives.gov") return url;

    const parts = parsed.pathname.split("/");
    const releasesIndex = parts.findIndex((part) => part === "releases");
    if (releasesIndex === -1) return url;

    const normalizedParts = [...parts];
    let i = releasesIndex + 1;
    while (i < normalizedParts.length - 1) {
      if (
        /^\d{4}$/.test(normalizedParts[i]) &&
        normalizedParts[i] === normalizedParts[i + 1]
      ) {
        normalizedParts.splice(i + 1, 1);
        continue;
      }
      i += 1;
    }

    parsed.pathname = normalizedParts.join("/");
    return parsed.toString();
  } catch {
    return url;
  }
}
