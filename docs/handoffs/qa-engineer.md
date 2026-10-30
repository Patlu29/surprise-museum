# Handoff: qa-engineer

## Round 4 (fix round 1 re-test)

### Summary
Re-tested BUG-6 to BUG-10, the brow rule, N-6 timing, shown yaw, U7 and U8 at HEAD cf48e01 on desktop-chromium, mobile-chromium and mobile-webkit. BUG-6, BUG-7 and BUG-9 are fixed; BUG-8 is fixed on Chromium only (WebKit logged as new BUG-11); BUG-10 is still open (about 8 px overlap, marker restored); brows now show but are thin. U8 was my harness bug; U7 passes. Counts and details are in `docs/qa-report.md` (round 4).

### Files changed (tests and docs only)
- `tests/e2e/gender.spec.ts`: BUG-6 and BUG-8 markers removed; `stageShot` helper (whole-pixel scroll, clear of the sticky bar) and `sameLookLimit` (0.0005, or 0.03 on a fractional device pixel ratio); WebKit-only `test.fail` for BUG-11
- `tests/e2e/caption-card.spec.ts`: U8 watcher starts from the live region's current text (harness bug); BUG-10 marker restored with new numbers; overlap message includes the rectangles
- `tests/e2e/presentation-camera.spec.ts`, `support/presentation.ts`, `support/app.ts`: peak yaw measured per frame from `shownYawDeg` (`peakYawRate`), card timing from `guidePresenting`, reduced-motion 'cut' span in simulation time
- `tests/e2e/visual.spec.ts`: comment only; `brows-woman-deep-skin.png` re-recorded (brows only)
- `docs/qa-report.md`, this note

### Decisions
- Re-recorded only the brows baseline; the entrance and finale diffs were Guide pose or timing, not brows.
- A fractional-DPR tolerance for "same look" comparisons rather than a baseline change.

### Assumptions
- The decision for N-6 is the cap from max(dwell completion, Guide arrival); "never before the camera settles" is asserted separately.

### Open questions
- Woman brow 0.90 against 0.95 or 1.00 (tech lead): no visible difference at any size I looked at; thickness for all genders is the real lever (see report).

### Requests for other agents
- scene-developer: BUG-10 (the Guide rectangle with her label starts at y 183.9, the 124 px strip ends at y 192 at 360x640, scale 1.5). Then remove `test.fail(vp.width === 360, BUG_10)`.
- frontend-developer: BUG-11 (retry the preview import with a changed URL, or reload after the second failure, for WebKit). Then remove the WebKit `test.fail`.
- technical-artist: optionally thicken brows on deep skin for all genders if the one pixel line at default preview size is too faint.
- devops-engineer: standing items (Linux baselines, Firefox run, fewer workers; the suite is sensitive to a loaded machine).

---

# Round 3 handoff (kept for history)

## Round 3 (CR-1 gender, CR-2 presentation camera, CR-3 notice, caption card v1.4)

### Summary
Tested the three approved changes and the v1.4 caption card at HEAD 90d884b, tests only. Found five new bugs (three major: BUG-6 preview character jumps off its plinth after a gender or body type change, BUG-7 the card never upgrades, BUG-9 Close is cut off at 844x390; two minor: BUG-8, BUG-10). All are encoded as `test.fail` tests. Results, measurements, what I saw in the baselines and the brow check are in `docs/qa-report.md` (round 3). Totals: 670 passed, 0 failed, 41 skipped across desktop-chromium (230), mobile-chromium (223) and mobile-webkit (217), including 11 expected failures per project; 14 load timeouts of older tests passed on re-run.

### Files changed (tests and docs only)
- `tests/e2e/builder.spec.ts`: US-6 AC-1 and US-7 AC-1 now checks Body first, Gender group, and the Visitor Facial hair group (assertion inverted)
- `tests/e2e/gender.spec.ts` (new), `restored-notice.spec.ts` (new), `presentation-camera.spec.ts` (new), `caption-card.spec.ts` (new)
- `tests/e2e/accessibility.spec.ts`: 5 new axe tests
- `tests/e2e/visual.spec.ts`: 8 new tests; `presenting-photo-1.png` re-recorded (only that one, CR-2 by design); 6 new baselines
- `tests/e2e/support/app.ts` (draft seeding, demo-database edits, gender helpers, `onCharacters` hook in `createMuseum`), `support/presentation.ts` (new: camera recorder, card measurement, `fixRects`), `support/images.ts` (PNG decode and pixel diff)
- `tests/README.md`, `docs/qa-report.md`, this note

### Decisions
- Gender previews are baselined from a restored draft, not after a click, so the baselines do not record BUG-6.
- Peak yaw is derived from `yawOffsetDeg` and the move time (the hook has no shown yaw), and labelled as derived.
- Card-timing checks use "later of camera settled and Guide arrived", and report time from dwell completion as an annotation (N-6) rather than failing on the literal 1.5 s.
- Upgrade-rule fixtures replace `screenRects` fields with getters; the scene's own writes are ignored.
- Bug-documenting tests use `test.fail` (project convention).

### Assumptions
- Tolerances from docs/project-status.md (0.98 / 0.99 / 0.99 / 0.90 visible fraction, 80 in and 101 out).
- A museum with no `gender` is simulated by deleting it from the mock's IndexedDB record.

### Open questions
- N-6: is the 1.5 s card cap measured from dwell completion or from the Guide's arrival? (ux-ui-designer, frontend-developer). Measured 1.66 to 2.4 s from dwell completion.
- Face difference between genders is almost invisible at preview size; is that acceptable? (ux-ui-designer, technical-artist)

### Requests for other agents
- technical-artist and scene-developer: fix BUG-6 (preview rig loses its plinth offset after `setAppearance`). Then remove the two `test.fail(true, BUG_6)` lines in `gender.spec.ts` and add a baseline taken after a click.
- technical-artist: brows do not read on `skin-09` and `skin-10` with black or dark brown hair at the default preview size (spec 9.7); raise the Woman brow to 1.00 and lighten or thicken brows on deep skin.
- frontend-developer: BUG-7 (upgrade margin 16 px against a dock only 12 px below the top bar), BUG-9 (header does not fit in 256 px; Read more strip needs 288 px), BUG-8 (Try again must recreate the lazy preview). Then delete the matching `test.fail` lines.
- scene-developer: BUG-10 (framing reserves a 104 px strip but the strip is 124 px at caption size 1.5); expose `shownYawDeg` in `snapshot().presentationCamera` so peak yaw can be measured per frame.
- devops-engineer: still standing: Linux baselines (the new gender and presenting baselines are macOS only), Firefox run, and fewer workers if WebKit visit tests time out (six timed out once under load at 3 workers and passed on re-run).

---

# Round 2 handoff (kept for history)

## Round 2 (fix round 1 re-test)

### Summary
Re-tested BUG-1 to BUG-5 at HEAD e3aacf3 on desktop-chromium, mobile-chromium and mobile-webkit: 440 passed, 0 failed, 25 skipped (project-specific). BUG-1 to BUG-4 are fixed and verified; BUG-5 is accepted as upstream (ADR 0018). Typecheck, lint, build and 563 unit tests pass. Firefox still cannot run in the sandbox. Details in `docs/qa-report.md` (round 2 section).

### Files changed (round 2, tests and docs only)
- `tests/e2e/builder.spec.ts`: `openBuilder` asserts a clean start (no draft key); US-6 AC-3 no longer a known bug; US-29 AC-1 retitled "(partial): names, text and characters restored" and made to check both names and a hair style; new "US-29 decision: photos are not persisted" and "fresh context has no draft" tests
- `tests/e2e/visit-ui.spec.ts`: US-33 AC-1 HUD check also at 320x568, 400x860, 440x900
- `tests/e2e/accessibility.spec.ts`: header comment (axe is a devDependency; a skip in CI means a failed setup), BUG-3 exclusions removed
- `tests/e2e/support/app.ts`: `KNOWN_WARNINGS` comment cites ADR 0018; `waitForSnap` waits for the scene hook (fixes a race in `csp-blob.spec.ts` on mobile-chromium)
- `docs/qa-report.md`, this note

### Decisions
- Test isolation relies on Playwright's fresh context per test, plus an explicit assert in `openBuilder`.
- Full US-29 photo restore is recorded as "not built, Release 2", not a bug.
- BUG-5 marked "accepted, upstream"; its allowlist entry stays until a stable R3F release replaces `Clock`.

### Assumptions
- The tech lead's decision (photos not persisted) stands, so the US-29 decision test asserts photos are absent after a reload.

### Open questions
- After a reload the builder reopens on the saved step with photos gone. Should it show a "your photos were not kept" notice? (product-manager decides, frontend-developer builds)
- N-2: is the Visitor covering part of the picture while presented intended? (ux-ui-designer)

### Requests for other agents
- None new. Standing: devops-engineer, run `npx playwright install --with-deps chromium firefox webkit` in CI, run `desktop-firefox` there, and make a Linux baseline set. If axe tests show as skipped in CI, the install omitted dev dependencies. Reduce Playwright workers if the Visit tests time out on a loaded runner (3 timeouts seen once on a loaded laptop).

---

# Round 1 handoff (kept for history)

## Summary
Phase 6 QA on the mock backend. I wrote end-to-end tests for every Must story and the MVP additions, ran them on desktop Chromium, iPhone 13 WebKit and Pixel 7 Chromium (410 passed, 0 failed, 15 expected failures documenting 5 bugs, 25 skipped), added 6 stable visual baselines, axe checks and an Android-keyboard emulation. Firefox is configured but cannot launch inside the agent sandbox, so it is not verified. Real-device items are all listed as not verified. Results and bugs are in `docs/qa-report.md`.

## Files changed
- `playwright.config.ts`: webServer builds with `VITE_API_MODE=mock npm run build -- --mode test`; adds `desktop-firefox`; SwiftShader args; baselines under `__screenshots__/<project>-<platform>/`; `PW_REUSE_SERVER=1` to reuse a server (off by default so a stale live build is never reused)
- `tests/README.md`: how to run, conventions, baseline rules
- `tests/e2e/*.spec.ts` (12 files): builder, visit welcome and roaming, Guide presentations, visit UI, share/edit/delete, home and demo, CSP blob, accessibility, mobile, Android keyboard, visual, journey
- `tests/e2e/support/`: `app.ts` (builder and visit helpers, console collector), `fixtures.ts`, `images.ts` (PNG generator, EXIF splice)
- `tests/e2e/__screenshots__/desktop-chromium-darwin/visual.spec.ts/`: 6 new baselines (first creation, none updated)
- `docs/qa-report.md`, this note

## Decisions
- `--mode test` build: exposes `window.__APP_TEST__` as the frontend handoff describes, without changing the CSP, base path or chunking. Production builds do not expose the stores.
- Known bugs are tests with `test.fail(true, 'BUG-n ...')`: the suite stays green and flags the fix. Remove the line when fixed.
- Time-based checks use the scene's simulation clock, not wall time, because software WebGL is slow.
- `openVisit` always does a fresh page load (via `about:blank`), as the recipient would; hash-only navigation had hidden init-script and state effects.
- Failure states the mock cannot produce are injected into the stores (upload failure, publish failure, open failure).
- `npm install --no-save @axe-core/playwright` was used locally; `package.json` is untouched. The axe spec skips cleanly without it.

## Assumptions
- US-6 AC-3 (Must) outranks FR-12 (Should) when judging BUG-1; product-manager should confirm.
- Playwright `tests/e2e` being type-checked by `tsc -b` (tsconfig.node.json, no DOM lib) is intended, so tests avoid DOM types.
- No sound exists in the MVP, so "no audio before Start" is checked as "no audio or video element".

## Open questions
- BUG-1: restore the whole draft (needs IndexedDB for photos) or only text and avatar choices? (product-manager, frontend-developer)
- N-2: is the Visitor covering part of the picture while presented intended? (ux-ui-designer)

## Requests for other agents
- frontend-developer: fix BUG-1 (draft and avatar persistence), BUG-2 (viewer Try again closes on pointer), BUG-3 (`aria-controls` to a missing id on the Guide and Visitor tabs), BUG-4 (HUD top row overflows at 412 px; Help cut off). Then delete the matching `test.fail` lines.
- ux-ui-designer: advise on the HUD breakpoint for BUG-4 and confirm N-2.
- architect: add `@axe-core/playwright` as a devDependency (root config is yours), so the accessibility spec runs in CI. Note BUG-5 (`THREE.Clock` warning in production, library) for the next three or r3f upgrade. Note tests are type-checked in `npm run build`, so a broken test breaks the deploy build; consider a separate `tsconfig` for `tests/e2e` if that is not wanted.
- devops-engineer: CI must run `npx playwright install --with-deps chromium firefox webkit`, and the visual baselines need a Linux set made in the same container image (current ones are macOS). Run `desktop-firefox` there, since it could not run here.
- scene-developer: confirm that the app never calls `readPixels` itself (note N-1), and the label-behind-wall behaviour (US-10 AC-3) is only unit-level today.
- performance-optimiser, devops-engineer: the performance.md section 7 real-device plan, HEIC and 24 or 48 MP photos, VoiceOver and TalkBack, and a real Android keyboard check are still to be done on devices.
