import { describe, expect, it } from "vitest";
import { normalizeSourceUrl } from "../source-urls";

describe("normalizeSourceUrl", () => {
  it("removes duplicate Archives JFK release year segments", () => {
    expect(
      normalizeSourceUrl(
        "https://www.archives.gov/files/research/jfk/releases/2023/2023/104-10338-10005.pdf",
      ),
    ).toBe(
      "https://www.archives.gov/files/research/jfk/releases/2023/104-10338-10005.pdf",
    );
  });

  it("leaves valid source URLs unchanged", () => {
    const url =
      "https://www.archives.gov/files/research/jfk/releases/2023/104-10338-10005.pdf";

    expect(normalizeSourceUrl(url)).toBe(url);
    expect(normalizeSourceUrl("https://catalog.archives.gov/id/193887")).toBe(
      "https://catalog.archives.gov/id/193887",
    );
  });

  it("preserves empty and malformed source values", () => {
    expect(normalizeSourceUrl(null)).toBeNull();
    expect(normalizeSourceUrl("not a url")).toBe("not a url");
  });
});
