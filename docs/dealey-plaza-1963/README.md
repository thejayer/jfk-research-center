# Dealey Plaza, November 1963 — reconstruction record

This implementation extends `/dealey-plaza/trajectory`; it preserves the original ray controls, frame scrubber, intersections, plan view, and historical photograph overlay. All new geometry and lettering are authored in the repository. No historical photograph, third-party mesh, or texture has been imported.

## Sources and use

Reviewed November 3, 2026. Source chronology matters: Commission material was compiled after the event and the NPS nomination describes both original and later conditions.

| Source | What it supports | Rights / treatment |
| --- | --- | --- |
| [Commission Exhibit 877, contemporary physical description](https://www.history-matters.com/archive/jfk/wc/wcvols/wh17/pdf/WH17_CE_877.pdf) | 40 ft concrete roads; 10 ft outer sidewalks; approximately 24 ft fall; 425 ft Main / 495 ft curved route lengths; pergolas, pools, building heights, rail crossing | Historical government exhibit used for facts; no scan embedded. Government custody alone does not establish copyright status for every contributed exhibit. |
| [NARA, Warren Commission chapter 2](https://www.archives.gov/research/jfk/warren-commission-report/chapter-2.html), [CE876](https://aarclibrary.org/publib/jfk/wc/wcvols/wh17/pdf/WH17_CE_876.pdf) and CE2113–2116 | Street fan, landmark relationships, route and contemporary photographic/map references; government center under construction. CE876 was downloaded to temporary storage, rasterized and visually inspected. | Linked references, no downloaded imagery distributed. Official text used for spatial facts without adopting disputed conclusions. |
| [CE882 survey tracing](https://aarclibrary.org/publib/jfk/wc/wcvols/wh17/pdf/WH17_CE_882.pdf) | Visual check of the wider street fan and north-side relationships, used to revise initial road layout | Downloaded to temporary storage, rasterized and visually inspected. Not digitized or calibrated; no claim of traced survey coordinates. |
| [Dallas Times Herald, Nov. 23, 1963, depository from plaza](https://texashistory.unt.edu/ark:/67531/metapth184960/) | Dated period exterior reference, collection metadata | Sixth Floor Museum named rights holder. Metadata reviewed; direct image access encountered a robot challenge, left unsolved. No image copied or embedded. |
| [Texas State Historical Association, depository history](https://www.tshaonline.org/handbook/entries/texas-school-book-depository) | Seven floors, 100 × 100 ft footprint, rooftop rental-car billboard present 1959–1979 | Factual reference only. Its photographs are not an asset license. |
| [NPS, Dealey Plaza Historic District nomination](https://npgallery.nps.gov/AssetDetail/NRIS/93001607) | Historic district context; parent research supplied white concrete structures, cedar fence and changed lamp placements | Source lead plus parent-reviewed findings, not a claim of independent fine-detail survey extraction. No NPS photographs imported. |
| [City of Dallas, May 23, 2011 renovation briefing](https://www3.dallascityhall.com/committee_briefings/briefings0511/QOL_Combined_052311.pdf) | Parent visual research: original Hare & Hare plans, curved pergolas with sheltered ends; drawings pp. 13–16 | Browser fetch exceeded tool size limit. Parent-reviewed visual findings used as qualitative references; mixed-date photographs not assumed to depict Nov. 22, 1963. No scans copied. |

## Geometry and limitations

New architectural scene coordinates are feet: Houston/Main intersection origin, +X east, +Z south, Y elevation. Main/underpass separation is 425 ft, roadway width 40 ft, and depository dimensions 100 × 100 × 94 ft. These are **documented dimension anchors**, not an independently verified survey. The linear 24/425 terrain grade is an interpolation of endpoints, not a measured terrain model.

Curved road control points, local knoll topography, pergola radius and column spacing, fence alignment, street furniture, trees, window bays, contextual building footprints, and construction-frame proportions are visual estimates. Curved road lengths have not been fitted to the reported 495 ft. The eastern surrounding buildings are simplified massing with recognizable architectural cues. Lamp positions aim for the sidewalk condition rather than later grass relocation. Tree species, seasonal color, shadows and lighting are illustrative. The reconstruction omits a complete motorcade, spectators and any asserted event reenactment. Exact roof billboard artwork is not reproduced.

The legacy trajectory coordinates remain unchanged for calculations, plan view and historical overlay. For optional 3D display only they undergo a rigid rotation/translation (no scale), preserving distances. Their relationship to the new architecture is **uncalibrated**. Ray endpoints, window vicinity and frame targets must not be used as forensic evidence or as verified vehicle/body/observer positions. The ray is hidden initially, and the UI explains the distinction. A window or knoll viewpoint is a navigation aid, not a calibrated camera or endorsement of any hypothesis.

The procedural `zapruder-pedestal` is a 4 × 4 × 4 ft concrete block resting on local ground near (-242, -155) in plan, at the north pergola’s Elm-side end. The distinct `tsbd-sniper-window` is the easternmost south-facade bay in the sixth-floor row of the existing eight-column, seven-row grid, with an open lower section, raised sash, jambs, sill and head. Masonry panels surround the opening so its frame reads from inside as well as outside. Its bounds cover one bay. The pedestal, window bay and viewpoint positions are **documented visual estimates, not survey-calibrated**; neither these details nor the legacy ray establish forensic accuracy.

## Navigation, accessibility and performance

The trajectory route (`/dealey-plaza/trajectory`) renders its 2D shell first: viewpoint controls, HUD readouts, reconstruction notes, plan view, historical overlay and accessibility text. Three.js, OrbitControls and the plaza model load afterward as separate async chunks via `next/dynamic` with `ssr: false`. The scene panel keeps the same reserved height during that load (a same-dimension skeleton, no layout shift). Other routes do not include those chunks in First Load JS.

Viewpoints include overview, overhead, depository exterior, Elm approach, north pergola vicinity (`knoll`), southeast sixth-floor window bay (`window`), Zapruder pedestal (`zapruder`), and stockade fence / grassy knoll (`stockade`). The pedestal camera uses standing eye height above the block, offset west-northwest to include the block and look east under the pergola end shelter toward Elm. The stockade camera steps back north of the pickets, clears their tops and looks south toward Elm; the window camera sits just inside the opened bay and looks southwest down Elm. The existing north pergola vicinity is unchanged. Open `/dealey-plaza/trajectory?view=zapruder` (or any view key) to select it on load. Unknown keys safely retain overview. The aliases `pedestal` and `pergola` resolve to `zapruder` and `knoll`, replacing the URL parameter with the canonical key. Other initial keys leave the URL unchanged. Selecting a different view or Reset view replaces the URL’s `view` parameter while preserving other parameters and the fragment.

Orbit/pan/zoom use Three.js OrbitControls once the scene chunk has loaded. Viewpoint select and zoom/reset buttons are keyboard accessible. No automatic camera movement. Rendering occurs only on interaction, resize or state change. Low power mode disables antialiasing/shadows and caps pixel ratio at 1. Renderer creation failure or context loss exposes an explanatory status while the existing plan, controls and overlay remain usable. Canvas resources, including generated label textures, are disposed on cleanup.

## Validation

See `browser-results.json` and screenshots in this directory. `scripts/inspect-plaza.mjs` exercises six viewpoints, a real pointer orbit drag, zoom/reset, ray visibility, frame selection, manual origin adjustment, labels, low power and mobile layout against a local mock-data server. It also forces WebGL creation failure and confirms controls remain enabled. Axe is scoped to the scene panel. Screenshots are synthetic local renders of the loaded reconstruction, not historical photographs and not the brief loading skeleton.

The separate critic lives in `scripts/plaza-critic/`; `tolerances.json` documents visual-estimate bounds and the opt-in `critic=1` hook contract. With no critic query parameter, no critic global or bounds collection is created. When enabled, the hook refreshes the rendered camera matrices on every render and reports separate world bounds for all 98 stockade pickets. To check a production server using mock data, run:

```sh
JFK_DATA_SOURCE=mock npm run build
JFK_DATA_SOURCE=mock npm run start
# In a second terminal, against that next start server:
npm run critic:plaza
```

The critic needs a Chromium for `playwright-core`: run `npx playwright install chromium`, or set `EDGE_PATH` to a local Chrome/Edge/Chromium executable (see `scripts/plaza-critic/README.md`). It checks named world-space object bounds, camera placement and facing, whether the pedestal, stockade fence, SE sixth-floor bay and Elm Street targets are in frame and clear of the HUD cards, URL deep links (including the `pedestal` and `pergola` aliases) and nonblank renders, and writes its report/screenshots to `artifacts/plaza-critic` by default. These checks verify the procedural contract, not historical or forensic accuracy.

The reconstruction review is recorded in [DEEP_REVIEW.md](DEEP_REVIEW.md). One demonstrated camera/labels regression was accepted, fixed, and independently reverified before this lazy-load follow-up.

Work is on `codex/dealey-1963-reconstruction` as ready-for-review PR https://github.com/thejayer/jfk-research-center/pull/151. Publication does not authorize merge or deployment; merge waits for Austin's explicit GO. No new credentials or production-data access were used. Committed PNG previews are synthetic renders of repository-authored geometry; restricted archival imagery is not included.

First Load JS on `/dealey-plaza/trajectory` was **267 kB** before the split and **121 kB** after, against a ~130 kB target. Shared First Load JS stayed at **103 kB**. CI budgets are 133.1 kB (measured 121 kB + 10%) for the trajectory route and 108 kB (baseline 103 kB + 5 kB) for shared First Load JS. Parser tests live in `lib/__tests__/bundle-size.test.ts`; the production gate is `lib/__tests__/bundle-size-gate.test.ts`.

Final verification: typecheck passed; `npm test` — **59 files / 430 tests passed**, 1 skipped (the production bundle gate, which CI runs after `next build`) (`tests.txt`); production `next build` with `JFK_DATA_SOURCE=mock` passed (`build.txt`); `git diff --check` passed. Build logs include existing dynamic-server static-generation diagnostics; the build completed with dynamic routes. Browser results: no page errors, one canvas after renderer recreation, no mobile horizontal overflow, successful pointer orbit / frame selection / forced WebGL fallback, and zero Axe violations in the scene panel. This is not a whole-site accessibility audit or a hardware performance benchmark.
