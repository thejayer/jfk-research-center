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

// --- Screen-space projection ----------------------------------------------
// Uses the camera matrices the critic=1 hook reports (camera.matrixWorldInverse
// and camera.projectionMatrix, column-major as THREE stores them). If the hook
// lacks them, falls back to a look-at camera from eye/target with
// cfg.camera.fovDegrees and the canvas aspect, and the hook-camera check fails.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const mul4 = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
function makeProjector(s, aspect) {
  const cam = s.camera;
  if (cam && Array.isArray(cam.matrixWorldInverse) && cam.matrixWorldInverse.length === 16 && Array.isArray(cam.projectionMatrix) && cam.projectionMatrix.length === 16) {
    return (p) => {
      const v = mul4(cam.matrixWorldInverse, [p[0], p[1], p[2], 1]);
      const depth = -v[2];
      const c = mul4(cam.projectionMatrix, v);
      return { depth, x: c[0] / c[3], y: c[1] / c[3] };
    };
  }
  const f = norm(sub(s.target, s.eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const t = Math.tan((cfg.camera.fovDegrees * Math.PI) / 360);
  return (p) => {
    const d = sub(p, s.eye), depth = dot(d, f);
    return { depth, x: dot(d, r) / (depth * t * aspect), y: dot(d, u) / (depth * t) };
  };
}
// Polygon helpers in canvas CSS pixels.
const polyArea = (P) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
function hull(points) {
  const P = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function clipRect(P, r) {
  const edges = [
    [(p) => p[0] >= r.x0, (a, b) => [r.x0, a[1] + ((b[1] - a[1]) * (r.x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.x1, (a, b) => [r.x1, a[1] + ((b[1] - a[1]) * (r.x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.y0, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y0 - a[1])) / (b[1] - a[1]), r.y0]],
    [(p) => p[1] <= r.y1, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y1 - a[1])) / (b[1] - a[1]), r.y1]],
  ];
  let out = P;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    src.forEach((cur, i) => {
      const prev = src[(i + src.length - 1) % src.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    });
    if (!out.length) break;
  }
  return out;
}
// Screen footprint of one or more axis-aligned boxes (an object's world
// bounds, or its per-part bounds when the hook reports parts). Each box is
// sampled on an n^3 grid; samples in front of the near plane are projected,
// their convex hull is clipped to the canvas and rasterised onto a 4 px mask.
// Mask cells under DOM overlays (HUD cards, caption) do not count as clear.
function footprint(boxes, project, W, H, overlays) {
  const cell = 4, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  const mask = new Uint8Array(cols * rows);
  const n = boxes.length > 20 ? 2 : 6;
  let total = 0, inside = 0;
  for (const o of boxes) {
    const pts = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
      const p = [0, 1, 2].map((a, m) => o.min[a] + ((o.max[a] - o.min[a]) * [i, j, k][m]) / n);
      total++;
      const q = project(p);
      if (q.depth <= 0.5) continue;
      const px = [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * H];
      if (px[0] >= 0 && px[0] <= W && px[1] >= 0 && px[1] <= H) inside++;
      pts.push(px);
    }
    const h = pts.length >= 3 ? hull(pts) : [];
    const poly = h.length >= 3 ? clipRect(h, { x0: 0, y0: 0, x1: W, y1: H }) : [];
    if (poly.length < 3) continue;
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const c0 = Math.max(0, Math.floor(Math.min(...xs) / cell)), c1 = Math.min(cols - 1, Math.floor(Math.max(...xs) / cell));
    const r0 = Math.max(0, Math.floor(Math.min(...ys) / cell)), r1 = Math.min(rows - 1, Math.floor(Math.max(...ys) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * cell, y = (r + 0.5) * cell;
      let pos = false, neg = false;
      for (let e = 0; e < poly.length; e++) {
        const A = poly[e], B = poly[(e + 1) % poly.length];
        const cr = (B[0] - A[0]) * (y - A[1]) - (B[1] - A[1]) * (x - A[0]);
        if (cr > 0) pos = true; else if (cr < 0) neg = true;
      }
      if (!(pos && neg)) mask[r * cols + c] = 1;
    }
  }
  let covered = 0, clear = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!mask[r * cols + c]) continue;
    covered++;
    if (!underOverlay([(c + 0.5) * cell, (r + 0.5) * cell], overlays)) clear++;
  }
  return {
    inViewOfProjected: total ? inside / total : 0,
    hudFreeOfInView: covered ? clear / covered : 0,
    screenFraction: clear / (cols * rows),
  };
}
// DOM overlays drawn over the canvas: absolutely positioned elements in the
// canvas's scene container that do not contain the canvas. Grid/flex
// containers (the HUD card row) contribute their children's rects.
const measureOverlays = (page) => page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return { canvas: null, overlays: [] };
  const cr = canvas.getBoundingClientRect();
  let container = canvas.parentElement;
  while (container && container.parentElement && getComputedStyle(container).position !== "relative") container = container.parentElement;
  const overlays = [];
  const visible = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0; };
  for (const el of container ? container.querySelectorAll("*") : []) {
    if (el === canvas || el.contains(canvas) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute" && cs.position !== "fixed") continue;
    const kids = (cs.display === "grid" || cs.display === "flex") ? [...el.children].filter(visible) : [];
    for (const n of kids.length ? kids : [el]) {
      const r = n.getBoundingClientRect();
      const o = { x0: r.left - cr.left, y0: r.top - cr.top, x1: r.right - cr.left, y1: r.bottom - cr.top, label: (n.getAttribute("aria-label") || n.textContent || n.tagName).trim().slice(0, 40) };
      if (o.x1 > 0 && o.y1 > 0 && o.x0 < cr.width && o.y0 < cr.height) overlays.push(o);
    }
  }
  return { canvas: { width: cr.width, height: cr.height }, overlays };
});
const underOverlay = (px, overlays) => overlays.find((r) => px[0] >= r.x0 && px[0] <= r.x1 && px[1] >= r.y0 && px[1] <= r.y1);

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

const views = Object.keys(cfg.views).filter((k) => !k.startsWith("_"));
const page = await context.newPage();
attach(page, "main");
let state = null;
const viewStates = {};
const overlayRects = {};

// --- Page / WebGL bootstrap -------------------------------------------------
try {
  await page.goto(`${route}?${cfg.hookContract.queryParam}`, { waitUntil: "domcontentloaded" });
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
  // Scene panel including DOM overlays, for human review of HUD occlusion.
  if (v.sceneScreenshot) await page.locator("canvas").first().locator("xpath=../..").screenshot({ path: path.join(outDir, v.sceneScreenshot) }).catch(() => {});
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
  // Direction checks: unit forward vector (eye -> target) components.
  if (v.forward) {
    const f = norm(sub(s.target, s.eye));
    for (const [axis, k] of [["x", 0], ["y", 1], ["z", 2]]) {
      const b = v.forward[axis];
      if (!b) continue;
      const okMin = b.min === undefined || f[k] >= b.min, okMax = b.max === undefined || f[k] <= b.max;
      check(view, `forward-${axis}`, okMin && okMax, `forward ${fmt(f)}; ${axis} ${f[k].toFixed(2)} (range ${b.min ?? "-"}..${b.max ?? "-"}) ${b._why ?? ""}`.trim());
    }
  }
  if (v.inFrame || v.inFramePoints) {
    const m = await measureOverlays(page);
    const W = m.canvas?.width ?? 1, H = m.canvas?.height ?? 1;
    const hasCam = Boolean(s.camera?.matrixWorldInverse?.length === 16 && s.camera?.projectionMatrix?.length === 16);
    check(view, "hook-camera-matrices", hasCam, hasCam ? "hook reports camera.matrixWorldInverse + projectionMatrix" : `hook lacks camera matrices; in-frame checks used a ${cfg.camera.fovDegrees} deg look-at fallback`);
    const project = makeProjector(s, W / H);
    overlayRects[view] = m.overlays;
    for (const f of v.inFrame ?? []) {
      const o = objs[f.object];
      if (!o) { check(view, `in-frame:${f.object}`, false, "object missing"); continue; }
      let boxes = [o];
      if (f.useParts) {
        const ok = Array.isArray(o.parts) && o.parts.length > 0;
        check(view, `hook-parts:${f.object}`, ok, ok ? `${o.parts.length} part bounds reported` : "hook lacks objects[name].parts; footprint used the whole-object bounds");
        if (ok) boxes = o.parts;
      }
      const fp = footprint(boxes, project, W, H, m.overlays);
      check(view, `in-frame:${f.object}`,
        fp.inViewOfProjected >= f.minInViewOfProjected && fp.hudFreeOfInView >= f.minHudFreeOfInView && fp.screenFraction >= f.minScreenFraction,
        `${(fp.inViewOfProjected * 100).toFixed(0)}% of sample points inside canvas (min ${f.minInViewOfProjected * 100}%), ${(fp.hudFreeOfInView * 100).toFixed(0)}% of the in-canvas footprint clear of HUD/overlays (min ${f.minHudFreeOfInView * 100}%), clear footprint ${(fp.screenFraction * 100).toFixed(2)}% of canvas (min ${f.minScreenFraction * 100}%)`);
    }
    for (const t of v.inFramePoints ?? []) {
      const q = project(t.point);
      const px = [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * H];
      const d = dist(s.eye, t.point);
      const inView = q.depth > 0.5 && Math.abs(q.x) <= t.maxAbsNdcX && q.y >= t.ndcY[0] && q.y <= t.ndcY[1];
      const hud = underOverlay(px, m.overlays);
      const okD = d >= t.distance[0] && d <= t.distance[1];
      check(view, `in-frame-point:${t.name}`, inView && !hud && okD,
        `${t.name} ${fmt(t.point)} -> ndc [${q.x.toFixed(2)}, ${q.y.toFixed(2)}] depth ${q.depth.toFixed(1)} (|x| <= ${t.maxAbsNdcX}, y ${t.ndcY[0]}..${t.ndcY[1]})${hud ? `, under overlay "${hud.label}"` : ", clear of overlays"}; ${d.toFixed(1)} ft from eye (range ${t.distance[0]}..${t.distance[1]})`);
    }
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
    await deep.goto(`${route}?view=${encodeURIComponent(view)}&${cfg.hookContract.queryParam}`, { waitUntil: "domcontentloaded" });
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
  await deep.goto(`${route}?view=${encodeURIComponent(unknownValue)}&${cfg.hookContract.queryParam}`, { waitUntil: "domcontentloaded" });
  const ok = await waitForView(deep, fallbackView);
  const sel = await deep.getByLabel("Reconstruction viewpoint").inputValue();
  check("page", "deep-link-unknown-ignored", ok && sel === fallbackView && consoleErrors.length === unknownErrors, `?view=${unknownValue} -> select "${sel}", errors added ${consoleErrors.length - unknownErrors}`);
} catch (e) {
  check("page", "deep-link-unknown-ignored", false, e.message);
}

for (const [alias, target] of Object.entries(cfg.deepLinks.aliases ?? {})) {
  try {
    await deep.goto(`${route}?view=${encodeURIComponent(alias)}&${cfg.hookContract.queryParam}`, { waitUntil: "domcontentloaded" });
    const ok = await waitForView(deep, target);
    const sel = await deep.getByLabel("Reconstruction viewpoint").inputValue();
    const urlView = new URL(deep.url()).searchParams.get("view");
    check("page", `deep-link-alias:${alias}`, ok && sel === target && urlView === target, `?view=${alias} -> select "${sel}", hook ${ok ? `reported ${target}` : `did not report ${target}`}, URL view=${urlView} (expected canonical ${target})`);
  } catch (e) {
    check("page", `deep-link-alias:${alias}`, false, e.message);
  }
}

check("page", "no-console-errors", consoleErrors.length === 0, consoleErrors.length ? consoleErrors.slice(0, 10).join(" | ") : "none");
await browser.close();

// --- Report -----------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
const report = { route, generatedAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results, fixList: failed, overlayRects };
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
