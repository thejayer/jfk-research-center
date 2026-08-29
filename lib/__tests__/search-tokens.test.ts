import { describe, expect, it } from "vitest";
import {
  extractSearchTokens,
  ocrTokenRangeParams,
  tokenPrefixEnd,
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

  it("builds a clustered prefix range that includes plurals but not other stems", () => {
    expect(tokenPrefixEnd("oswald")).toBe("oswale");
    expect(ocrTokenRangeParams(["oswald"])).toEqual({
      ocrTok0: "oswald",
      ocrTok0End: "oswale",
    });
    expect("oswald" >= "oswald" && "oswald" < "oswale").toBe(true);
    expect("oswalds" >= "oswald" && "oswalds" < "oswale").toBe(true);
    expect("oswald2" >= "oswald" && "oswald2" < "oswale").toBe(true);
    expect("koswald" >= "oswald" && "koswald" < "oswale").toBe(false);
  });
});
