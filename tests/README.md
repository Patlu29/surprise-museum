# End-to-end tests (Playwright)

Owner: qa-engineer. Results and bugs: `docs/qa-report.md`. Handoff: `docs/handoffs/qa-engineer.md`.

## Run

```bash
npx playwright install chromium firefox webkit        # once
npx playwright test                                   # all projects
npx playwright test --project=desktop-chromium        # one project
npx playwright test visit-guide -g "US-12"            # one file or story
PW_REUSE_SERVER=1 npx playwright test                 # reuse a server already on :4173
npx playwright show-report                            # HTML report
```

`playwright.config.ts` builds with `VITE_API_MODE=mock npm run build -- --mode test` and serves the
build with `vite preview` under `/surprise-museum/`. Everything runs against the in-browser demo
backend (IndexedDB). Nothing calls Supabase. `--mode test` only adds `window.__APP_TEST__` (the
stores); the production CSP, minification and base path are unchanged.

Projects: `desktop-chromium`, `desktop-firefox`, `mobile-webkit` (iPhone 13), `mobile-chromium`
(Pixel 7). Chromium runs with SwiftShader (software WebGL), so frame rates are never measured here.

## Layout

| File | Covers |
|---|---|
| `builder.spec.ts` | US-1 to US-8, US-22, US-29 |
| `gender.spec.ts` | US-46, US-47, US-48 and ADR 0020 (CR-1): the Gender group, preview change, legacy drafts and museums, rejection of unknown values, the pronoun scan |
| `restored-notice.spec.ts` | CR-3: the "Photos aren't kept" notice (design spec 5.17) |
| `presentation-camera.spec.ts` | CR-2: the framed pose at 360x640, 390x844, 844x390 and 1280x720, release, return, reduced motion, the veil |
| `label-strip.spec.ts` | Spec 5.5 v1.5 (BUG-10): labels at or below the portrait caption strip edge (172, 180, 192), clear of the picture, no needless shift, eased or instant |
| `caption-card.spec.ts` | Spec 3.5 v1.4: strip, fitted card, widths (S1 to S7), upgrade rule (U1, U5, U7, U8), copy (G1) |
| `visit-welcome-roam.spec.ts` | US-9, US-10, US-11, US-15, US-17 |
| `visit-guide-presentations.spec.ts` | US-12, US-13, US-14, US-42, US-32 (reduced motion) |
| `visit-ui.spec.ts` | US-16, US-30, US-31, US-33, US-34, US-35, US-43, US-44, arrow buttons (WCAG 2.5.7) |
| `share-edit-delete.spec.ts` | US-23, US-24, US-25, US-30 AC-4 |
| `home-and-demo.spec.ts` | Home, footer, demo-storage notice |
| `csp-blob.spec.ts` | `blob:` photos under the production CSP (every browser project) |
| `accessibility.spec.ts` | axe (WCAG 2.2 AA), keyboard-only visit, focus visibility, reflow, and (round 6) the CR-4 builder, landing and visit surfaces and 200% text at 320 px |
| `mobile.spec.ts` | Touch controls, phone layout, pinch zoom |
| `android-keyboard.spec.ts` | `interactive-widget` and the builder with an emulated keyboard |
| `cr4-builder.spec.ts` | CR-4 builder shell: the three-Next path to Publish, one visible Preview at a time (360 to 1280 px, steps 1 to 4), Add more photos, Still to do chips and Ready to publish, the stepper, blur validation (US-54 to US-56, FR-82, FR-85 to FR-87) |
| `more-options.spec.ts` | CR-4 character options: the closed group leaves the step as it was (FR-102, measured against the pre-CR-4 build), keyboard path and count chip, every face shape, style and pattern saved, reloaded, shared and validated (FR-96 to FR-101), older data reads as defaults, FR-103 description words and the 720-combination wording sweep (US-63 to US-67) |
| `cr4-visit.spec.ts` | CR-4 visit: Done and Carry on on a phone in portrait, the finale footer at 320 px and with large text, N-10 name labels inside the viewport and apart, the landing page (US-51, FR-80) |
| `ceiling.spec.ts` | FR-95 (US-62): the ceiling never blocks a high camera, the 2 m height cap (about 5.25 m boom at 55 degrees), every room type, smooth fade, reduced-motion hysteresis, Preview |
| `visual.spec.ts` | Stable screenshots (desktop Chromium only): the original six, gender previews and entrances, the brow close-up, and (round 6) the five face shapes, new styles with patterns, More options open and the ceiling cutaway |
| `support/` | Image generator and PNG diff, builder and visit helpers, camera and card helpers (`presentation.ts`), fixtures |

## Conventions

- Test titles start with the story and criterion, for example `US-12 AC-1: ...`, so the QA report can
  map results back.
- The scene is tested through `window.__surpriseMuseum` (opted in with `?e2e=1` before the `#`), in
  simulation time (`snapshot().time`), not wall-clock time.
- `openVisit` always does a fresh page load, as the recipient would.
- `test.fail(true, 'BUG-n ...')` marks a known product bug. The suite stays green, and goes red
  ("expected to fail but passed") when the bug is fixed. Remove the `test.fail` line then.
  None is left after round 7. The finale visual test retries the visit until the card docks right (observation N-11).
- `tests/e2e` is type-checked by `tsc -b` (tsconfig.node.json, no DOM lib). Browser-side code reaches
  the page through `globalThis as unknown as PageGlobals`.

## Camera and card hooks

`snapshot().presentationCamera` (mode, `pictureVisibleFraction`, `yawOffsetDeg`, `lastMoveInMs`, `lastMoveOutMs`,
`veil`), the `data-presentation-camera` attribute and the `surprise-museum:presentation-camera` event are read by
`support/presentation.ts` (`startRecording`, `standAndFrame`, `cardInfo`). Timing is wall-clock in software WebGL,
so checks leave room for a slow frame. The hook does not expose the shown yaw, so peak turning speed is derived
from `yawOffsetDeg` and the move duration, not measured per frame. `fixRects` replaces the scene's published
rectangles with fixed ones (spec 3.5 fixtures) by defining getters on `screenRects`.

## Visual baselines

Stored in `tests/e2e/__screenshots__/<project>-<platform>/`. They were created on macOS with
desktop Chromium and software WebGL, so compare only on the same platform (CI needs its own set,
made in the same container image that CI uses). Never run `--update-snapshots` to make a failing run
pass. A failure is a visual change: look at the diff in the HTML report, decide whether it is
intended, and record the reason in `docs/qa-report.md` before updating.

Round 3: `presenting-photo-1.png` was re-recorded on purpose (the camera now frames the picture, CR-2). Every other
original baseline is unchanged and Neutral still matches them. New baselines were added with
`--update-snapshots=missing`. The gender preview baselines are taken from a restored draft, not after a click,
because changing a gender in place currently moves the character off its plinth (BUG-6).

## Audit scripts (not part of the Playwright run)

`tests/audit/` holds repeatable measurements that need the test-mode mock build served on port 4173 (`VITE_API_MODE=mock npm run build -- --mode test`, then `npx vite preview --port 4173 --strictPort`):

- `node tests/audit/edge-contrast.mjs chromium --patterns` : FR-89 edge contrast in the lit museum (156 cases, about 40 minutes on a busy machine; add `--dpr=1` for the 1.0 stretch case, which is reported and never a pass condition, and `--styles=a,b` to cut the hair styles). Since round 7 the renderer pixel ratio is pinned at 1.5 (requirements v0.6.2, "Test conditions for FR-89"), the screen scale factor stays 3 (the technical-artist's method; `--screen=1.5` reads whole render pixels and gives much higher figures), a warm-up case is thrown away, and the 8 s hint is waited out. Writes `<AUDIT_OUT or test-results/cr4-audit>/data/chromium-edge-contrast-dpr1.5.json`. Exit code 1 lists cells under 3:1 outside the final accepted class X-1 to X-5 (requirements v0.6.3, linen wall only; the audit now encodes it, and re-classifying the round 7 JSON gives 0 outside at 1.5); read the per-zone table in `docs/qa-report.md` round 7. Playwright empties `test-results/` at the start of a run, so set `AUDIT_OUT` to another folder.
- `ui-audit.mjs`, `lib.mjs`: UI measurement helpers shared by the audit.

Run Playwright against that preview with `PW_REUSE_SERVER=1 npx playwright test --project=<name>`, one project at a time. The suite is sensitive to host load: first-step timeouts in `beforeEach` and `checkbox did not change` clicks appear when the machine is busy and pass when the file is re-run alone.
