import { describe, expect, it } from "vitest";
import {
  extractSearchTokens,
  ocrLookupTokens,
  ocrTokenParams,
} from "../search-tokens";

describe("search tokens", () => {
  it("extracts the same [a-z0-9]{3,} tokens sql/33 indexes", () => {
    expect(extractSearchTokens("Oswald")).toEqual(["oswald"]);
    expect(extractSearchTokens("  MEXICO CITY ")).toEqual(["mexico", "city"]);
    expect(extractSearchTokens("CIA")).toEqual(["cia"]);
    expect(extractSearchTokens("to")).toEqual([]);
  });

  it("dedupes and caps token count", () => {
    expect(extractSearchTokens("oswald oswald LEE")).toEqual(["oswald", "lee"]);
    const many = extractSearchTokens(
      "one two three four five six seven eight nine ten",
    );
    expect(many).toHaveLength(8);
  });

  it("builds only exact OCR token parameters", () => {
    expect(ocrTokenParams([])).toEqual({});
    expect(ocrTokenParams(["oswald", "1963"])).toEqual({
      ocrTok0: "oswald",
      ocrTok1: "1963",
    });
  });
});

describe("OCR lookup tokens", () => {
  it("drops stopwords and short tokens while keeping acronyms, numbers, and archival terms", () => {
    expect(ocrLookupTokens("THE CIA and Oswald OSWALD re 12 1963 201 memo subject"))
      .toEqual(["cia", "oswald", "1963", "201", "memo", "subject"]);
  });

  it("caps the unique tokens after filtering", () => {
    expect(ocrLookupTokens(
      "the and for with from that this was Oswald OSWALD Lee CIA FBI Dallas Mexico City 1963 201",
    )).toEqual(["oswald", "lee", "cia", "fbi", "dallas", "mexico", "city", "1963"]);
  });

  it("returns no tokens for an all-stopword query", () => {
    expect(ocrLookupTokens("The AND with")).toEqual([]);
  });
});
