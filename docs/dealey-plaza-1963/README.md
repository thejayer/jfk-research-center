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

## Navigation, accessibility and performance

Orbit/pan/zoom use Three.js OrbitControls. Viewpoint select and zoom/reset buttons are keyboard accessible. No automatic camera movement. Rendering occurs only on interaction, resize or state change. Low power mode disables antialiasing/shadows and caps pixel ratio at 1. Renderer creation failure or context loss exposes an explanatory status while the existing plan, controls and overlay remain usable. Canvas resources, including generated label textures, are disposed on cleanup.

## Validation

See `browser-results.json` and screenshots in this directory. `scripts/inspect-plaza.mjs` exercises six viewpoints, a real pointer orbit drag, zoom/reset, ray visibility, frame selection, manual origin adjustment, labels, low power and mobile layout against a local mock-data server. It also forces WebGL creation failure and confirms controls remain enabled. Axe is scoped to the scene panel. Screenshots are synthetic local renders, not historical photographs.

The installed `deep-code-review` skill was then located and run. Its four independent review passes and fresh adversarial verifier were completed. One demonstrated camera/labels regression was accepted, fixed in a separate phase, and independently reverified. See [DEEP_REVIEW.md](DEEP_REVIEW.md). The earlier availability note was superseded; the similarly named Data-plugin reference was not used as a substitute.

Work was prepared on `codex/dealey-1963-reconstruction` in a fresh isolated clone. The user subsequently authorized publishing this scoped change as a ready-for-review PR. Publication does not authorize merge or deployment. No new credentials or production-data access were used. Committed PNG previews are synthetic renders of repository-authored geometry; restricted archival imagery is not included.

Final verification: 55 test files / 372 tests passed (`tests.txt`); production `next build` passed including type validation (`build.txt`); standalone `npm run typecheck` passed; `git diff --check` passed. Build logs include existing dynamic-server static-generation diagnostics; the build completed with dynamic routes. Browser results: no page errors, one canvas after renderer recreation, no mobile horizontal overflow, successful pointer orbit / frame selection / forced WebGL fallback, and zero Axe violations in the scene panel. This is not a whole-site accessibility audit or a hardware performance benchmark.

Base commit: `ac395fee6705101cf38a0b31375047c0d784333b`. The initial review recorded the uncommitted snapshot; the PR records the published head and final-head verification.
