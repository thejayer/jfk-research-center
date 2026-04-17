/**
 * scripts/export_mock_data.ts
 *
 * Emits the current mock API responses as static JSON files under
 * `data/` so the fixtures in that folder are a readable snapshot of
 * the mock shape. Run with:
 *
 *   tsx scripts/export_mock_data.ts
 *
 * This script is a developer convenience; the app does NOT read
 * these files at runtime (see lib/api-client.ts).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

import {
  buildHomeResponse,
  buildEntityResponse,
  buildTopicResponse,
  buildDocumentResponse,
  buildSearchResponse,
  listEntities,
  listTopics,
  listDocuments,
} from "../lib/mock-data";

function writeJson(relPath: string, payload: unknown): void {
  const fullPath = join(process.cwd(), "data", relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`wrote data/${relPath}`);
}

function main(): void {
  writeJson("home.json", buildHomeResponse());

  for (const e of listEntities()) {
    const res = buildEntityResponse(e.slug);
    if (res) writeJson(`entities/${e.slug}.json`, res);
  }

  for (const t of listTopics()) {
    const res = buildTopicResponse(t.slug);
    if (res) writeJson(`topics/${t.slug}.json`, res);
  }

  for (const d of listDocuments()) {
    const res = buildDocumentResponse(d.id);
    if (res) writeJson(`documents/${d.id}.json`, res);
  }

  writeJson(
    "search/sample-results.json",
    buildSearchResponse({ query: "Oswald Mexico City", mode: "mention" }),
  );

  console.log("mock data export complete.");
}

main();
