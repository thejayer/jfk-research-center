// One-shot WCAG 2.2 AA audit using axe-core against the live site.
// Run: node scripts/axe-audit.mjs [base-url]
// Default base URL is the Cloud Run production host.

import { chromium } from "playwright-core";
import axeModule from "@axe-core/playwright";
const AxeBuilder = axeModule.default ?? axeModule.AxeBuilder ?? axeModule;

const BASE =
  process.argv[2] ||
  "https://jfk-research-center-690906762945.us-central1.run.app";

// Target the primary user-visible surfaces. Query strings force the BQ
// path to exercise (empty vs non-empty search) so loading states + result
// layouts both get audited.
const PATHS = [
  "/",
  "/search",
  "/search?q=Oswald",
  "/search?q=Oswald&mode=mention",
  "/timeline",
  "/entity/oswald",
  "/topic/cia",
  "/open-questions",
  "/open-questions/cia",
  "/graph",
  "/dealey-plaza",
  "/evidence",
  "/corrections",
  "/about/methodology",
  "/bibliography",
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

const summary = [];

for (const path of PATHS) {
  const url = BASE + path;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch (err) {
    console.error(`${path} → navigation failed:`, err.message);
    summary.push({ path, error: err.message });
    continue;
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const violations = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  summary.push({
    path,
    totalViolations: results.violations.length,
    seriousOrCritical: violations.length,
    violations: violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      nodes: v.nodes.length,
      example: v.nodes[0]?.target,
      summary: v.nodes[0]?.failureSummary,
    })),
  });
  console.log(
    `${path.padEnd(40)} total=${results.violations.length}  s/c=${violations.length}`,
  );
}

await browser.close();

console.log("\n==== SERIOUS/CRITICAL VIOLATIONS ACROSS ALL PAGES ====\n");
const byRule = new Map();
for (const p of summary) {
  if (!p.violations) continue;
  for (const v of p.violations) {
    const k = `${v.id} (${v.impact})`;
    if (!byRule.has(k))
      byRule.set(k, { help: v.help, pages: [], nodes: 0, example: v.example });
    const entry = byRule.get(k);
    entry.pages.push(p.path);
    entry.nodes += v.nodes;
  }
}
for (const [rule, { help, pages, nodes, example }] of byRule.entries()) {
  console.log(`• ${rule}`);
  console.log(`    help: ${help}`);
  console.log(`    pages (${pages.length}): ${pages.join(", ")}`);
  console.log(`    total nodes: ${nodes}`);
  console.log(`    example: ${JSON.stringify(example)}`);
  console.log();
}

console.log(JSON.stringify(summary, null, 2));
