import { describe, expect, it } from "vitest";
import {
  SEARCH_UNAVAILABLE_BODY,
  SEARCH_UNAVAILABLE_HOME_LABEL,
  SEARCH_UNAVAILABLE_RETRY_LABEL,
  SEARCH_UNAVAILABLE_TITLE,
} from "../search-unavailable-copy";

describe("search unavailable copy", () => {
  it("describes a warehouse failure without stack traces or alarmist language", () => {
    expect(SEARCH_UNAVAILABLE_TITLE).toMatch(/temporarily unavailable/i);
    expect(SEARCH_UNAVAILABLE_BODY).toMatch(/warehouse/i);
    expect(SEARCH_UNAVAILABLE_BODY).toMatch(/rest of the site remains readable/i);
    expect(SEARCH_UNAVAILABLE_RETRY_LABEL).toBe("Retry search");
    expect(SEARCH_UNAVAILABLE_HOME_LABEL).toBe("Return home");
    expect(SEARCH_UNAVAILABLE_BODY.toLowerCase()).not.toContain("stack");
    expect(SEARCH_UNAVAILABLE_BODY.toLowerCase()).not.toContain("exception");
    expect(SEARCH_UNAVAILABLE_BODY.toLowerCase()).not.toContain("conspiracy");
  });
});
