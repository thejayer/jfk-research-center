// WCAG and responsive regression audit.
// Run locally against deterministic mock data:
//   npm run audit:a11y
// Run against an existing deployment:
//   npm run audit:a11y -- https://researchjfk.ai

import { once } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import axeModule from "@axe-core/playwright";

const AxeBuilder = axeModule.default ?? axeModule.AxeBuilder ?? axeModule;
const REPORT_PATH = "axe-report.json";
const ARTIFACT_DIR = "axe-artifacts";
const LOCAL_PORT = Number(process.env.AXE_AUDIT_PORT || 3100);
const requestedBase = process.argv[2]?.trim();
const baseUrl = (requestedBase || `http://127.0.0.1:${LOCAL_PORT}`).replace(/\/$/, "");
const mode = requestedBase ? "external" : "local-mock";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const ROUTES = [
  { name: "home", path: "/", trayFocus: true },
  { name: "empty-search", path: "/search" },
  {
    name: "queried-search",
    path: "/search?q=Oswald",
    queriedResults: true,
  },
  {
    name: "document",
    path: "/document/wc-report-1964",
  },
  {
    name: "mention-search",
    path: "/search?q=Oswald&mode=mention",
    viewports: ["desktop"],
  },
  { name: "timeline", path: "/timeline", viewports: ["desktop"] },
  { name: "entity", path: "/entity/oswald", viewports: ["desktop"] },
  { name: "topic", path: "/topic/cia", viewports: ["desktop"] },
  {
    name: "open-questions",
    path: "/open-questions",
    viewports: ["desktop"],
  },
  {
    name: "open-question",
    path: "/open-questions/cia",
    viewports: ["desktop"],
  },
  { name: "graph", path: "/graph", viewports: ["desktop"] },
  { name: "dealey-plaza", path: "/dealey-plaza", viewports: ["desktop"] },
  { name: "evidence", path: "/evidence", viewports: ["desktop"] },
  { name: "corrections", path: "/corrections", viewports: ["desktop"] },
  {
    name: "methodology",
    path: "/about/methodology",
    viewports: ["desktop"],
  },
  { name: "bibliography", path: "/bibliography", viewports: ["desktop"] },
];

const report = {
  generatedAt: new Date().toISOString(),
  mode,
  baseUrl,
  viewports: VIEWPORTS,
  scenarios: [],
};

rmSync(ARTIFACT_DIR, { recursive: true, force: true });

let localServer;
let browser;
let failureCount = 0;

try {
  if (!requestedBase) {
    localServer = startMockServer();
    await waitForServer(baseUrl, localServer);
  }

  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new Error(
      `${messageOf(error)} Install Chromium with "npx playwright-core install chromium".`,
    );
  }

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });

    try {
      for (const route of ROUTES) {
        if (route.viewports && !route.viewports.includes(viewport.name)) {
          continue;
        }

        const page = await context.newPage();
        const scenario = {
          name: `${viewport.name}:${route.name}`,
          route: route.path,
          url: `${baseUrl}${route.path}`,
          viewport,
          assertions: [],
          totalViolations: 0,
          seriousOrCritical: 0,
          violations: [],
        };

        try {
          await page.goto(scenario.url, {
            waitUntil: "networkidle",
            timeout: 45_000,
          });
          await page
            .locator("main")
            .first()
            .waitFor({ state: "visible", timeout: 15_000 });

          const axeResults = await new AxeBuilder({ page })
            .withTags([
              "wcag2a",
              "wcag2aa",
              "wcag21aa",
              "wcag22aa",
              "best-practice",
            ])
            .analyze();
          const violations = axeResults.violations.filter(
            (violation) =>
              violation.impact === "serious" || violation.impact === "critical",
          );

          scenario.totalViolations = axeResults.violations.length;
          scenario.seriousOrCritical = violations.length;
          scenario.violations = violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          }));

          scenario.assertions.push(...(await responsiveAssertions(page)));

          if (route.queriedResults) {
            scenario.assertions.push(
              await queriedResultVisibilityAssertion(page, viewport),
            );
          }

          if (route.trayFocus) {
            scenario.assertions.push(...(await trayFocusAssertions(page)));
          }
        } catch (error) {
          scenario.error = messageOf(error);
        }

        const failedAssertions = scenario.assertions.filter(
          (assertion) => !assertion.passed,
        );
        const scenarioFailures =
          scenario.seriousOrCritical + failedAssertions.length + (scenario.error ? 1 : 0);

        if (scenarioFailures > 0) {
          failureCount += scenarioFailures;
          mkdirSync(ARTIFACT_DIR, { recursive: true });
          const screenshotName = scenario.name.replace(/[^a-z0-9_-]+/gi, "-");
          const screenshotPath = `${ARTIFACT_DIR}/${screenshotName}.png`;
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            scenario.screenshot = screenshotPath;
          } catch (error) {
            scenario.screenshotError = messageOf(error);
          }
        }

        report.scenarios.push(scenario);
        printScenario(scenario);
        await page.close();
      }
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failureCount += 1;
  report.fatalError = messageOf(error);
  console.error(`Audit setup failed: ${report.fatalError}`);
} finally {
  if (browser) await browser.close();
  if (localServer) await stopServer(localServer);

  report.failureCount = failureCount;
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nFull report: ./${REPORT_PATH}`);
}

if (failureCount > 0) {
  console.error(`Audit failed with ${failureCount} regression(s).`);
  process.exit(1);
}

console.log(
  `Audit passed: ${report.scenarios.length} route/viewport scenarios are clean.`,
);

function startMockServer() {
  const nextBin = fileURLToPath(
    new URL("../node_modules/next/dist/bin/next", import.meta.url),
  );
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(LOCAL_PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        JFK_DATA_SOURCE: "mock",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Mock server exited with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for the mock server at ${url}.`);
}

async function stopServer(child) {
  if (child.exitCode != null) return;

  child.kill();
  await Promise.race([once(child, "exit"), delay(5_000)]);

  if (child.exitCode == null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
}

async function responsiveAssertions(page) {
  const layout = await page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        label:
          element.getAttribute("aria-label") ||
          element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
          element.tagName.toLowerCase(),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    };
    const overlaps = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

    const viewportWidth = document.documentElement.clientWidth;
    const chromeRects = Array.from(
      document.querySelectorAll("header a, header button"),
    )
      .filter(visible)
      .map(rectOf);
    const outOfBounds = chromeRects.filter(
      (rect) => rect.left < -1 || rect.right > viewportWidth + 1,
    );
    const collisions = [];

    for (let index = 0; index < chromeRects.length; index += 1) {
      for (let other = index + 1; other < chromeRects.length; other += 1) {
        if (overlaps(chromeRects[index], chromeRects[other])) {
          collisions.push([
            chromeRects[index].label,
            chromeRects[other].label,
          ]);
        }
      }
    }

    const mastheadLabel = document.querySelector(".masthead-collection-label");
    const mastheadStatus = mastheadLabel?.nextElementSibling;
    const mastheadRects =
      mastheadLabel &&
      mastheadStatus &&
      visible(mastheadLabel) &&
      visible(mastheadStatus)
        ? [rectOf(mastheadLabel), rectOf(mastheadStatus)]
        : [];
    const mastheadCollision =
      mastheadRects.length === 2 && overlaps(mastheadRects[0], mastheadRects[1]);

    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      outOfBounds,
      collisions,
      mastheadRects,
      mastheadCollision,
    };
  });

  return [
    {
      name: "no-horizontal-overflow",
      passed: layout.scrollWidth <= layout.viewportWidth + 1,
      details: {
        viewportWidth: layout.viewportWidth,
        scrollWidth: layout.scrollWidth,
      },
    },
    {
      name: "site-chrome-within-viewport",
      passed: layout.outOfBounds.length === 0,
      details: { outOfBounds: layout.outOfBounds },
    },
    {
      name: "site-chrome-controls-do-not-collide",
      passed: layout.collisions.length === 0,
      details: { collisions: layout.collisions },
    },
    {
      name: "masthead-label-and-status-do-not-collide",
      passed: layout.mastheadRects.length === 2 && !layout.mastheadCollision,
      details: {
        rects: layout.mastheadRects,
        collision: layout.mastheadCollision,
      },
    },
  ];
}

async function queriedResultVisibilityAssertion(page, viewport) {
  const firstResult = page.locator('[data-search-result="true"]').first();

  try {
    await firstResult.waitFor({ state: "visible", timeout: 15_000 });
    const box = await firstResult.boundingBox();
    return {
      name: "queried-search-first-result-in-initial-viewport",
      passed: Boolean(box && box.y < viewport.height && box.y + box.height > 0),
      details: {
        firstResultTop: box?.y ?? null,
        firstResultBottom: box ? box.y + box.height : null,
        viewportHeight: viewport.height,
      },
    };
  } catch (error) {
    return {
      name: "queried-search-first-result-in-initial-viewport",
      passed: false,
      details: { error: messageOf(error), viewportHeight: viewport.height },
    };
  }
}

async function trayFocusAssertions(page) {
  const trigger = page.getByRole("button", { name: /^Research tray,/ });
  const close = page.getByRole("button", { name: "Close research tray" });
  const dialog = page.getByRole("dialog", { name: "Research tray" });
  const assertions = [];

  await trigger.focus();
  await trigger.press("Enter");
  await dialog.waitFor({ state: "visible", timeout: 5_000 });

  assertions.push({
    name: "tray-focus-moves-to-close-control",
    passed: await close.evaluate((element) => document.activeElement === element),
  });

  await page.keyboard.press("Shift+Tab");
  const wrappedToLast = await page.evaluate(
    () => document.activeElement?.textContent?.trim() === "Start with search",
  );
  assertions.push({
    name: "tray-shift-tab-wraps-to-last-control",
    passed: wrappedToLast,
  });

  await page.keyboard.press("Tab");
  assertions.push({
    name: "tray-tab-wraps-to-first-control",
    passed: await close.evaluate((element) => document.activeElement === element),
  });

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5_000 });
  assertions.push({
    name: "tray-escape-restores-trigger-focus",
    passed: await trigger.evaluate((element) => document.activeElement === element),
  });

  return assertions;
}

function printScenario(scenario) {
  const failedAssertions = scenario.assertions.filter(
    (assertion) => !assertion.passed,
  );
  const status =
    scenario.error || scenario.seriousOrCritical > 0 || failedAssertions.length > 0
      ? "FAIL"
      : "PASS";

  console.log(
    `${status.padEnd(4)} ${scenario.name.padEnd(24)} axe=${scenario.seriousOrCritical} assertions=${failedAssertions.length}`,
  );

  if (scenario.error) console.error(`     error: ${scenario.error}`);
  for (const violation of scenario.violations) {
    console.error(
      `     axe: ${violation.id} (${violation.impact}) - ${violation.help}`,
    );
  }
  for (const assertion of failedAssertions) {
    console.error(
      `     assertion: ${assertion.name} ${JSON.stringify(assertion.details ?? {})}`,
    );
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
