import { describe, expect, it } from "vitest";
import {
  isTitleLikeQuery,
  normalizeTitleQuery,
  searchRoute,
} from "../search-title-query";

describe("isTitleLikeQuery", () => {
  it.each([
    "MEMORANDUM: SUBJECT OSWALD",
    "MEMO: a subject",
    "CABLE: MEXICO CITY",
    "AIRGRAM: OSWALD",
    "TELETYPE: DALLAS",
    "  FBI   REPORT:   interview notes  ",
    "ROUTING SLIP: Review",
    "MEMORANDUM : SUBJECT OSWALD",
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
    // Lowercase or mixed-case labels stay on the keyword path.
    "memo: oswald",
    "report: oswald",
    "Routing Slip: Review",
    "AIRgram: OSWALD",
    "who was oswald: a profile",
    // Short acronyms and non-document-type phrases, even in uppercase.
    "CIA: oswald",
    "FBI: ruby",
    "FYI: x",
    "NOTE: x",
    "AB: a subject",
    "WHO WAS OSWALD: a profile",
    "BOOK V: THE INVESTIGATION",
    // Uppercase words that aren't known document types.
    "SECRET: oswald",
    "ABOUT: oswald",
    "SUBJECT: OSWALD",
    "CONFIDENTIAL: OSWALD",
    "WHAT DID THE FBI REPORT SAY: a profile",
  ])("keeps %j on the keyword path", (query) => {
    expect(isTitleLikeQuery(query)).toBe(false);
  });
});

describe("searchRoute", () => {
  it("routes title-shaped document queries to the title path", () => {
    expect(searchRoute({ query: " AIRGRAM: OSWALD ", mode: "document" })).toBe("title");
  });

  it.each([
    { query: "AIRgram: OSWALD", mode: "document" },
    { query: "AIRGRAM: OSWALD", mode: "mention" },
    { query: "AIRGRAM: OSWALD", mode: "semantic" },
    { query: "104-10338-10005", mode: "document" },
    { query: "   ", mode: "document" },
  ])("keeps $mode $query on the default path", (input) => {
    expect(searchRoute(input)).toBe("default");
  });
});

it("normalizes the full title for matching", () => {
  expect(normalizeTitleQuery("  FBI\tREPORT: \n  MEXICO  CITY  ")).toBe(
    "fbi report: mexico city",
  );
  expect(normalizeTitleQuery("MEMORANDUM : SUBJECT OSWALD")).toBe(
    "memorandum: subject oswald",
  );
  expect(normalizeTitleQuery("MEMO\t:SUBJECT")).toBe("memo:subject");
});
