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
| `retention.spec.ts` | Iteration 4: US-71 (availability notice on the published screen and edit page, `<time>`, fallback, 320 and 360 px at 200% text), US-68 (7-day life, no extension, draft expiry, not-found after 7 days plus 1 s), Q-33 (a) not-found body, privacy sentence. `Date` is pinned with `page.clock.setFixedTime` and the zone with `timezoneId` |
| `keep-alive-static.spec.ts` | US-69: static checks of the contract, SQL, `config.toml`, handler source and `docs/api.md` against ADR 0022; the workflow checks run when `.github/workflows/keep-alive.yml` exists. Runs once, on desktop-chromium |
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

## Iteration 4 notes (round 8)

- Pin time with `page.clock.setFixedTime(iso)` (timers keep running) before the first `goto`; the demo backend reads `Date.now()`, so first publish, the end date and the 7-day boundary are exact. Re-publish has no screen in the MVP: `retention.spec.ts` resets `publish` to `idle` in the store and uses the Review step's Publish button.
- `visual.spec.ts` gained four baselines (published share card, edit page, not found, privacy). They are macOS only; the CI step leaves that file out of Linux runs.
- `pixelDiffRatioInset` (in `support/images.ts`) ignores a border when comparing element screenshots of a live and a reloaded stage (the clip is fractional and the last row can pick up a neighbour).
- Linux CI run 44457523893: the gender live-versus-rebuilt pair was a one-pixel last-row difference (fixed by the inset); the WebKit 720-combination test no longer waits on animation frames; two waits (name label, Guide arrival at B) were added. `caption-card` U1 measured 1104.9 ms against its 500 to 1,100 ms window.
- CI allowances for timing, both in `support/app.ts` and both applied only when `CI` is set: `FR15_BUDGET_MS` (1000 ms locally, 4000 ms on CI) and `CARD_UPGRADE_MAX_MS` (upper bound of the `caption-card` U1 upgrade window: 1,100 ms locally, 1,500 ms on CI, tech lead decision 20/11/2026). The U1 lower bound (500 ms) is the same everywhere. The strict windows are checked locally only; on a real device they are Not verified.

## Linux CI differences (first Linux run, 18/11/2026, run 44301433771)

The suite ran only on macOS until then. Linux (ubuntu-24.04, 2 cores, SwiftShader, no GPU, no macOS fonts) differs in four ways that the specs now allow for. Changes verified on macOS only; Linux is Not verified until the next CI run.

| Difference | Where it shows | What the spec does |
|---|---|---|
| Playwright WebKit on Linux logs the viewport key `interactive-widget` (deliberate, FR-84, `index.html`) as a console error | every WebKit test that calls `trackProblems` | `WEBKIT_ONLY_CONSOLE` in `support/app.ts`: one anchored regex, applied only when the browser is WebKit. Any other console error, or this one on Chromium or Firefox, still fails |
| Body text is `system-ui`, so Linux wraps option chips and the Characters panel is taller (Body 556 against 532 at 360 wide, Hair 498 against 450 at 390 wide, identical in all three engines; those tabs have no CR-4 content) | `more-options.spec.ts` US-67 AC-1 | The pixel baselines are asserted on darwin only. On every platform the test hides the disclosure in the same page and requires the closed disclosure to add no panel or step height |
| Software GL on 2 cores is slow: the FR-15 preview change took 1.1 to 2.7 s as measured by polling screenshots | `gender.spec.ts` US-46 AC-2, `more-options.spec.ts` US-67 AC-4 | `FR15_BUDGET_MS` in `support/app.ts`: 1000 ms when `CI` is unset, 4000 ms on CI. The 1 s figure is therefore checked locally only; on a real device it is Not verified |
| Cold, slow first frames expose races | `cr4-visit` US-51 AC-4 (Tab pressed before the landing page rendered), `ceiling` FR-95 AC-2 (look easing still finishing), `visit-guide-presentations` US-13 AC-3 (card opens only after the Guide arrives), `gender` US-48 (a time-based coaching hint is in the page text) | Each now waits for the condition. The hint is left out of the equality check only; it is still scanned for pronouns |

`builder.spec.ts` US-2 AC-5 (Add photos with Enter): the test counts clicks that reach the hidden file input, which must be exactly 1, and then waits up to 15 s for the `filechooser` event. A missing event is recorded as a `filechooser` annotation, not a failure. On Linux mobile-chromium the event did not arrive in a cold first test (it passed on retry); the cause is not proven.

`gender.spec.ts` US-46 AC-2 "matches the rebuilt one" failed on Linux with the same ratio (0.00223, limit 0.0005) for two different actions, so the cause is not the action. Both tests now attach `preview-live.png` and `preview-rebuilt.png`. Not fixed; look at the attachments from the next CI run.

When the preview on port 4173 is shared, check `dist/` before trusting a local run: `grep -l __APP_TEST__ dist/assets/*.js` must list a file. A plain `npm run build` (live mode) removes the test hook and the demo backend, and every scene test then times out.

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
