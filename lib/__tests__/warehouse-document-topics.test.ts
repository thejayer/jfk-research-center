import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const warehouseSource = readFileSync(
  new URL("../warehouse.ts", import.meta.url),
  "utf8",
);

describe("document topic warehouse path", () => {
  it("does not EXISTS-scan jfk_mvp topic copies on document open", () => {
    const start = warehouseSource.indexOf("async function getThinTopicCountsCached");
    const end = warehouseSource.indexOf("function buildAliasRegex");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fetchTopics = warehouseSource.slice(start, end);

    expect(fetchTopics).toContain("buildDocumentTopicSlugsSql");
    expect(fetchTopics).toContain("buildDocumentTopicCountSql");
    expect(fetchTopics).toContain("sortTopicSlugsByDisplayOrder");
    expect(fetchTopics).toContain("TOPIC_DISPLAY_ORDER");
    expect(fetchTopics).toContain("document_topic_map unavailable");
    expect(fetchTopics).not.toMatch(/\bEXISTS\s*\(/);
    expect(fetchTopics).not.toMatch(/jfk_mvp/);
    expect(fetchTopics).not.toMatch(/mvpTable/);
    expect(fetchTopics).not.toMatch(/getTopicCountsCached/);
    expect(fetchTopics).not.toMatch(/topicCountsMap/);
  });
});
