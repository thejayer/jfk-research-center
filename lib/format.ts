const DATE_LOCALE = "en-US";

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(DATE_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s ?? e ?? null;
}

export function formatYearRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const s = start ? new Date(start).getFullYear() : null;
  const e = end ? new Date(end).getFullYear() : null;
  if (s && e && s !== e) return `${s}–${e}`;
  if (s) return String(s);
  if (e) return String(e);
  return null;
}

export function formatNumber(n: number): string {
  return n.toLocaleString(DATE_LOCALE);
}

export function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trim()}…`;
}

/**
 * Wrap matched terms in <mark> for dangerouslySetInnerHTML.
 * Only matches word-ish tokens and escapes other HTML.
 */
export function highlightHTML(text: string, terms: string[]): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return c;
      }
    });

  const cleaned = terms
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (cleaned.length === 0) return esc(text);

  const pattern = new RegExp(`(${cleaned.join("|")})`, "gi");
  const safe = esc(text);
  return safe.replace(pattern, "<mark>$1</mark>");
}
