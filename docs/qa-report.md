# QA report: Surprise Museum

## Round 3 (CR-1 gender, CR-2 presentation camera, CR-3 notice, caption card v1.4), 30/10/2026

Tested at HEAD 90d884b plus the uncommitted test changes (tests only; no application code was touched). Owner: qa-engineer.

### Summary (round 3)

| Item | Result |
|---|---|
| Playwright, full run on `desktop-chromium`, `mobile-chromium`, `mobile-webkit` | **670 passed, 0 failed**, 41 skipped (project-specific). desktop-chromium 230, mobile-chromium 223, mobile-webkit 217. The passed count includes 11 expected failures (`test.fail`) per project that document bugs. The first full pass had 14 timeouts of older tests on a heavily loaded machine (WebKit took 57 minutes); all 14 passed when re-run alone, so they are load flakes, not product failures. Playwright reports them as failed in the single full run, so the table above is full run plus those re-runs |
| New and changed tests | `gender.spec.ts` (25 tests per project), `restored-notice.spec.ts` (9), `presentation-camera.spec.ts` (15), `caption-card.spec.ts` (20 incl. 4 fixtures for the upgrade rule), 5 new axe tests (3 of them the caption card), 8 new visual tests; `builder.spec.ts` US-6 AC-1 and US-7 AC-1 changed |
| `npm run typecheck`, `lint`, `test` | Pass. 734 unit tests |
| `npm run build` | Pass (`npm run build` after the run; three.js chunk 961 kB) |
| Accessibility (axe) | **Runs and passes** for the Body and Gender tab (Neutral, Woman, Man), the Visitor Face tab with facial hair, the notice on steps 1, 3 and 4, and the caption card (strip, then expanded with Read more) at 390x844, 844x390 and 1280x720 |
| `desktop-firefox` | Still **not run** (cannot start in the sandbox) |
| New bugs | **5**: BUG-6 (major), BUG-7 (major), BUG-9 (major), BUG-8 (minor), BUG-10 (minor). All are encoded as `test.fail` tests, so the suite is green and turns red when each is fixed |

`test.fail` count in the final run: 11 tests per project documenting bugs (see the bug list). They are counted as passed in the totals above, as in round 1.

### Visual baselines (round 3)

- **Re-recorded on purpose, one only: `presenting-photo-1.png`.** Reason: CR-2. Before, the camera sat behind the Visitor and her body covered the picture (note N-2). Now it is a three-quarter view with the whole green picture clear, Sam and Alex to its left, labels above the figures and the card top-right clear of everything. I looked at the new image; it is the intended view. The card shows the Look closer icon without text at 1280 because the card is 358 px, under the 24 rem at which the text label appears (spec 3.5), so that change is also by design.
- **Not re-recorded and still matching:** home, welcome card, entrance, finale, viewer. Neutral still matches the existing baselines. A museum stored with **no gender at all** (made by editing the demo database) renders pixel-identical to `entrance.png` (FR-75).
- **New baselines** (created with `--update-snapshots=missing`, desktop Chromium, macOS): `preview-woman-man.png`, `preview-man-woman.png`, `preview-woman-man-back.png`, `entrance-woman-man.png`, `entrance-man-woman.png`, `brows-woman-deep-skin.png`. The preview baselines are taken from a restored draft, not after clicking, because of BUG-6. Reloading a Woman and Man draft reproduces `preview-woman-man.png` exactly (US-46 AC-5).

What the baselines show. Woman (Guide in the first preview): narrower shoulders, a visible waist taper and fuller hips than Neutral, thinner limbs. Man: broader, squarer shoulders, straighter body, thicker arms. Neutral is the old shape. From behind in the entrance, the Woman Visitor shows a clear waist and hips and the Man Visitor a straight, wider back; the shapes are subtle but readable at the preview size. Measured difference between previews of the same Guide (share of pixels that differ): Woman against Neutral 1.3 to 1.8%, Man against Neutral 1.5 to 1.8%, Man against Woman 2.3 to 2.7%, and an old draft with no gender against Neutral exactly 0. The face difference (jaw, eyes) is almost invisible at preview size: at 4 times zoom the Woman, Man and Neutral faces look the same.

**Brow visibility check (design spec 9.7), Woman on `skin-10` and `skin-09` with black or dark brown hair: not met.** At the preview's default size no brows can be seen on either character (`brows-woman-deep-skin.png`: only eyes, blush and mouth read). At 4 times zoom a very faint dark line sits above the eyes on `skin-10` with black hair, and it looks the same in Woman, Man and Neutral. So the thin Woman brow is not the cause: brows on the deepest skin with dark hair do not read for any gender. On `skin-01` with white hair the brows are visible as light grey lines for all three genders. Spec 9.7 says to raise the Woman brow value to 1.00 if they do not read; I would also lighten or thicken them on deep skin for all genders. Owner: technical-artist (minor, BUG-8 does not cover this, see N-7).

### Results by change

#### CR-1: gender (US-46, US-47, US-48, ADR 0020)

| Story and criterion | Result | How |
|---|---|---|
| US-6 AC-1, US-7 AC-1 (changed) | **Pass** | Body is the first tab and selected; Visitor now has Facial hair (the old `toHaveCount(0)` is inverted: none plus 4 styles); Gender group has 3 options; body type reads Slim, Regular, Wider hips, Wider shoulders, with no "curvy" or "broad" on screen |
| US-46 AC-1 | **Pass** | Woman, Man, Neutral in that order, Neutral selected for both characters, Gender is the first group, helper text shown and linked by `aria-describedby`; Next goes to Review with no choice made |
| US-46 AC-2 | **Pass, with BUG-6** | Store holds feminine, masculine, neutral; description says "woman," or "man," only when not Neutral; each character keeps its own value across tabs. Preview changes **within 1 s**: first changed frame at 99 ms (desktop Chromium), 153 ms (Pixel 7), 80 ms (iPhone WebKit), software GL, reduced motion. The three shapes differ and Neutral equals an old draft. **BUG-6: the changed character jumps off its plinth** |
| US-46 AC-3 | **Pass** | With 8 non-default choices set, cycling Woman, Man, Neutral, Woman changes only `gender`; every group keeps its option count and no option is disabled. Man in a dress and Woman with a full beard can be built. Reset returns the active character to Neutral and the starting look |
| US-46 AC-4 | **Pass** | `role=radiogroup` with a label, roving tabindex, one Tab from the Body tab lands on it, arrows, Home and End move and select and wrap, Space selects, Tab leaves for Body type, selection announced through the polite region after about 400 ms, no assertive region |
| US-46 AC-5 | **Pass** | Both genders restored in the controls and the preview description after a reload and a new document load; the preview equals `preview-woman-man.png` exactly. An unknown or wrongly typed stored gender restores as Neutral with every other choice kept |
| US-46 AC-6 | **Pass (WebKit: part), BUG-8** | While the preview chunk loads, and when it fails, the group works and the choice is saved. Recovery is checked after a new document load; **iPhone WebKit does not recover** (it remembers the failed module), so that step is skipped there (N-9). **Try again does not recover** (BUG-8). Without WebGL the description names the gender |
| US-47 AC-1 | **Pass** | All nine gender pairs published through the real builder and opened; the visit loads the chosen genders. Published avatars equal the builder's, field for field (round trip), including a Visitor with a full beard |
| US-47 AC-2 | **Pass** | Preview (Man Guide, Woman Visitor) has the same two avatars as the published copy |
| US-47 AC-3 | **Pass** | A stored museum with no `gender` (verified absent in IndexedDB) loads, reads as neutral for both, runs, presents and is not rewritten by being read; pixel-identical to the Neutral entrance baseline |
| US-47 AC-4 | **Pass (outcome only)** | The mock refuses `'Woman'`, `''`, `null`, `3` for the Visitor and `'male'`, `'FEMININE'` for the Guide: "Publishing didn't work" alert each time, no document stored, and valid values then publish. The error **field** `document.*Avatar.gender` and the message "Choose one of the available options." are **not verified** here: the UI shows only the generic "We couldn't publish your museum" text (backend unit tests cover the field) |
| US-47 AC-5 (older museum opened for editing) | **Not applicable** | The edit page is view and delete only (no customiser), so there is no editing path to test |
| US-48 AC-1, AC-3 | **Pass** | Welcome, framed presentation and finale text (visible text and accessible names, minus the Creator's words and the floating name labels) for Neutral and Neutral, Woman and Man, Man and Woman: no he, she, her, him, his, hers, himself, herself, girlfriend, boyfriend; no "woman" or "man" in any visit text; the text is identical for the three pairs. The builder (home, steps 1 to 4, all four tabs for both characters) has no gendered pronoun either |
| US-48 AC-2 | **Pass** | A caption and closing message full of she, he, her, his and him show exactly as typed |
| ADR 0020 legacy draft | **Pass** | A v1 draft with no `gender` (and different hair, facial hair, body type, outfit and height) restores as Neutral with all of that kept, then saves an explicit gender with key and version unchanged |

#### CR-2: presentation camera (spec 6.12, v1.3 and v1.4)

Measured with the documented hooks, all four pictures of the test museum (both walls; landscape, portrait, square and wide), on all three projects.

| Viewport | Tolerance | Worst `pictureVisibleFraction` | Yaw offsets seen | Move in | Result |
|---|---|---|---|---|---|
| 360x640 | 0.99 | **1.000** | 35, 45 | 800 to 1,000 ms | Pass |
| 390x844 | 0.98 | **0.986** (picture 1, the same on all projects) | 35, 45 | 800 to 1,000 ms | Pass at the 0.98 tolerance; below the spec's 0.99 as the tech lead already accepted |
| 844x390 | 0.90 | **1.000** | 35, 52 | 800 and 1,156 ms | Pass |
| 1280x720 | 0.99 | **1.000** | 35, 45, 52 | 800 to 1,156 ms | Pass |

| Check | Result |
|---|---|
| Framed state reached, no fallback, the picture rectangle fully inside the viewport | Pass at all four viewports |
| Card absent while the camera is entering, pending or returning | **Pass** (no sample in any project showed a card in a moving mode) |
| Card present after settling | Present 156 to 294 ms after the later of "camera framed" and "Guide arrived". **But see N-6**: from the moment the dwell completes it takes 1.66 to 2.4 s, because the Guide takes about 1.5 to 2.1 s to arrive and the 1.5 s cap is timed from her arrival |
| Card clear of the picture (8 px), the Visitor and the Guide | Pass at the four viewports at scale 1; fails only at scale 1.5 on 360x640 (BUG-10) |
| Peak yaw speed | **Derived, not measured**: the hook does not expose the shown yaw. From `yawOffsetDeg` and the move time with the 1.57 sine-ease factor the move in peaks at 68.7 to 70.7 degrees per second (limit 80); the move out is asserted at 101 or less (tolerance) from the measured move-out time and the same offset, and passes. Not verified frame by frame |
| Movement releases the camera | **Pass** (390x844 and 1280x720): W releases it, `lastMoveOutMs` 300 to 1,000, the card and presentation continue, no further `entering` or `framed` for that presentation |
| Escape and Close return it | **Pass**: eased `returning`, then `follow`, card removed, director intent `none`, the same picture not presented again |
| Reduced motion | **Pass**: `cut` (about 300 ms) then `framed`, no `entering`, `lastMoveInMs` 0, the camera is at the framed pose on the first cut frame, no veil, a cut back with no `returning` |
| Veil on a swing over 60 degrees | **Pass**: view turned over 130 degrees with E, walked to the picture: veil reaches full strength, spans 250 to 1,000 ms, element is `aria-hidden` with `pointer-events: none`, the camera ends framed, and Reset view is offered after Escape. No veil on ordinary swings |

#### CR-3: "Photos aren't kept" notice (spec 5.17)

All 9 tests pass on all three projects.

| Criterion | Result |
|---|---|
| Shows after a reload with content and no photos | Pass: both lines, no alert role, no heading inside it, never takes focus, not saved in the draft |
| Not shown for a defaults-only draft | Pass: defaults (with or without gender), whitespace-only text and no draft at all show nothing; each of a title, a closing message, a gender, a Visitor beard and a later saved step shows it. Not shown for a draft started in the same page load |
| Add photos and Dismiss | Pass: Add photos only on steps 2 to 4, goes to step 1 and focuses its heading; Dismiss is 44 px, removes it for this load only, focuses the step heading, is silent, returns after a reload, and Escape does not dismiss it. The notice sits directly under the heading, above the preview and above the issues on step 4 |
| Polite announcement | Pass: once, after the step announcement, in the polite region; about 1.0 s after it, not the 600 ms the spec says (see N-8); not repeated on step changes |
| Disappears when a photo is added | Pass: gone when the photo row appears (before the upload finishes), silent, and does not return after the photo is removed |
| Layout | Pass at 320 px: no horizontal scroll, inside the viewport, not sticky |

#### Caption card v1.4 (spec 3.5)

| Criterion | Result |
|---|---|
| S1 readable caption | **Pass** at 390x844 and 1280x720 and 360x640; **fails at 844x390** only through BUG-9. Strip shows two lines (or one for a short caption), the first line is below the header and inside the card |
| S2 strip size | Pass: 104 px at scale 1 and 124 px at 1.5 (checked at 360x640, 390x844 where a strip is chosen), header 44 px, width at least 256 |
| S3 truncation and Read more | **Pass** on Chromium and iPhone WebKit: truncation detection is compared with the caption's real length measured on an unclamped copy, and agrees every time; Read more is 44 px, `aria-expanded` false, replaces Look closer, expands in place to Show less with focus kept; a caption that fits shows Look closer. **Line-clamp detection works in WebKit** |
| S4 controls | **Fails at 844x390** (BUG-9). Passes at 360x640, 390x844, 1280x720: Close is at least 44 x 44 and inside the card, no overlaps, the name never wraps by letter and is at least 5.5 rem, no horizontal scroll |
| S5 footprint | Pass at all four viewports at scale 1 (the card never touches the picture grown by 8 px, nor either character) |
| S6 fitted at 390x844 | Pass: fitted, 176 px (spec 168 plus or minus 16), at least three lines visible, top dock |
| S7 widths | Pass: 256 at 844, 280 at 932, 352 at 1,200, 358 at 1280, 288 at 1024 (the card is in the right dock; the landscape and wide cards' left edges are right of the framed picture and both characters). Note that on phone-sized touch projects the card at 844 and 932 is a strip, because the joystick blocks the fitted card |
| U1 upgrade after the blocker clears | **Fails: the card never upgrades (BUG-7)** |
| U5 no upgrade while focus is inside | The "held" half passes; the follow-up upgrade cannot happen (BUG-7) |
| U7 reduced-motion upgrade is instant | **Not verified**: needs an upgrade (BUG-7) |
| U8 an upgrade causes no announcement | **Not verified**: needs an upgrade (BUG-7). The placement loop's downgrade and the card's own changes do not touch the live region |
| G1 copy | **Pass**: the card's text and accessible names at all four viewports (strip, fitted, full) have no gendered pronoun; the only app strings are Read more, Show less, Look closer, Close caption and "Photo n of N" |
| U2 to U4, U6 | Not retested here (the developer's unit tests cover them) |

### Bugs (round 3)

#### BUG-6: In the builder preview, changing a gender or a body type moves the character off its plinth
- Severity: **major** (release blocker for CR-1: every gender choice triggers it, and it regresses Body type too; the visit is not affected)
- Owner: **technical-artist** (`src/scene/characters/kit/rig.ts`, `setAppearance` and the body rebuild) with **scene-developer** (`src/scene/characters/previewAvatar.ts`, `AvatarPreview.tsx`)
- Steps: open `#/create`, add a photo, Next, enter both names, Next. On the Body tab choose Woman (or Wider shoulders). Wait a second.
- Expected: the Guide changes shape and stays on the left plinth; the Visitor does not move.
- Actual: the Guide jumps to the middle of the preview, off its plinth. Choosing a gender or body type for the Visitor moves the Visitor to the same middle spot, so the two stack on top of each other. Hair, skin and height changes do not do it. The same choices restored after a reload are placed correctly. Reproduces with and without reduced motion. Likely cause (not confirmed): the rig is now kept for the life of the preview and `setAppearance` rebuilds the bind pose after the rig has a parent offset (the plinth's x), so the skinned body is drawn at the origin; before CR-1 the whole rig was rebuilt on every change.
- Evidence: `US-46 AC-2 (BUG-6)` tests in `tests/e2e/gender.spec.ts` (two expected failures, each project). Screenshots in the first exploratory run showed Sam beside Alex after one click.

#### BUG-7: The caption card never upgrades to a better size
- Severity: **major** (acceptance criterion U1 can never be met; user impact is a card that stays a small strip after a transient blocker, such as the Guide walking past)
- Owner: **frontend-developer** (`src/ui/overlays/chooseCaptionDock.ts`, `src/ui/overlays/Hud.tsx`)
- Steps: at any viewport, present a picture. Force a strip (a Guide rectangle blocking everything below it), wait 3 s, then clear the blocker so everything is free for 10 s.
- Expected: one upgrade to fitted or full after 600 to 800 ms (U1).
- Actual: it stays a strip for as long as I watched (10 s), with no rectangles at all. Cause: the top bar is a keep-out rectangle, the dock starts 12 px below it (`CLEARANCE_BELOW_BARS` is 12 in `Hud.tsx`) and the upgrade test grows every candidate by 16 px (`UPGRADE_CLEARANCE`), so every candidate touches the top bar and is never "clear". Measured at 390x844 and 1280x720: top bar bottom y 56, card top y 68. The first placement uses 8 px so it works. Fix: make the dock offset at least the upgrade margin, or do not grow the bars' keep-out by the margin.
- Evidence: `U1 at 390x844`, `U1 at 1280x720`, `U5`, `U7`, `U8` in `tests/e2e/caption-card.spec.ts` (expected failures).

#### BUG-9: At 844x390 the card header does not fit in 256 px and Close is cut off
- Severity: **major** (Close is unreachable by pointer on a typical phone in landscape when the strip with Read more is chosen)
- Owner: **frontend-developer** (`visit.css`, `MIN_CARD_WIDTH`), **scene-developer** informed (the framing right bound uses the same width)
- Steps: open a museum at 844x390 (phone landscape), use a caption longer than two lines (140 characters or more), stand at the picture.
- Expected: Close at least 44 x 44 and inside the card (S4).
- Actual: the card is 256 px wide at x 576. Fitted or full card: the header needs 260 px, so Close ends 4 px past the edge (792 to 836 against 832). Strip with Read more (the placement on a touch phone): the header needs 288 px, so Close sits at x 820 to 864, 32 px past the edge, and the screenshot shows no Close button at all. The spec 3.5 fallback says the developer may raise the minimum to 17 rem (272 px) and tell the scene-developer; that is not enough for the Read more strip (288 px), so give Read more an icon or shorten the header.
- Evidence: `S1 S3 S4 S5 at 844x390` and `S1 S2 S4 at 844x390` (expected failures, all projects).

#### BUG-8: Try again after a failed 3D preview load does not recover
- Severity: minor (existing behaviour, not a regression; US-6 and US-46 AC-6 promise it, and a reload works)
- Owner: **frontend-developer** (`src/ui/builder/AvatarPreviewSlot.tsx`)
- Steps: block the `AvatarPreview-*.js` request, reach the Characters step, see "We couldn't show the 3D preview", unblock the request, press Try again.
- Expected: the preview appears.
- Actual: the same message stays. `React.lazy` keeps the rejected promise, so every retry re-renders the same failed component. Create the lazy component per attempt, or retry the `import()`.
- Evidence: `US-46 AC-6 (BUG-8)` (expected failure).

#### BUG-10: At 360x640 with caption size 1.5 the strip covers the Guide's name label
- Severity: minor
- Owner: **scene-developer** (framing reserves only the 104 px strip) and **frontend-developer**
- Steps: 360x640, Settings caption size to the largest, stand at picture 1.
- Expected: the card does not intersect the Guide's rectangle (labels included), spec 3.5 with the presentation camera.
- Actual: the 124 px strip (y 68 to 192) overlaps the Guide rectangle (y 180 to 443, partly off screen on the left). The framing reserves the default 104 px dock.
- Evidence: `S1 S2 S4 at 360x640` (expected failure).

### Notes and questions (not bugs)

- **N-6 (open question, ux-ui-designer, frontend-developer):** spec 6.12 says the card appears "never later than 1.5 s after dwell completion". Measured from dwell completion (the director's intent) the card appears at 1.66 to 2.4 s: the camera is framed after 0.94 to 1.28 s, but the card waits for the Guide to arrive (1.5 to 2.1 s) and the cap starts at her arrival. Probably the intended behaviour (the card is the Guide's), but the 1.5 s wording is not met literally. The frontend handoff assumed "presentation set at dwell completion", which is not so.
- **N-7:** the brow check above is a minor technical-artist item.
- **N-8:** the notice announcement comes about 1.0 s after the step announcement (spec says about 600 ms). The two messages are not merged and the order is right, so harmless.
- **N-9:** iPhone WebKit does not recover a failed dynamic import after a new page load in the same test (it appears to remember the failure). Not investigated; may be a Playwright artefact of `route.abort`.
- N-2 (the Visitor covering the picture) is **resolved** by CR-2. The round 2 open question about a "photos weren't kept" notice is resolved by CR-3.
- Scale-dependent peak yaw, the Woman, Man and Neutral face shapes and the brow reading were judged by eye on software GL only.

### Not verified (round 3)

- Firefox (cannot start here).
- Real devices: framing on a real phone, the veil and cut feel, gender morph feel (the 250 ms morph is only checked through the reduced-motion path; the animated morph was not timed frame by frame), VoiceOver and TalkBack for the Gender group, the notice and the card.
- Peak yaw speed per frame (needs the shown yaw in the hook; request to scene-developer: add `shownYawDeg` to `presentationCamera`).
- The exact server error text and field for an unknown gender (UI shows the generic message); live Supabase with the new validator and deploy order.
- US-47 AC-5 (no editing path), U2 to U4 and U6 end to end, U7 and U8 until BUG-7 is fixed.
- The framed pose with a caption size above 1 on 390x844, 844x390 and 1280x720 beyond the S1, S2 and S4 checks.
- Pixel baselines are macOS only; CI needs its own set.

---

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
