/**
 * Capture public live-site screenshots for README.md.
 * Never point this at /admin or any authenticated surface.
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs", "screenshots");
const ORIGIN = "https://researchjfk.ai";
const VIEWPORT = { width: 1440, height: 960 };
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

const SHOTS = [
  {
    file: "home.png",
    url: `${ORIGIN}/`,
    waitFor: "h1",
  },
  {
    file: "search-oswald.png",
    url: `${ORIGIN}/search?q=oswald`,
    waitFor: "text=Results for",
  },
  {
    file: "document.png",
    url: `${ORIGIN}/document/104-10301-10004`,
    waitFor: "h1",
  },
  {
    file: "topic.png",
    url: `${ORIGIN}/topic/warren-commission`,
    waitFor: "h1",
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
    colorScheme: "light",
    locale: "en-US",
  });

  try {
    for (const shot of SHOTS) {
      if (new URL(shot.url).pathname.startsWith("/admin")) {
        throw new Error(`refusing to capture admin URL: ${shot.url}`);
      }

      const page = await context.newPage();
      page.setDefaultTimeout(45_000);
      const response = await page.goto(shot.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const status = response?.status() ?? 0;
      if (status >= 400) {
        throw new Error(`${shot.url} returned HTTP ${status}`);
      }
      await page.waitForSelector(shot.waitFor, { timeout: 45_000 });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const dest = join(OUT_DIR, shot.file);
      await page.screenshot({ path: dest, type: "png" });
      await page.close();
      console.log(`wrote ${dest}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
