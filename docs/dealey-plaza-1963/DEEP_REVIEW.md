# Deep review — Dealey Plaza reconstruction

## Findings

### [P2] Preserve manual camera framing when toggling labels — resolved

`components/dealey-plaza/trajectory-sandbox.tsx:312`

The original added effect depended on both `view` and `showLabels` and called the preset-view action on every label change. OrbitControls and the zoom buttons change the camera independently of the React preset identifier, so toggling Labels discarded the user's manual orbit/pan/zoom and restored the preset.

Evidence: all four independent reviewers traced the complete path. A fresh adversarial verifier independently reproduced it using headless Edge: the orbited canvas returned exactly to the initial overview after changing labels. The lead's separate focused reproduction returned `zoomChangedView=true`, `labelsPreserveZoom=false`, `labelsResetToInitial=true`.

The finding was frozen and accepted before a separate fix phase. The fix separates viewpoint application (`[view, lowPower]`) from label visibility (`[showLabels, lowPower]`). The browser regression now compares the zoomed, label-free canvas before and after labels on/off.

Post-fix independent verification: **8 passed, 0 failed, 0 skipped**. Orbit, zoom, Reset and Depository viewpoint selection were exercised, label toggles preserved the adjusted canvas exactly, and there were no page errors. No remaining verified finding in the narrow fix. The lead's focused reproducer returned `zoomChangedView=true`, `labelsPreserveZoom=true`, `labelsResetToInitial=false`.

## Coverage

- Target: local uncommitted changes in `thejayer/jfk-research-center`, branch `codex/dealey-1963-reconstruction`. Base and HEAD: `ac395fee6705101cf38a0b31375047c0d784333b`. There is no branch-commit diff, so the explicitly requested local implementation, including untracked source and supporting documents, was the review scope. No PR exists; no remote writes or PR-head assertion applies.
- Installed workflow: local `deep-code-review` skill (SKILL.md) plus reviewer-roles, evidence-and-severity, and output-format references.
- Review passes: correctness/state; contracts/data; security/reliability; tests/history/architecture. Four reviewers worked in fresh contexts containing the neutral scope and paths only, with no implementation history or other reviewers' conclusions. They were read-only. One duplicate root cause was consolidated; acceptance followed evidence, not agreement.
- Independence: the lead authored the implementation. The four reviewers and fresh adversarial verifier did not inherit the implementation conversation. The same verifier separately inspected and executed checks against the narrow fix; reviewers did not edit concurrently.
- Original reviewed source fingerprint: `trajectory-sandbox.tsx` SHA-256 `061FEF4B0541244D5A6D1C3A732852F8283E88B2546B4C2915A60C255943F4B9`; `plaza-1963.ts` SHA-256 `8F470FA436FD18ACC60F66440742738377CB60E99AFF489F21382466A3F4939C`. The architectural builder was unchanged during this review/fix phase. The repaired camera effect and added browser regression were independently reverified; subsequent changes to these documents are reporting only.
- Verifier runtime: Node `v24.14.1`, existing `playwright-core`, installed Microsoft Edge, headless SwiftShader, local Next.js `dev:mock` server. The verifier executed inline scripts through `node --input-type=module`: original reproduction **5 passed / 0 failed / 0 skipped**; repaired behavior **8 passed / 0 failed / 0 skipped**. These are newly executed local checks, not inspected CI or live production results.
- Lead verification: `node scripts/inspect-plaza.mjs` completed after the fix. It rerendered six viewpoints, exercised a pointer orbit, frame/manual controls, camera-preserving labels, low power, mobile width and forced WebGL failure. `browser-results.json` records zero browser errors, one recreated canvas, no horizontal overflow, and zero Axe violations in the scene panel. The regenerated overview was visually inspected.
- a temporary local `verify-dealey-labels.mjs` diagnostic (not committed) was executed by the lead before and after the fix; its three comparison booleans are recorded above. It was a temporary diagnostic, not an imported production asset.
- Final lead checks executed after the fix: `npm test` — **55 files / 372 tests passed, 0 failed, 0 skipped**; `JFK_DATA_SOURCE=mock npm run build` — **passed, exit 0**, including type validation; `git diff --check` — **passed**. Logs are saved as `tests.txt` and `build.txt`. The build emits the existing dynamic-server static-generation diagnostics and finishes successfully with dynamic routes. Existing dependencies were reused for review; no dependency installation, production data, publishing or Git mutations were performed by the review agents.
- Immediately before reporting, local HEAD was rechecked at `ac395fee6705101cf38a0b31375047c0d784333b`; the local change list remained the reconstruction files, test script and supporting documents. Final source SHA-256: `trajectory-sandbox.tsx` = `E79E35403E9512B4EEF9CD642A5E5680BD0D6B42668E1B538731FD7FA46B758E`; `scripts/inspect-plaza.mjs` = `46D318E2AF46D2C4887A3E96468974F9F05B0C0A9168E6816CB7E181A3F52025`. No unreviewed source edits followed the narrow fix; only review documentation and verification artifacts were updated. No outstanding verified findings remain.

## Residual risks

- Browser verification used software-rendered WebGL on one local runtime. It does not certify GPU performance or context-restoration behavior on every device.
- The code review does not turn the documented approximate historical geometry into a calibrated survey or forensic model. Source limitations remain in README.md and the UI.
