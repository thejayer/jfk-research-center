# Dealey Plaza render critic

Critic-owned: builders (people or Codex) must not edit `critic.mjs` or `tolerances.json`. Fix the scene, view presets or the `critic=1` hook instead.

## Requirements

- A running server for the trajectory page, normally `JFK_DATA_SOURCE=mock npm run build && JFK_DATA_SOURCE=mock npm run start` (default base `http://localhost:3000`; override with `--base` or `PLAZA_CRITIC_BASE`).
- A Chromium build for `playwright-core`. Either install Playwright's Chromium (`npx playwright install chromium`) or point `EDGE_PATH` (or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`) at a local Chrome/Edge/Chromium executable. WebGL runs headlessly through SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`), so no GPU is needed.

## What it checks

- Page load waits for `domcontentloaded`, then for the canvas and for the `critic=1` hook to report the expected view with at least one render (scene ready). It does not wait for `networkidle`.
- Named object bounds (sniper-window bay, pedestal, stockade fence) against documented visual-estimate positions.
- Per view: eye placement, and direction checks on the camera's forward vector (for example, the Zapruder view must face east toward Elm).
- In-frame checks: named objects and Elm Street target points are projected to the canvas with the rendered camera matrices reported by the hook. Each must land inside the canvas and clear of DOM overlays (HUD cards, caption), whose rects are measured from the live page, and cover a minimum screen fraction. These checks do not test occlusion by scene geometry, so the screenshots still need a human look.
- Deep links, including the `pedestal` -> `zapruder` and `pergola` -> `knoll` aliases, unknown-value fallback, non-blank renders and console errors.

Outputs (`critic-results.json`, `fix-list.md`, canvas screenshots and `*-scene.png` shots that include the HUD) go to `artifacts/plaza-critic/` by default, which is gitignored. Positions and tolerances are documented visual estimates, not survey-calibrated values, and passing checks do not establish historical or forensic accuracy.
