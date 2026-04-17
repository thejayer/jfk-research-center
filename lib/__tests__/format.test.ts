import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateRange,
  formatYearRange,
  formatNumber,
  truncate,
  highlightHTML,
} from "../format";

describe("formatDate", () => {
  it("returns null for empty inputs", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate("")).toBeNull();
  });

  it("formats an ISO date", () => {
    expect(formatDate("1963-11-22")).toBe("November 22, 1963");
  });

  it("returns the raw string when the date is unparseable", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("formatDateRange", () => {
  it("renders a single date when start and end collapse to the same day", () => {
    expect(formatDateRange("1963-11-22", "1963-11-22")).toBe("November 22, 1963");
  });

  it("renders both when distinct", () => {
    expect(formatDateRange("1963-11-22", "1963-11-24")).toBe(
      "November 22, 1963 – November 24, 1963",
    );
  });

  it("falls back to whichever side is populated", () => {
    expect(formatDateRange("1963-11-22", null)).toBe("November 22, 1963");
    expect(formatDateRange(null, "1963-11-22")).toBe("November 22, 1963");
    expect(formatDateRange(null, null)).toBeNull();
  });
});

describe("formatYearRange", () => {
  it("renders start–end when years differ", () => {
    expect(formatYearRange("1961-01-01", "1963-12-31")).toBe("1961–1963");
  });

  it("collapses to a single year when they match", () => {
    expect(formatYearRange("1963-01-01", "1963-12-31")).toBe("1963");
  });

  it("returns null when neither side is set", () => {
    expect(formatYearRange(null, null)).toBeNull();
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(112541)).toBe("112,541");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("truncate", () => {
  it("leaves short strings untouched", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("trims at a word boundary and appends an ellipsis", () => {
    const result = truncate("the quick brown fox jumps", 12);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(13);
    expect(result).not.toContain("qui…");
  });

  it("hard-cuts if there's no space to fall back to", () => {
    expect(truncate("abcdefghij", 5).endsWith("…")).toBe(true);
  });
});

describe("highlightHTML", () => {
  it("wraps matched terms in <mark>", () => {
    expect(highlightHTML("hello world", ["world"])).toBe("hello <mark>world</mark>");
  });

  it("is case-insensitive", () => {
    expect(highlightHTML("Hello WORLD", ["world"])).toBe("Hello <mark>WORLD</mark>");
  });

  it("escapes HTML in the input", () => {
    expect(highlightHTML("<script>alert(1)</script>", ["alert"])).toContain("&lt;script&gt;");
    expect(highlightHTML("<script>alert(1)</script>", ["alert"])).toContain(
      "<mark>alert</mark>",
    );
  });

  it("ignores terms shorter than 2 chars", () => {
    expect(highlightHTML("a big cat", ["a", "big"])).toBe("a <mark>big</mark> cat");
  });

  it("returns escaped text when no useful terms are given", () => {
    expect(highlightHTML("<b>bold</b>", [])).toBe("&lt;b&gt;bold&lt;/b&gt;");
    expect(highlightHTML("hello", ["x"])).toBe("hello");
  });

  it("escapes regex metacharacters in the search terms", () => {
    // `.*` would otherwise match anything; verify it's treated as literal
    expect(highlightHTML("foo .* bar", [".*"])).toBe("foo <mark>.*</mark> bar");
  });
});
