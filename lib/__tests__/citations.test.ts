import { describe, it, expect } from "vitest";
import { formatCitation } from "../citations";

const baseDoc = {
  title: "Memorandum on subject Oswald.",
  naid: "1234567",
  agency: "FBI",
  recordGroup: "RG 65",
  startDate: "1963-12-15",
  sourceUrl: "https://catalog.archives.gov/id/1234567",
};

describe("formatCitation", () => {
  it("renders Bluebook/Chicago/APA without a chunk anchor", () => {
    const out = formatCitation(baseDoc);
    expect(out.bluebook).toContain("NAID 1234567");
    expect(out.bluebook).not.toContain("chunk");
    expect(out.bluebook).not.toContain("¶");
    expect(out.chicago).toContain("NAID 1234567");
    expect(out.chicago).not.toContain("chunk");
    expect(out.apa).not.toContain("chunk");
  });

  it("includes chunk reference + deep link when chunkOrder + siteUrl set", () => {
    const out = formatCitation({
      ...baseDoc,
      chunkOrder: 7,
      siteUrl: "https://example.com/document/1234567",
    });
    expect(out.bluebook).toContain("at ¶ 7");
    expect(out.bluebook).toContain(
      "https://example.com/document/1234567#chunk-7",
    );
    expect(out.chicago).toContain("chunk 7");
    expect(out.chicago).toContain("#chunk-7");
    expect(out.apa).toContain("chunk 7");
    expect(out.apa).toContain("#chunk-7");
  });

  it("falls back to archives URL when chunkOrder is set but no siteUrl", () => {
    const out = formatCitation({ ...baseDoc, chunkOrder: 3 });
    expect(out.bluebook).toContain("at ¶ 3");
    expect(out.bluebook).toContain("catalog.archives.gov");
    expect(out.bluebook).not.toContain("#chunk-3");
  });

  it("treats chunkOrder of 0 or negative as absent", () => {
    const out = formatCitation({
      ...baseDoc,
      chunkOrder: 0,
      siteUrl: "https://example.com/document/1234567",
    });
    expect(out.bluebook).not.toContain("¶ 0");
    expect(out.bluebook).not.toContain("#chunk-");
  });

  it("strips trailing slash from siteUrl before appending anchor", () => {
    const out = formatCitation({
      ...baseDoc,
      chunkOrder: 5,
      siteUrl: "https://example.com/document/1234567/",
    });
    expect(out.bluebook).toContain(
      "https://example.com/document/1234567#chunk-5",
    );
    expect(out.bluebook).not.toContain("//#chunk-");
  });
});
