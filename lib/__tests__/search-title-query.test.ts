import { describe, expect, it } from "vitest";
import { isTitleLikeQuery, normalizeTitleQuery } from "../search-title-query";

describe("isTitleLikeQuery", () => {
  it.each([
    "MEMORANDUM: SUBJECT OSWALD",
    "memo: a subject",
    "CABLE: MEXICO CITY",
    "AIRGRAM: OSWALD",
    "  FBI   REPORT:   interview notes  ",
    "Routing Slip: Review",
    "F.B.I./CIA: JOINT REPORT",
  ])("recognizes %j as a title query", (query) => {
    expect(isTitleLikeQuery(query)).toBe(true);
  });

  it.each([
    "oswald",
    "mexico city",
    "http://example.com",
    "HTTPS://example.com",
    "10:30",
    "104-10338-10005",
    "123456789",
    "MEMO:   ",
    "MEMO : a subject",
    "who was oswald: a profile",
    "AIRgram: OSWALD",
    "AB: a subject",
    "WHAT DID THE FBI REPORT SAY: a profile",
  ])("keeps %j on its existing search path", (query) => {
    expect(isTitleLikeQuery(query)).toBe(false);
  });
});

it("normalizes the full title for matching", () => {
  expect(normalizeTitleQuery("  FBI\tREPORT: \n  MEXICO  CITY  ")).toBe(
    "fbi report: mexico city",
  );
});
