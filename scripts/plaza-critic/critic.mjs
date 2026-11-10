// Dealey Plaza render critic. Critic-owned: the builder must not edit this
// file or tolerances.json. Renders fixed views headlessly (SwiftShader WebGL),
// runs measured checks and writes a fix list (JSON + Markdown).
//
// Usage: node scripts/plaza-critic/critic.mjs [--base http://localhost:3000] [--out artifacts/plaza-critic]
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await fs.readFile(path.join(here, "tolerances.json"), "utf8"));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg("base", process.env.PLAZA_CRITIC_BASE || "http://localhost:3000");
const outDir = arg("out", process.env.PLAZA_CRITIC_OUT || "artifacts/plaza-critic");
await fs.mkdir(outDir, { recursive: true });
const route = `${base}/dealey-plaza/trajectory`;
const hook = cfg.hookContract.global;

const results = [];
const check = (view, id, pass, detail) => {
  results.push({ view, check: id, pass: Boolean(pass), detail });
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const fmt = (v) => (Array.isArray(v) ? `[${v.map((n) => Number(n).toFixed(2)).join(", ")}]` : String(v));
const pitch = (eye, at) => {
  const dy = at[1] - eye[1];
  return (Math.atan2(dy, distXZ(eye, at)) * 180) / Math.PI;
};
// Distance from a point to an axis-aligned box (0 if inside).
const boxDist = (p, o) =>
  Math.hypot(
    ...[0, 1, 2].map((k) => Math.max(o.min[k] - p[k], 0, p[k] - o.max[k])),
  );

const edgePath = process.env.EDGE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  ...(edgePath ? { executablePath: edgePath } : {}),
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: 1 });

const consoleErrors = [];
const attach = (page, label) => {
  page.on("pageerror", (e) => consoleErrors.push(`${label}: pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`${label}: console.error: ${m.text()}`);
  });
};

const readHook = (page) => page.evaluate((g) => {
  const h = window[g];
  return h ? JSON.parse(JSON.stringify(h)) : null;
}, hook);

let viewTimeout = 20000;
async function waitForView(page, view, timeout = viewTimeout) {
  try {
    await page.waitForFunction(
      ([g, v]) => window[g] && window[g].view === v && window[g].renders > 0,
      [hook, view],
      { timeout },
    );
    // Let the frame settle after the render that updated the hook.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return true;
  } catch {
    return false;
  }
}

// Decode a PNG in the browser and compute simple variance statistics.
const statsPage = await context.newPage();
async function pixelStats(png) {
  return statsPage.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0, sum = 0, sum2 = 0;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 16) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l; sum2 += l * l; n++;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const mean = sum / n;
    const top = Math.max(...buckets.values());
    return { width: c.width, height: c.height, lumaStdDev: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), distinctBuckets: buckets.size, topBucketFraction: top / n };
  }, png.toString("base64"));
}

const views = Object.keys(cfg.views);
const page = await context.newPage();
attach(page, "main");
let state = null;
const viewStates = {};

// --- Page / WebGL bootstrap -------------------------------------------------
try {
  await page.goto(`${route}?${cfg.hookContract.queryParam}`, { waitUntil: "networkidle" });
  await page.locator("canvas").first().waitFor({ timeout: 30000 });
  await page.locator("canvas").first().scrollIntoViewIfNeeded();
} catch (e) {
  check("page", "page-load", false, `could not load ${route}: ${e.message}`);
}
const webgl = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return { ok: false, reason: "no canvas" };
  const gl = c.getContext("webgl2") || c.getContext("webgl");
  return { ok: Boolean(gl) && !gl.isContextLost(), reason: gl ? "context ok" : "no webgl context" };
}).catch((e) => ({ ok: false, reason: e.message }));
check("page", "webgl-context", webgl.ok, webgl.reason);
const hooked = await waitForView(page, "overview");
check("page", "critic-hook-exposed", hooked, hooked ? `window.${hook} present` : `window.${hook} missing or never reported view "overview" (see hookContract)`);
state = hooked ? await readHook(page) : null;
if (!hooked) viewTimeout = 3000; // no hook: fail the remaining waits fast
const objects = state?.objects ?? {};
for (const name of cfg.requiredObjects)
  check("scene", `object:${name}`, Boolean(objects[name]), objects[name] ? `center ${fmt(objects[name].center)}` : "named object not found in scene");

// --- Object geometry checks -------------------------------------------------
const win = objects["tsbd-sniper-window"], winCfg = cfg.objects["tsbd-sniper-window"];
if (win) {
  const err = dist(win.center, winCfg.center);
  check("scene", "sniper-window-position", err <= winCfg.maxCenterError, `center ${fmt(win.center)} vs expected ${fmt(winCfg.center)}: ${err.toFixed(2)} ft (max ${winCfg.maxCenterError})`);
  const off = Math.abs(win.center[2] - winCfg.facadeZ);
  check("scene", "sniper-window-on-south-facade", off <= winCfg.maxFacadeOffset, `z offset from south facade ${off.toFixed(2)} ft (max ${winCfg.maxFacadeOffset})`);
  const size = [0, 1, 2].map((k) => win.max[k] - win.min[k]);
  const okSize = size.every((s, k) => s >= winCfg.minSize[k] && s <= winCfg.maxSize[k]);
  check("scene", "sniper-window-size", okSize, `size ${fmt(size)} within ${fmt(winCfg.minSize)}..${fmt(winCfg.maxSize)}`);
}
const ped = objects["zapruder-pedestal"], pedCfg = cfg.objects["zapruder-pedestal"];
if (ped) {
  const err = Math.hypot(ped.center[0] - pedCfg.centerXZ[0], ped.center[2] - pedCfg.centerXZ[1]);
  check("scene", "zapruder-pedestal-position", err <= pedCfg.maxCenterErrorXZ, `center XZ [${ped.center[0].toFixed(2)}, ${ped.center[2].toFixed(2)}] vs expected ${fmt(pedCfg.centerXZ)}: ${err.toFixed(2)} ft (max ${pedCfg.maxCenterErrorXZ})`);
  const h = ped.max[1] - ped.min[1];
  check("scene", "zapruder-pedestal-height", h >= pedCfg.minHeight && h <= pedCfg.maxHeight, `height ${h.toFixed(2)} ft (range ${pedCfg.minHeight}..${pedCfg.maxHeight})`);
  const fx = ped.max[0] - ped.min[0], fz = ped.max[2] - ped.min[2];
  const okF = [fx, fz].every((s) => s >= pedCfg.minFootprint && s <= pedCfg.maxFootprint);
  check("scene", "zapruder-pedestal-footprint", okF, `footprint ${fx.toFixed(2)} x ${fz.toFixed(2)} ft (range ${pedCfg.minFootprint}..${pedCfg.maxFootprint})`);
}
const fence = objects["stockade-fence"];
if (fence) {
  const len = fence.max[0] - fence.min[0];
  check("scene", "stockade-fence-extent", len >= cfg.objects["stockade-fence"].minLengthX, `x extent ${len.toFixed(1)} ft (min ${cfg.objects["stockade-fence"].minLengthX})`);
}

// --- Per-view renders via the select ---------------------------------------
const select = page.getByLabel("Reconstruction viewpoint");
const options = await select.locator("option").evaluateAll((os) => os.map((o) => o.value)).catch(() => []);
for (const view of views) {
  const v = cfg.views[view];
  const present = options.includes(view);
  check(view, "select-option", present, present ? "option present" : `no <option value="${view}"> in viewpoint select`);
  if (!present) continue;
  await select.selectOption(view);
  const ok = await waitForView(page, view);
  check(view, "hook-reports-view", ok, ok ? "hook view updated" : "hook never reported this view");
  const urlView = new URL(page.url()).searchParams.get("view");
  check(view, "url-in-sync", urlView === view, `?view=${urlView}`);
  const s = await readHook(page);
  viewStates[view] = s;
  const canvas = page.locator("canvas").first();
  const shotPath = path.join(outDir, v.screenshot);
  const png = await canvas.screenshot({ path: shotPath });
  const px = await pixelStats(png);
  const p = cfg.pixel;
  check(view, "canvas-non-blank", px.lumaStdDev >= p.minLumaStdDev && px.distinctBuckets >= p.minDistinctColorBuckets && px.topBucketFraction <= p.maxSingleBucketFraction,
    `luma std ${px.lumaStdDev.toFixed(1)} (min ${p.minLumaStdDev}), colour buckets ${px.distinctBuckets} (min ${p.minDistinctColorBuckets}), top bucket ${(px.topBucketFraction * 100).toFixed(1)}% (max ${p.maxSingleBucketFraction * 100}%)`);
  if (!s) continue;
  const objs = s.objects ?? {};
  if (v.eye) {
    if (v.eyeTolerance !== undefined) {
      const e = dist(s.eye, v.eye);
      check(view, "camera-eye", e <= v.eyeTolerance, `eye ${fmt(s.eye)} vs ${fmt(v.eye)}: ${e.toFixed(2)} ft (max ${v.eyeTolerance})`);
    } else {
      const exz = distXZ(s.eye, v.eye), ey = Math.abs(s.eye[1] - v.eye[1]);
      check(view, "camera-eye", exz <= v.eyeToleranceXZ && ey <= v.eyeToleranceY, `eye ${fmt(s.eye)} vs ${fmt(v.eye)}: XZ ${exz.toFixed(2)} ft (max ${v.eyeToleranceXZ}), Y ${ey.toFixed(2)} ft (max ${v.eyeToleranceY})`);
    }
  }
  if (v.target) {
    const e = dist(s.target, v.target);
    check(view, "camera-target", e <= v.targetTolerance, `target ${fmt(s.target)} vs ${fmt(v.target)}: ${e.toFixed(2)} ft (max ${v.targetTolerance})`);
  }
  if (v.maxPitchDegrees !== undefined) {
    const pd = pitch(s.eye, s.target);
    check(view, "camera-looks-down", pd <= v.maxPitchDegrees, `pitch ${pd.toFixed(1)} deg (max ${v.maxPitchDegrees})`);
  }
  if (v.eyeNearObject) {
    const o = objs[v.eyeNearObject.object];
    const d = o ? boxDist(s.eye, o) : Infinity;
    check(view, `eye-near:${v.eyeNearObject.object}`, d <= v.eyeNearObject.maxDistance, o ? `eye ${d.toFixed(2)} ft from ${v.eyeNearObject.object} bounds (max ${v.eyeNearObject.maxDistance})` : "object missing");
  }
  if (v.eyeOutsideFacadeZ) {
    const z = s.eye[2];
    check(view, "eye-outside-south-facade", z >= v.eyeOutsideFacadeZ.minZ && z <= v.eyeOutsideFacadeZ.maxZ, `eye z ${z.toFixed(2)} (range ${v.eyeOutsideFacadeZ.minZ}..${v.eyeOutsideFacadeZ.maxZ})`);
  }
  if (v.eyeAboveObject) {
    const a = v.eyeAboveObject, o = objs[a.object];
    if (!o) check(view, `eye-above:${a.object}`, false, "object missing");
    else {
      const h = distXZ(s.eye, o.center), above = s.eye[1] - o.max[1];
      check(view, `eye-above:${a.object}`, h <= a.maxHorizontal && above >= a.minAboveTop && above <= a.maxAboveTop,
        `eye ${h.toFixed(2)} ft horizontally from pedestal centre (max ${a.maxHorizontal}); ${above.toFixed(2)} ft above its top (range ${a.minAboveTop}..${a.maxAboveTop})`);
    }
  }
}
for (const view of views) {
  const m = cfg.views[view].minDistanceFromView;
  if (!m || !viewStates[view] || !viewStates[m.view]) continue;
  const d = dist(viewStates[view].eye, viewStates[m.view].eye);
  check(view, `distinct-from:${m.view}`, d >= m.eye, `eye ${d.toFixed(1)} ft from ${m.view} eye (min ${m.eye})`);
}

// --- Deep links -------------------------------------------------------------
const deep = await context.newPage();
attach(deep, "deeplink");
for (const view of views) {
  try {
    await deep.goto(`${route}?view=${encodeURIComponent(view)}&${cfg.hookContract.queryParam}`, { waitUntil: "networkidle" });
    const ok = await waitForView(deep, view);
    const sel = await deep.getByLabel("Reconstruction viewpoint").inputValue();
    check(view, "deep-link", ok && sel === view, `?view=${view} -> select "${sel}", hook ${ok ? "matched" : "did not match"}`);
  } catch (e) {
    check(view, "deep-link", false, e.message);
  }
}
const unknownErrors = consoleErrors.length;
try {
  const { unknownValue, fallbackView } = cfg.deepLinks;
  await deep.goto(`${route}?view=${encodeURIComponent(unknownValue)}&${cfg.hookContract.queryParam}`, { waitUntil: "networkidle" });
  const ok = await waitForView(deep, fallbackView);
  const sel = await deep.getByLabel("Reconstruction viewpoint").inputValue();
  check("page", "deep-link-unknown-ignored", ok && sel === fallbackView && consoleErrors.length === unknownErrors, `?view=${unknownValue} -> select "${sel}", errors added ${consoleErrors.length - unknownErrors}`);
} catch (e) {
  check("page", "deep-link-unknown-ignored", false, e.message);
}

check("page", "no-console-errors", consoleErrors.length === 0, consoleErrors.length ? consoleErrors.slice(0, 10).join(" | ") : "none");
await browser.close();

// --- Report -----------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
const report = { route, generatedAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results, fixList: failed };
await fs.writeFile(path.join(outDir, "critic-results.json"), JSON.stringify(report, null, 2) + "\n");
const byView = {};
for (const r of results) (byView[r.view] ||= []).push(r);
let md = `# Dealey Plaza critic\n\n${report.passed}/${results.length} checks passed against ${route}.\n\n`;
md += failed.length ? `## Fix list\n\n${failed.map((r) => `- [ ] **${r.view} / ${r.check}**: ${r.detail}`).join("\n")}\n\n` : "## Fix list\n\nNone. All checks passed.\n\n";
md += "## Results by view\n\n";
for (const [view, rs] of Object.entries(byView))
  md += `### ${view}\n\n| Check | Result | Detail |\n| --- | --- | --- |\n${rs.map((r) => `| ${r.check} | ${r.pass ? "PASS" : "FAIL"} | ${String(r.detail).replace(/\|/g, "\\|")} |`).join("\n")}\n\n`;
await fs.writeFile(path.join(outDir, "fix-list.md"), md);
console.log(`plaza critic: ${report.passed}/${results.length} passed; fix list in ${outDir}/fix-list.md`);
process.exitCode = failed.length ? 1 : 0;
