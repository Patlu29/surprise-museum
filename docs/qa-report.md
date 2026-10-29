# QA report: Surprise Museum

## Round 2 (fix round 1 re-test), 29/10/2026

Tested at HEAD e3aacf3 plus the uncommitted test changes. Owner: qa-engineer.

### Summary (round 2)

| Item | Result |
|---|---|
| Playwright, full run on `desktop-chromium`, `mobile-chromium`, `mobile-webkit` | **440 passed, 0 failed**, 25 skipped (project-specific, same reasons as round 1), 0 `test.fail` markers left. Total 465. Round 1 was 410 passed plus 15 expected failures |
| How the 440 was reached | The full run gave 433 passed and 7 failed. Six of the seven were my own test problems or load flakes (see below); all were re-run and pass. Files changed after the full run (`waitForSnap` hook wait, exact `Back` in one test) were re-run on all three projects for the affected tests only, not in a second full run |
| New tests | +3 HUD widths x 3 projects (9), +2 US-29 tests x 3 projects (6), net of the retitled one. Round 1 expected failures now pass as normal tests |
| `npm run typecheck`, `lint`, `build`, `npm test` | All pass (563 unit tests, 44 files) |
| Accessibility spec | **Runs, not skipped** (`@axe-core/playwright` 4.14.0 is now a devDependency). No violations; the BUG-3 axe exclusions were removed so the Characters step is checked in full |
| `desktop-firefox` | Still **not run**: Firefox cannot start in the agent sandbox. Firefox `blob:` check not verified |
| Open bugs | **0 new, 0 still failing.** BUG-1 to BUG-4 fixed, BUG-5 accepted (upstream). Release 2 items and the open product question are listed below |

### Bug status

| Bug | Round 1 | Round 2 | Verified by |
|---|---|---|---|
| BUG-1 draft lost on reload | Major, open | **Fixed** (text, names, closing message, both avatars and step persist in `surprise-museum:draft:v1`; photos deliberately not kept, tech lead decision) | `US-6 AC-3: character choices survive a page reload`, `US-29 AC-1 (partial)`, `US-29 decision`, on all 3 projects |
| BUG-2 viewer Try again closes on pointer | Major, open | **Fixed** | `US-16 AC-5 (BUG-2)` click and tap, now a normal test, passes on all 3 projects |
| BUG-3 `aria-controls` to a missing id | Minor, open | **Fixed** (`#character-panel`) | `BUG-3 (fixed)` test; axe on the Characters step with no exclusions |
| BUG-4 HUD overflows at 412 px | Major, open | **Fixed** | `US-33 AC-1` at 412x915 and the new widths, all 3 projects |
| BUG-5 `THREE.Clock` warning | Minor, open | **Accepted, upstream** (ADR 0018, no code fix). Owner stays architect, to revisit at the next stable react-three-fiber release | Collector still allowlists exactly this one message and fails on any other WebGL, three or shader warning |

### What changed in the tests

- **Clean start.** Playwright gives every test a new browser context, so `localStorage` is empty at the start of each test and no test can inherit a draft. Because the draft is now persisted, `openBuilder` in `builder.spec.ts` also asserts that no `surprise-museum:draft:v1` key exists and that the builder is on Photos, so a leaked draft would fail loudly at the start. A hygiene test checks a fresh context has no draft. Tests that reload on purpose (US-6 AC-3, US-29) do so inside one test. Publishing clears the draft, so tests that publish then open the builder again in the same test still start clean. No regression from persistence was found in any spec.
- **US-29 AC-1 retitled.** It is now `US-29 AC-1 (partial): after a reload the names, text and characters are restored`, and it checks both names and the chosen hair style, not just one name. The old title promised photos and captions, which it never checked.
- **New: `US-29 decision: photos are not persisted`.** Asserts the stored draft has no photo or blob data and that after a reload the Photos step has no rows. This pins the tech lead decision, so a later change (Release 2 photo restore) shows up as a deliberate test change.
- **HUD widths.** US-33 AC-1 now runs at 360x640, 390x844, 412x915, plus **320x568, 400x860 and 440x900**. 320 px was previously only checked by calculation; it now passes measured. 400 and 440 px sit on both sides of the 400 px label breakpoint.
- **Robustness fix.** `waitForSnap` now waits for the scene hook to exist before the first snapshot. `csp-blob.spec.ts` failed twice on `mobile-chromium` with "Cannot read properties of undefined (reading 'snapshot')" because the first snapshot was taken before the museum canvas mounted. This was a test race, not an app bug; it passes 2 of 2 on each project after the fix.
- **Comments.** `KNOWN_WARNINGS` now cites ADR 0018 (BUG-5 accepted, upstream) and says when to remove the entry. The `--no-save` wording in `accessibility.spec.ts` is replaced: axe is a devDependency, and a skipped axe test in CI means a failed setup, not a pass.
- No baseline was updated. The 6 visual baselines matched.

### Flakes seen in the full run

Three `desktop-chromium` visit tests (US-16 AC-4/AC-5 and its two Try again variants) timed out waiting for the Guide at 90 s while I was also running the unit tests, so the machine was loaded. All three pass on a re-run on all projects (about 10 s each). Not an app issue; if it recurs in CI, lower the worker count.

### Not built, Release 2 (not bugs)

| Item | Status |
|---|---|
| US-29 AC-1, photos and captions restored after a reload | **Not built, Release 2** (needs IndexedDB). Only the partial restore (names, text, characters, step) is built and tested. US-6 AC-3 (Must) is met |

### Open product question (not a bug)

After a reload the builder reopens on the saved step with the photos gone. Steps 3 and 4 then show "Add at least one photo" issues. Should the builder show a notice such as "Your photos were not kept" when it restores a draft with no photos? Owner of the decision: product-manager. If yes, the change is small and belongs to the frontend-developer, and the `US-29 decision` test would need a line for the notice.

---

# Round 1 (original report, kept for history)

Phase 6 (QA), round 1. Tested at HEAD 720fdcd plus the uncommitted QA files. Date: 29/10/2026. Owner: qa-engineer.

## Summary

| Item | Result |
|---|---|
| Playwright, final full run (`desktop-chromium`, `mobile-chromium`, `mobile-webkit`) | **410 passed, 0 failed**, 15 expected failures (5 known bugs x 3 projects), 25 skipped (project-specific, reasons below), 0 flaky |
| Per project | desktop-chromium 138 pass / 5 known-bug / 7 skip; mobile-chromium 139 / 5 / 6; mobile-webkit 133 / 5 / 12 |
| `desktop-firefox` | **Not run.** Firefox 157 is installed and configured, but it cannot start inside the agent sandbox ("Could not find profile folder", even with a fresh profile). Run `npx playwright test --project=desktop-firefox` on a normal machine. The Firefox `blob:` check is therefore **not verified** |
| `npm run typecheck`, `lint`, `build`, `npm test` | All pass (556 unit tests). The tests are type-checked by `tsc -b`, so a type error in a test would fail the build |
| Console errors, uncaught exceptions, failed requests, WebGL warnings | None in the full journey, builder, preview, home or visit flows (asserted in `journey.spec.ts`, `builder.spec.ts`, `home-and-demo.spec.ts`). Known library noise is listed under notes N-1 and N-2 and BUG-5 |
| Open bugs | 5: 3 major (BUG-1, BUG-2, BUG-4), 2 minor (BUG-3, BUG-5) |

"Expected failure" means a test written with `test.fail(...)` that documents a bug: the suite stays green, and goes red ("expected to fail but passed") as soon as the bug is fixed, which is the cue to remove the `test.fail` line.

How it ran: `playwright.config.ts` builds with `VITE_API_MODE=mock npm run build -- --mode test` and serves with `vite preview` under `/surprise-museum/` (production CSP in force). `--mode test` only adds `window.__APP_TEST__` (the stores). Every test used the in-browser demo backend (IndexedDB). No call was made to Supabase and no cloud resource was created. Chromium used SwiftShader (software WebGL), so no frame-rate or timing figure from these runs means anything for real devices.

## Results by story

All three browser projects gave the same result unless a note says otherwise. P = passed. "Part" = part of the criteria covered. Test titles start with the story and criterion (for example `US-12 AC-3`), so `npx playwright test -g "US-12"` finds them.

### Must stories (MVP)

| Story | Criteria tested | Result | Notes |
|---|---|---|---|
| US-1 start without account | AC-1, AC-2, AC-3 | P | AC-3: loading screen shown while the builder chunk is held back. AC-2 at 360 px: no horizontal scroll on any step |
| US-2 upload photos | AC-1 to AC-5 | P | AC-3: network failure is injected into the store (the demo backend never drops a connection); only the failed photo re-sent, the others kept their server ids. AC-4: a JPEG with an EXIF GPS segment comes out of the pipeline with no `Exif` or `GPS`. AC-5 skipped on WebKit (no file-chooser event) |
| US-3 order and captions | AC-1 to AC-4 | P | Earlier and Later, keyboard grab and move, pointer drag. 280 limit counts emoji as one. Touch long-press (AC-5) is not tested: reorder is immediate by design (frontend handoff); pointer drag tested with a mouse, touch drag **not verified** |
| US-4 names | AC-1 to AC-4 | P | 24-character limit, required messages, accents and emoji exact |
| US-5 closing message | AC-1 to AC-3 | P | 1,000 limit; blank gives "The end"; line breaks preserved on the finale card |
| US-6 Visitor customiser | AC-1, AC-2 (keyboard), AC-4, AC-5 | P | AC-3 fails: **BUG-1**. "Updates within 1 second" for the 3D preview is **not verified** (software GL). Option counts meet or beat the minimums (8, 8, 8, 5, 3, 3) |
| US-7 Guide customiser | AC-1, AC-3 | P | Facial hair has none plus 3 or more styles; both names shown |
| US-8 preview | AC-1 to AC-4 | P | Full flow in preview (Start, presentation, finale), Exit preview returns to Review with all fields; missing minimum lists what is missing. "Identical to published" is Part: same code path (`VisitExperience`), not compared pixel by pixel |
| US-9 Visitor character | AC-1, AC-2 | P | Appears at the entrance after Start. AC-3 (second device) is **not verified**: the demo backend is per browser |
| US-10 names above heads | AC-1, AC-5 | P | Both labels visible, walk and idle states. AC-2 (always face camera), AC-3 (hidden behind a wall) and AC-4 (4.5:1 at 360 px) are Part: axe contrast passes on the HUD, but the label-behind-wall behaviour is **not verified** end to end (partitions fade and labels show through by design) |
| US-11 open and start | AC-1 to AC-5 | P | AC-5: the MVP has no audio element at all. AC-6 (4G within 5 s) is only checked on localhost (under 5 s); real 4G is **not verified** |
| US-12 Guide presents | AC-1 to AC-6 | P | Measured in simulation time: dwell 0.85 to 2.6 s; 3 m start, 4.5 m end, no flicker between; no caption gives no panel; far side of a wall gives no presentation; caption card does not cover the picture or Visitor at 360x640, 390x844, 844x390, 1280x720 and Close is at least 44x44 |
| US-13 quick movement | AC-1 to AC-4 | P | Includes under-1-second pass-by, switch A to B, nearest-only and re-present. "Does not walk if already beside" (AC-4 tail) not asserted |
| US-14 finale | AC-1 to AC-5 | P | Replay clears viewed count and returns both to the entrance; Keep exploring stays closed until she leaves the podium zone and re-enters. Reduced-motion "no celebratory motion" (AC-6): the finale card shows with no motion error, but the effect itself is a Should (US-20) and is not built |
| US-15 move around | AC-1 to AC-5 | P | W A S D and arrows (8 keys), partition wall stops her, doorway lets her through, side and back walls hold, drag rotates the camera, Q and E turn, joystick drag on touch devices |
| US-16 view picture | AC-1 to AC-5 | P, one bug | Click and tap on the 3D picture, Look closer, Close and Escape, wheel zoom and keyboard zoom, pinch zoom on Chromium (two real touch points), placeholder then image, error with Try again by keyboard. Try again by **pointer closes the viewer: BUG-2**. Wheel test skipped on iPhone WebKit (no wheel support) |
| US-17 layout | AC-1 | P | Entrance, gallery, finale; pictures in order, no shared zones, alternating walls. AC-2 (aspect ratio) and AC-3 (even light, no glare) are Part: mixed portrait, landscape and square photos are used, but correctness is judged by eye on the visual baselines only |
| US-22 publish | AC-1 to AC-5 | P | Consent needed, terms linked, links shown, Copy confirms (clipboard read in Chromium), edit-link warning and acknowledgement gate Finish, no double publish, failure keeps work and offers Try again (failure state injected) |
| US-23 private link | AC-1 to AC-3 | P | `noindex, nofollow` on every route, generic `og:` tags only, one-character change gives "not found", nothing revealed, no lists, edit token never in web storage. AC-4 (rate limit) is a backend behaviour and is **not tested** (demo backend) |
| US-24 delete | AC-1, AC-2 | P | Second-step confirmation (Cancel focused by default), then both links show "not found". AC-3 (removed from storage within 7 days) is **not tested** (backend job) |
| US-30 loading and failures | AC-1, AC-3, AC-4 | P | Loading screen with progress; failed picture shows Retry chip, Guide still presents the caption, she can roam, Retry recovers; "couldn't open" Try again recovers without reload. AC-2 (placeholder while loading) is **not verified**: demo photos load instantly. AC-5 (4G, nearest-first) **not verified** |
| US-31 WebGL | AC-1, AC-3 | P | No-WebGL message and home link; context loss shows "The 3D view stopped" with Reload, which reloads. The slideshow (AC-2) is Should and not built |
| US-32 keyboard and motion | AC-1, AC-2, AC-3 | P | Whole visit by keyboard (Start, move, Pictures list, Look closer, Escape, finale, Replay); focus ring on every control on the review step; reduced motion: Guide fades in, never plays the walk while approaching, camera does not move; axe passes. Manual WCAG 2.2 AA review is **not verified** |
| US-33 portrait and landscape | AC-1 to AC-4 | P, one bug | Rotation keeps position, viewed count and open caption without reload; 44x44 targets at 360x640; joystick inside the screen. HUD is cut off at 412 px wide: **BUG-4** |
| US-42 Guide follows | AC-1, AC-2, AC-4, AC-5, AC-6 | P | Within about 5 m while walking, not between her and the picture, reappears beside her when far away, never inside a wall during a long walk. AC-3 (moves aside from her path) not asserted; covered by the NFR-26 soak in unit tests |
| US-45 live-ready | AC-3 | P | No WebSocket or non-local request during the full journey. AC-1, AC-2, AC-4 are covered by the unit tests (556 pass), not by e2e |

### Should stories and MVP additions

| Story | Result | Notes |
|---|---|---|
| Arrow buttons (WCAG 2.5.7) | P | Selecting Arrow buttons removes the joystick; press and hold walks, turn buttons turn the view, each button is at least 44x44 |
| US-44 Pictures list (FR-36) | P | Jump to a picture, Guide presents it, "Viewed" in words, keyboard (P, Tab, Enter), Finale entry. Tab test skipped on iPhone WebKit emulation (it does not Tab to buttons) |
| Home footer "Report a problem" | P | Opens https://github.com/Patlu29/surprise-museum/issues in a new tab with `noopener noreferrer`; no "Sales" line remains |
| Demo storage notice | P | Shows on the Photos and Published screens, storage figures, Clear demo data behind an alertdialog with Cancel focused, builder re-uploads after clearing. The "storage full" (413) path cannot be reached with a 200 MB cap, so it is **not verified end to end** (unit-tested by the frontend) |
| US-25 edit page | Part | MVP is view and delete only (frontend handoff). Photos, names and share link shown; the share page has no editing controls. Editing and saving changes is not built |
| US-29 draft restore | Fails | **BUG-1** |
| US-34 settings | Part | Larger caption text applies at once; Reduce motion sets `data-motion`. Screen reader announcement of captions is **not verified** (no screen reader) |
| US-35 hint, progress | P | Hint is keyboard-operable, does not move her or the camera and fades; progress counts 0 to 4; "To the finale" after all viewed |
| US-43 | Part | AC-1 label only. AC-2 (ask before showing the message) is not built (default Q-21 applies: the podium triggers the message) |
| US-18, 19, 20, 21, 26, 27, 28, 36 to 41 | Not tested | Not built in this release, or not in scope. US-28: the Share button only appears when the browser supports it; Copy tested only |

### Cross-cutting checks

| Check | Result |
|---|---|
| Accessibility, axe-core (WCAG 2 A and AA, 2.1, 2.2 AA) | Home, Privacy, Terms, not-found, builder steps 1 to 4 (including error states and the consent error), Published, edit page and delete dialog, welcome, HUD, caption card, Pictures, Settings, Help, viewer and finale card: **no violations** except BUG-3. `@axe-core/playwright` is **not** in `package.json` (I may not edit it), so I installed it with `--no-save`; without it these tests skip. See requests |
| Visual regression | 6 baselines (desktop Chromium, reduced motion, 1280x720, DPR 1): home, welcome card, entrance, Guide presenting picture 1, finale card, picture viewer. Three consecutive runs matched at 0.002 (2D) and 0.02 (3D) thresholds. Baselines are **new** (first run, nothing to compare); no baseline was updated to pass a test. Made on macOS, so CI needs its own set |
| `blob:` photos under the production CSP | Passed in Chromium and iPhone WebKit: thumbnails decode, review thumbnails decode, preview and Visitor wall textures reach `loaded`, **zero** `securitypolicyviolation` events. **Firefox not verified** (cannot launch here) |
| Android keyboard (`interactive-widget`) | See "Android keyboard" below |
| Mobile viewports | iPhone 13 (WebKit) and Pixel 7 (Chromium) projects, plus 360x640, 390x844, 412x915, 844x390 and 320 px reflow |
| Console, WebGL, network | Clean. No third-party request on the home, builder or visit (NFR-13) |

## Android keyboard

Checked by emulation only. Playwright cannot raise an on-screen keyboard, so on the Pixel 7 project the test shrinks the viewport by 320 px, which is the layout viewport Android Chrome produces under `interactive-widget=resizes-content`.

Verified: the built `index.html` contains `interactive-widget=resizes-content` and does not disable zoom; with the viewport shrunk, the focused caption, name and message fields sit above the sticky Next and Back bar, the bar stays on screen, and the 3D preview shrinks with the viewport (at most 55% of the new height) while the options stay reachable.

**Not verified** (needs a real Android phone): that Chrome and Firefox for Android actually apply the meta tag, behaviour with a real keyboard and suggestion strip, `visualViewport` changes, split-screen and floating keyboards, and iOS Safari (which ignores the setting and shows the keyboard over the page).

## Real-device items (performance.md section 7): not verified

None of these was run. There is no real device here, and a headless SwiftShader run proves nothing about them.

| # | Item | Status |
|---|---|---|
| 1 | Frame rate (NFR-1): 60 s roaming on iPhone 12, Galaxy A54, 2022 laptop | Not verified |
| 2 | Tier decision (phones pick Low, laptop High, GPU name list) | Not verified. Only the emulated phone, SwiftShader and the M4 were seen by the performance-optimiser |
| 3 | Load on 4G (NFR-2, NFR-3) | Not verified. Local timing only |
| 4 | Memory over 15 minutes, 20 viewer opens, Replay | Not verified |
| 5 | Thermal and battery over 10 minutes, 30 FPS cap | Not verified |
| 6 | High-refresh displays (120 Hz) | Not verified |
| 7 | iOS 15 to 17 Safari image resize | Not verified |

Also not verified: real HEIC files and a real 24 or 48 MP iPhone photo (the 3 MB lazy decoder), VoiceOver and TalkBack, 200% zoom visual review, forced colours, the live Supabase backend (including a real iPhone photo upload and `confirm-photo` accepting the client's JPEG stripper output), live-mode CSP with the Supabase origin, and touch drag-to-reorder.

## Bugs (round 1 text; statuses are in the round 2 table above)

### BUG-1: The draft is lost on reload, including character choices
- Severity: **major** (breaks a Must criterion, US-6 AC-3; also US-29, a Should)
- Owner: **frontend-developer** (product-manager to confirm which wins: US-6 AC-3 is Must, FR-12 draft restore is Should and `builderStore.ts` says "memory only in the MVP")
- Steps: open `#/create`, add a photo, Next, enter a name, Next, choose another hair style, then press reload.
- Expected: photos, captions, names and avatar choices are still there (US-6 AC-3, US-29 AC-1).
- Actual: the builder starts empty; every choice is gone.
- Evidence: tests `US-6 AC-3 (BUG-1)` and `US-29 AC-1 (BUG-1)` in `tests/e2e/builder.spec.ts` (marked `test.fail`). Photos are blobs, so restoring them needs IndexedDB. A cheaper option is to persist the text fields and avatar choices only.

### BUG-2: "Try again" in the full-screen viewer closes the viewer when pressed with a mouse or finger
- Severity: **major** (US-16 AC-5: the Retry control does not retry)
- Owner: **frontend-developer**
- Steps: open a picture whose full image fails to load (for example block the image request), then click or tap "Try again".
- Expected: the picture is requested again and the viewer stays open.
- Actual: the viewer closes and no second request is made. By keyboard (Enter on the button) it works.
- Cause (from `PhotoViewer.tsx`): the error panel sits inside the stage whose pointer handler treats any press that is not on the image as a tap on the dark background and calls `onClose` after the double-tap delay. Stop the event at the error buttons or ignore presses on buttons.
- Evidence: `US-16 AC-5 (BUG-2)` (expected failure) and the passing keyboard variant in `tests/e2e/visit-ui.spec.ts`.

### BUG-3: Guide and Visitor tabs point `aria-controls` at an element that does not exist
- Severity: **minor** (axe reports it as critical `aria-valid-attr-value`, but no visible effect; screen readers may skip the relationship)
- Owner: **frontend-developer**
- Steps: open the Characters step and inspect `#character-tab-guide`: `aria-controls="character-panel-guide"`, and no such id exists (only the section tabs have a panel).
- Expected: `aria-controls` is omitted or names a real panel.
- Evidence: `BUG-3` test in `tests/e2e/accessibility.spec.ts` (expected failure). The other axe checks exclude those two elements so the rest of the step is still checked.

### BUG-4: The HUD top row overflows at 412 px wide; the Help button is cut off
- Severity: **major** (Help is unreachable on a Pixel 7 sized phone, the default size of the `mobile-chromium` project; 360 and 390 px are fine)
- Owner: **frontend-developer** (ux-ui-designer for the breakpoint; the labels "Pictures" and "Where next?" wrap and push the row wider)
- Steps: open a museum at 412x915, press Start, look at the top right.
- Expected: Pictures, Where next?, the progress pill, Settings and Help all fit (US-33 AC-1).
- Actual: Help starts at x=384 with width 44, so it ends at 428, 16 px past the edge.
- Evidence: `US-33 AC-1: every HUD control is fully on screen at 412x915 (BUG-4)` in `tests/e2e/visit-ui.spec.ts` (expected failure); the screenshot shows the clipped button.

### BUG-5: `THREE.Clock` deprecation warning in the production console
- Severity: **minor** (library noise, no user impact)
- Owner: **architect** (dependency upgrade) with **scene-developer**
- Steps: open any museum in the production build with the console open.
- Expected: a clean console. `docs/performance.md` section 5 calls this dev-only.
- Actual: `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` is logged in the production build too (react-three-fiber 9.8.2 with three 0.186).
- Handling: the test collector ignores this one message and fails on any other WebGL, three, shader or GLSL warning.

## Notes (not bugs)

- N-1: Chromium with SwiftShader logs "GL Driver Message ... GPU stall due to ReadPixels". The collector ignores it. It comes from the software renderer; confirm on a real GPU that the app does not call `readPixels` itself.
- N-2: In the presenting view the Visitor stands between the camera and the picture, so her body and name label cover part of the frame (see `presenting-photo-1.png`). That follows the composition design (camera behind her) and the caption card avoids the picture, but a Creator may be surprised that the picture is partly hidden. For the ux-ui-designer to confirm it is intended.
- N-3: On wide screens the builder photo list is a three-column grid, not one column. Drag-to-reorder works (tested), but it depends on pointer speed in a way tests found: a drag made of many events in one millisecond does not reorder. Real pointers are not that fast.
- N-4: The three headless projects ran 15 minutes for 450 tests with 3 workers. Each Visit test publishes its own museum (about 3 s); a shared storage-state fixture would cut that if the suite grows.
- N-5: The "Demo copy" notice and mock backend appear only because of `VITE_API_MODE=mock`; a real build shows none of it. The live Supabase path is untested here by design.

## Coverage gaps and decisions

- Mutating state (`teleportVisitor`, `standAtPhoto`) resets the presentation director, so tests that need continuity (hysteresis, finale suppression) use real walking (`walkVisitorTo`).
- Failure states the demo backend cannot produce (dropped upload, publish error, open error) are injected into the zustand stores in `--mode test` builds. They test the UI response, not the network layer.
- The EXIF test serves `index.html` without the CSP meta only so page code can read blob bytes. The CSP itself is tested separately.
