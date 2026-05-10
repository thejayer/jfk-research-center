export function normalizeSourceUrl(url: string | null | undefined): string | null {
  if (!url) return null;

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
