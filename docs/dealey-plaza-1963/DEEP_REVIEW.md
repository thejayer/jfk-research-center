# Deep review — Dealey Plaza reconstruction

## Follow-up (lazy-load / bundle split)

PR https://github.com/thejayer/jfk-research-center/pull/151 on `codex/dealey-1963-reconstruction`. This follow-up keeps the reconstruction appearance and 2D fallback and loads Three.js plus the plaza model only on `/dealey-plaza/trajectory` after the shell renders (`next/dynamic`, `ssr: false`). Merge remains held for Austin's explicit GO.

The original reconstruction review below still applies to the scene, camera-label fix, and source limits. It described an uncommitted snapshot against `ac395fee`; that snapshot was later published and this branch was merged with `main`. Do not treat the original "no PR exists" note as current.

## Findings

### [P2] Preserve manual camera framing when toggling labels — resolved

`components/dealey-plaza/plaza-scene.tsx` (moved from `trajectory-sandbox.tsx`)

The original added effect depended on both `view` and `showLabels` and called the preset-view action on every label change. OrbitControls and the zoom buttons change the camera independently of the React preset identifier, so toggling Labels discarded the user's manual orbit/pan/zoom and restored the preset.

Evidence: all four independent reviewers traced the complete path. A fresh adversarial verifier independently reproduced it using headless Edge: the orbited canvas returned exactly to the initial overview after changing labels. The lead's separate focused reproduction returned `zoomChangedView=true`, `labelsPreserveZoom=false`, `labelsResetToInitial=true`.

The finding was frozen and accepted before a separate fix phase. The fix separates viewpoint application (`[view, lowPower]`) from label visibility (`[showLabels, lowPower]`). The browser regression now compares the zoomed, label-free canvas before and after labels on/off.

Post-fix independent verification: **8 passed, 0 failed, 0 skipped**. Orbit, zoom, Reset and Depository viewpoint selection were exercised, label toggles preserved the adjusted canvas exactly, and there were no page errors. No remaining verified finding in the narrow fix. The lead's focused reproducer returned `zoomChangedView=true`, `labelsPreserveZoom=true`, `labelsResetToInitial=false`.

The lazy-load extraction keeps that split: the renderer still recreates only when `lowPower` changes, and label updates do not call the preset-view action.

## Coverage

- Target: PR #151, branch `codex/dealey-1963-reconstruction`. Original review scope was local uncommitted reconstruction files against `main` at `ac395fee6705101cf38a0b31375047c0d784333b`. The published reconstruction head was `40fa7a04f2227e5a89c67b75985c367e15632e74`; this follow-up starts from `0ae8477d3774aea2c0d222a21c469d3bb61e1bbf` after merging `main`.
- Installed workflow for the original reconstruction: local `deep-code-review` skill (SKILL.md) plus reviewer-roles, evidence-and-severity, and output-format references.
- Review passes: correctness/state; contracts/data; security/reliability; tests/history/architecture. Four reviewers worked in fresh contexts containing the neutral scope and paths only, with no implementation history or other reviewers' conclusions. They were read-only. One duplicate root cause was consolidated; acceptance followed evidence, not agreement.
- Independence: the lead authored the implementation. The four reviewers and fresh adversarial verifier did not inherit the implementation conversation. The same verifier separately inspected and executed checks against the narrow fix; reviewers did not edit concurrently.
- Original reviewed source fingerprint: `trajectory-sandbox.tsx` SHA-256 `061FEF4B0541244D5A6D1C3A732852F8283E88B2546B4C2915A60C255943F4B9`; `plaza-1963.ts` SHA-256 `8F470FA436FD18ACC60F66440742738377CB60E99AFF489F21382466A3F4939C`. The architectural builder was unchanged during this review/fix phase. The repaired camera effect and added browser regression were independently reverified; subsequent changes to these documents are reporting only.
- Verifier runtime: Node `v24.14.1`, existing `playwright-core`, installed Microsoft Edge, headless SwiftShader, local Next.js `dev:mock` server. The verifier executed inline scripts through `node --input-type=module`: original reproduction **5 passed / 0 failed / 0 skipped**; repaired behavior **8 passed / 0 failed / 0 skipped**. These are newly executed local checks, not inspected CI or live production results.
- Lead verification: `node scripts/inspect-plaza.mjs` completed after the fix. It rerendered six viewpoints, exercised a pointer orbit, frame/manual controls, camera-preserving labels, low power, mobile width and forced WebGL failure. `browser-results.json` records zero browser errors, one recreated canvas, no horizontal overflow, and zero Axe violations in the scene panel. The regenerated overview was visually inspected.
- a temporary local `verify-dealey-labels.mjs` diagnostic (not committed) was executed by the lead before and after the fix; its three comparison booleans are recorded above. It was a temporary diagnostic, not an imported production asset.
- Lazy-load follow-up checks: `npx tsc --noEmit` passed; `npm test` records current unit results in `tests.txt`; `JFK_DATA_SOURCE=mock npm run build` passed (`build.txt`). First Load JS for `/dealey-plaza/trajectory` went from 267 kB to 121 kB; shared First Load JS stayed at 103 kB. CI budgets are 133.1 kB and 108 kB respectively. No outstanding verified findings remain from the original reconstruction review.

## Residual risks

- Browser verification used software-rendered WebGL on one local runtime. It does not certify GPU performance or context-restoration behavior on every device.
- The code review does not turn the documented approximate historical geometry into a calibrated survey or forensic model. Source limitations remain in README.md and the UI.
- The 3D canvas appears after the async Three.js chunk loads. The 2D plan, overlay, controls and reconstruction text remain available immediately.
