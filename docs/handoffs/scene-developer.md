# Handoff: scene-developer

## Update 02/11/2026 (later): N-10 name labels on narrow screens, ceiling colour

### N-10 (spec 12.6.8)
- **Label clamp, de-overlap, hide (`src/scene/controllers/labelLayout.ts`).** Run last, after the BUG-10 `minTop` rule (unchanged) in `layoutLabels`:
  1. Each label is clamped so its left and right edges are at least 8 px inside the viewport (`clampShiftX`, `LABEL_EDGE_MARGIN`).
  2. If the labels still overlap, `separateShiftX` pushes them apart sideways by half the overlap plus an 8 px gap each, re-clamps, and gives any shortfall to the label that has room. Two 158 px labels always resolve at 360 px (tested). Never scaled, never truncated, never moved up.
  3. A label whose head anchor projects outside the viewport horizontally is hidden with `style.visibility = 'hidden'` (not `opacity`, which `CharacterView` owns for the line-of-sight fade) and omitted from the published rectangles. It is restored on the next layout or `resetLabels`. A partly visible body keeps its label. Note this hide is instant, not faded, because only opacity transitions in `NameLabelPill`.
  4. Precedence: the picture is cleared last; if clearing it and staying inside cannot both hold, the label may go up to 40% of its width past the margin edge (`LABEL_EDGE_OVERHANG`), and the label overlap rule then gives way.
  - `SceneDriver.publishRects` also clamps the published Guide label at her presentation spot into the viewport (that branch computes its own rectangle).
  - Safe-area insets are not read: the canvas rectangle is the viewport, the margin is 8 px. Landscape notches are not handled specially.
- **Solver label width (`src/domain/camera/presentationFraming.ts`).** `labelExtentWidth(label, body) = min(label width, body width + 32 px)`, used by `projectFramingRects` for both labels (the label's height and centre are unchanged). The solver's published `guideLabel` / `visitorLabel` rectangles are therefore narrower for long names; the scene's own labels are measured from the DOM as before.
- **Effect on the Guide fit set** (20 pictures x both Guide sides = 40 fixtures per viewport, a 158x68 three-line Guide label, Visitor 90x30):

| Viewport | Guide dropped before | now | worst `pictureVisibleFraction` before | now |
|---|---|---|---|---|
| 360x640, short names (control) | 0 of 40 | 0 of 40 | 1.000 | 1.000 |
| 360x640, long Guide name | 40 of 40 | 20 of 40 | 0.979 | 1.000 |
| 360x640, both names long | 40 of 40 | 20 of 40 | 0.865 | 0.995 |
| 390x844, short names (control) | 20 of 40 | 20 of 40 | 0.986 | 0.986 |
| 390x844, long Guide name | 40 of 40 | 40 of 40 | 0.986 | 0.986 |
| 390x844, both names long | 40 of 40 | 40 of 40 | 0.937 | 0.954 |

  So the width fix halves the drops at 360x640 and removes the picture-coverage loss, but it does not remove them. What remains is geometry, not label width: at 390x844 half the fixtures drop the Guide even with a short name (the picture plus the Visitor is already wider than the safe rectangle, from the 6.12.4 trace), and a long name adds the other half. The 390x844 "both long" worst case 0.954 is below 0.98 but is the solver's conservative figure (it counts label rectangles as covering the picture; the scene slides labels off the picture afterwards); the e2e tolerances (0.98 at 390x844 with the short fixture names) are unchanged and pass. Not changed: framing tolerances, timing, easing.
- **Seen in the browser** (software GL, both names 24 and 23 characters, caption size normal, pictures 1 to 3):
  - 390x844: both labels inside the viewport and apart in pictures 1 to 3 except where the Guide is dropped and off screen (pictures 1 and 3): her label is hidden (head off screen), the Visitor's label is inside (x 2 in picture 1, x -11 in picture 3: the Visitor's label is pushed 11 px past the left edge to stay clear of the picture; this is the picture-first rule).
  - 360x640: pictures 2 and 3 fine (labels at x 128 to 352 and 8 to 166). **Picture 1 is the rare conflict**: the Guide is dropped and sits to the right of the picture, her head is on screen at about x 336, and her 158 px label would cover the picture, so the picture rule wins and her label overhangs the right edge by 63 px (40%), clipped. QA's "fully inside" check will fail in that one case; making it hold needs the solver to keep her in the fit set there (framing, not placement). I did not find a placement that keeps the label clear of the picture, above the strip edge (BUG-10: never move up) and inside the viewport.
- **Tests:** `labelLayout.test.ts` (clamp, separation, symmetric, the 360 px worst case, the BUG-10 rule still holds with a 24-character Guide, hide and restore, partly visible keeps its label, picture before edge, size never changes), `presentationFraming.test.ts` (`labelExtentWidth`; Guide kept at least as often at 360x640; the 390x844 floor of 0.98 with a long Guide name; short names unchanged).

### Ceiling colour
`ceilingQuad` (`museumGeometry.ts`) now writes a `color` vertex attribute from `SCENE_PALETTE.ceiling` (read only; palette.ts already has #30232b). The ceiling material is the technical-artist's vertex-coloured material, which already supports opacity (set at runtime only while it fades). Test: the quad's colours equal the palette's linear colour. Visible effect: the ceiling seen from below is the palette's dark colour instead of a lit white albedo; in the entrance and presenting baselines it did not exceed the screenshot tolerance (they pass).

### Checks (02/11/2026, this task)
- Final state: `npm run typecheck` and `npm run build` (and the test-mode build) pass; `npm test` 1027 of 1028 pass; `npm run lint` has 2 errors, both in the technical-artist's uncommitted kit work (`kit/parts/hair.ts` and `kit/cr4.test.ts`, type-only imports). The one failing unit test is `src/api/__tests__/avatarOptionalFields.test.ts` (the builder hiding new outfit styles; not mine). Earlier in the task the kit work-in-progress also broke `tsc -b`, so the e2e bundle below was built with `npx vite build --mode test` (my files are the same).
- E2E after that build, `caption-card label-strip presentation-camera` on desktop-chromium and mobile-webkit: **84 passed, 0 failed** (includes the BUG-10 label-strip checks, the 0.98 picture visibility at 390x844 and the 80 in / 101 out degrees per second limits).
- `visual` on desktop-chromium: the 3D baselines (entrance, presenting, viewer, and both gender entrances) pass; 8 fail, all UI or character art from other roles' uncommitted work: home screen, welcome card, finale card (card text and layout; the 3D area of the diff is clean) and five builder-preview character baselines (kit changes).

### Requests
- qa-engineer: add the N-10 check from 12.6.8 (24-character names, 360x640 and 390x844: both labels inside the viewport, no overlap, picture clear); expect picture 1 at 360x640 to be the known overhang case above until the solver keeps the Guide there. `style.visibility` is `hidden` on a label whose head is off screen.
- ux-ui-designer: 12.6.8 rule 4 ("up to 40% past the edge") happens at 360x640 picture 1 with two long names; decide whether to accept it or to specify a vertical alternative (the label may move down over the character's head when the strip and the picture leave no room).
- technical-artist: the kit WIP above breaks `tsc -b` and 4 unit tests (not touched by me).


## Update 02/11/2026: the ceiling no longer blocks a high camera (user feedback)

### Cause
- The ceiling was a closed 0.1 m box over every room (`buildMuseumShell`, `ceilings`), with a top face that is visible from above. The orbit is pivot (0.9 m) + boom x sin(pitch), so a camera at the default 4.2 m boom is higher than the 3.2 m ceiling from a pitch of about 33 degrees, and at 6 m boom and 55 degrees it is at 5.8 m. From there the roof's top face filled the screen with the ceiling colour (reproduced at 1280x720: from pitch 34 degrees, camera y 3.26 m, the whole canvas is the ceiling; nothing else visible).
- Every way of raising the camera goes through `FollowCameraRig.applyInput`, which clamps pitch to 4 to 55 degrees and boom to 2.5 to 6 m: mouse or touch drag (0.25 / 0.3 degrees per px), Shift + Up/Down arrows (60 degrees per second), wheel, plus and minus (boom). Nothing else raises it: the presentation camera keeps 8 to 26 degrees and 0.3 m under the ceiling, Reset eases to 14 degrees. Keyboard note: Shift + ArrowDown raises the camera, ArrowUp lowers it.
- Below the ceiling nothing blocks: at a steep pitch the ceiling is not in the view (the top edge of the view is about 31 to 33 degrees above the look axis, so for pitch above about 33 degrees no ray points up), so a pitch-based fade would change nothing visible. The cause is purely the camera being above the roof.

### Fix (three parts, independent of each other)
1. **Culled from above.** `ceilings` is now one flat quad per room at y = 3.2, normal and winding facing down, with the existing front-side material. From above it is back-face culled, so it can never occlude and needs no sorting. No new mesh or draw call (the old box had 12 triangles per room, now 2). From below it renders exactly as the box's underside did.
2. **Fade by height (spec 6.3, v2.0 as committed).** `ceilingOpacityFor(cameraY)` in `src/scene/cameras/ceilingFade.ts` is `1 - smoothstep(H - 0.6, H - 0.1, y)` (H = 3.2: opaque at 2.6 m and below, clear from 3.1 m); no timer, so it follows the user's input and cannot flicker. The default camera is at most 2.35 m in every viewport class (tested with the real wall height and `computeComposition`), at least 0.85 m under the ceiling, so the default view is exactly as opaque as before and the "start at defaultCameraY + 0.1" fallback is not needed. Reduced motion: `ceilingReducedStep`, a hard step with hysteresis, off above H - 0.35 (2.85 m) and on below H - 0.55 (2.65 m), state kept between. Below an opacity of 0.02 the mesh is `visible = false` (not drawn: the top view makes 20 draw calls against 25 at the default pose). `CeilingFade.tsx` applies it each frame with no allocation; the ceiling is `transparent` (depth write off) only while partly faded and goes back to the opaque material at 1, like `PartitionFade`. It is one flat surface with nothing else transparent in front of it, so sorting cannot produce artefacts.
3. **Height cap.** `FollowCameraRig.update` limits the boom so the camera is at most 2 m above the ceiling (5.2 m): `boomLimitForHeight`. It trims only a long boom at a steep pitch (pitch 55 and 6 m boom: 5.25 m boom, camera 5.2 m instead of 5.8 m). The stored pitch and zoom are untouched (lowering the pitch gives the zoom back), the 4 to 55 degree range is unchanged, and the default boom (4.2 to 5 m) is never trimmed at 55 degrees. This is the "clamp" the coordinator asked for; the designer's spec says "do not clamp the pitch", which holds.
- The presentation camera is untouched (it composes from its own pose, 0.3 m under the ceiling, pitch at most 26), so `pictureVisibleFraction` and the 80 / 101 degrees per second limits are as before; the presentation-camera e2e result is below.

### QA hook
`snapshot().ceilingOpacity`: 1 at the default pose; falls to 0 as the camera rises (0 means not drawn); reduced motion is 0 or 1 only. `snapshot().camera.y` is the camera height. Measured on desktop 1280x720 (software GL, auto tier = low): y 1.92 and 2.35 give 1; 2.75 gives 0.78; 3.26 gives 0; pitch 55 with the default boom gives y 4.36 and 0. Reduced motion: 2.75 gives 1, 3.14 gives 0.

### Changes the other roles must know about
- **Ceiling roses and the finale oculus ring are no longer in the dressing.** `createCeilingRoseGeometry` builds them facing UP (a RingGeometry turned by -PI/2 has its normal on +Y), so the front-side decor material never drew them from inside the room (they were invisible before, so no baseline loses a rose). In the cutaway they would float as rings under the culled ceiling. Spec 6.3 says the rose fades with the ceiling, so it needs a facing-down rose and a fadable material. Request to technical-artist below; I will re-add them in `museumDressing.ts` when they exist.
- The ceiling quad has no vertex colour (as the old box had none), so `SCENE_PALETTE.ceiling` is not applied to it and its look from below is unchanged. If the technical-artist wants the palette colour on it, add a `color` attribute in `ceilingQuad` (`museumGeometry.ts`) or give me the helper. The ceiling material is the technical-artist's `materials.ceiling`; it already supports opacity (I set `opacity` and `transparent` on it at runtime, only while it fades).
- Wall tops are bare linen boxes, which show in the cutaway. Spec 6.3 / 12.8.3 has the technical-artist adding a 0.06 m `--look-dado-rail` cap.

### Files changed
- `src/scene/cameras/ceilingFade.ts` (new): opacity rule and height-cap maths (pure).
- `src/scene/cameras/ceilingFade.test.ts`, `src/scene/cameras/followCameraCeiling.test.ts` (new): the rule (default pose opaque in five viewports, clear near the ceiling, monotone, no step, draw threshold, the reduced-motion hysteresis), the cap at every pitch and boom, no change at the default boom, pitch and zoom untouched.
- `src/scene/objects/museumGeometry.ts`, `museumGeometry.test.ts` (new test): down-facing single quads (normals, winding, one per room, at 3.2 m, exact plan coverage).
- `src/scene/objects/CeilingFade.tsx` (new), `Museum.tsx`: apply the fade to the ceiling mesh.
- `src/scene/objects/museumDressing.ts`: roses removed (see above).
- `src/scene/cameras/FollowCameraRig.ts`: boom limited for height.
- `src/scene/runtime/SceneRuntime.ts`, `src/scene/controllers/testHooks.ts`: `ceilingOpacity`.

### Requests
- technical-artist: (1) `createCeilingRoseGeometry` faces up; make it face down (rotateX(+PI/2) or flip), and provide a way to fade it with the ceiling (own material with opacity, or a `uOpacity` on the decor glow material); the oculus ring too. (2) Optionally colour the ceiling with `SCENE_PALETTE.ceiling` (`createCeilingGeometry` has the colour attribute, but is a box; a down-facing quad is needed for the cutaway). (3) `palette.test.ts` currently fails against the designer's uncommitted `tokens.css` (`--scene-ceiling` #30232b against palette #3b2c33), which is the pending "update palette.ts" task, not this change. (4) The wall cap.
- ux-ui-designer: 6.3 could add one line for the height cap (camera at most 2 m above the ceiling; pitch range unchanged) and that the ceiling is single-sided (culled from above), which is why a pitch rule is not needed.
- qa-engineer: assert `snapshot().ceilingOpacity` (1 default; 0 at pitch 55 with the default boom), and `snapshot().camera.y`. Repro keys: Shift + ArrowDown raises the camera.


## Update (fix round 2, extra attempt): BUG-10, labels slide clear of the strip

- **Real cause (instrumented at 360x640, scale 1.5, 24-character name):** the solver picked its only valid candidate (-35 deg, pitch 12) with the Guide dropped from the fit set (`guideDropped`, `relaxed`). Her body was fine (top 259) but her label, wrapped to two lines (158 x 68 px), sat at y 183.9 to 251.9, under the strip (bottom 192). No other candidate was valid (picture minimum width against the Visitor and the safe height), so a framing-only fix cannot work; my first attempt (a strip band test in the solver) therefore changed nothing and is reverted.
- **Fix:** the strip is a reserved band, so on portrait during a photo presentation a name label that would sit above the strip's bottom edge slides down to it. `layoutLabels` takes a `minTop` (new `clampDown`, applied last, so after the picture shift and the collision rule); `SceneDriver.publishRects` computes it as `portraitStripBottom(caption scale)` (new export in `presentationFraming.ts`: 68 + 104/112/124, so 192 at 1.5) and applies the same shift to the Guide's label in the published Guide rectangle at her presentation spot (that branch ignored label offsets). The framing solver, tolerances and camera timing are unchanged. The label overlaps her head by a few pixels at worst, never the picture.
- **Tests:** `labelLayout.test.ts` (`clampDown`), `portraitStripBottom` in `presentationFraming.test.ts`. The e2e `test.fail(BUG_10)` marker and constant are removed from `tests/e2e/caption-card.spec.ts` (QA file, edited at the coordinator's request).
- **Results:** typecheck, lint, 870 unit tests pass; caption-card e2e 20 of 20 on desktop-chromium, mobile-chromium and mobile-webkit; presentation-camera e2e see report.
- **Request, ux-ui-designer:** add to 5.5 "Framed view": on portrait a label never sits under the caption strip; it slides down to the strip's bottom edge.

## Update 30/10/2026 (N-6): `surprise-museum:guide-presenting` event

`window` event `surprise-museum:guide-presenting`, `detail: { photoId, arrived }`, from `src/scene/cameras/guidePresentingTracker.ts` (pure, tested in `guidePresentingTracker.test.ts`) and dispatched by `PresentationCameraController.tick` once per frame at most per change:
- `arrived: false` when the director's intent becomes that photo (dwell completion, the Guide starts walking to the spot).
- `arrived: true` once per presentation when the Guide's mode becomes `present` (on the spot, the 1.5 s walking cap passed, or reduced motion placed her at once; in that case both events fire in the same frame, in order).
- The `photoId` is the same as the presentation's and the camera event's. A cancelled or replaced presentation sends nothing more for the old photo; Replay and jump reset the tracker. She relocating and returning does not send a second arrival.
- Order within a frame: the guide event is dispatched before that frame's camera event.
- QA mirror: `snapshot().presentationCamera.guidePresenting` is `{ photoId, arrived }` or `null` when nothing is being presented.

Checks (typecheck, lint, test, build) pass. Not run in a browser this round.


## Update 30/10/2026 (QA round 3 fix round 1): BUG-6, BUG-10, `shownYawDeg`

`typecheck`, `lint`, `test` (57 files, 861 tests) and `build` pass.

### BUG-6 (preview character jumps off its plinth): root cause and fix
- **Root cause (in the kit):** `refreshBones` in `src/scene/characters/kit/rig.ts` ends with `root.updateMatrixWorld(true); skeleton.calculateInverses();`. `updateMatrixWorld` uses the parent's last `matrixWorld`, so the bone inverses include every parent transform (the plinth offset, the three-quarter turn, the pair's yaw). The skinned meshes were bound when the rig had no parent (bind matrix without it). After a bind-pose rebuild (gender or body type) the inverses carry the parent transform and the body is drawn displaced by it: from the plinth to the origin. Hair, skin and height do not call `refreshBones`, and a rig built fresh in place is bound consistently (a reload). The rig root's own transform is never changed (that is why the e2e symptom looked like a jump). The per-frame `setGenderMorphProgress` hits the same path.
- **Fix in the kit (technical-artist, not applied by me):** compute the inverses with the rig root's parent treated as identity, for example in `refreshBones`: `const parent = root.parent; root.parent = null; root.updateMatrixWorld(true); skeleton.calculateInverses(); root.parent = parent;` (and `makeSkinned` should bind the same way, so a bind matrix never depends on the parent). Once that is in, the wrapper below can be dropped.
- **Fix now, in my code:** `src/scene/characters/previewAvatar.ts` runs `setAppearance` and `setGenderMorphProgress` through `withoutParent(root, ...)`, which does exactly that from outside. Verified with a unit test that fails without it (4 of 4) and passes with it: `previewAvatar.test.ts` builds the rig under an offset, turned plinth group, changes gender, body type, and both, and asserts the root position, scale and parent are unchanged and a skinned body vertex equals a fresh rig's; also frame by frame through an animated morph.
- **E2E:** QA's two `BUG-6` `test.fail` tests in `tests/e2e/gender.spec.ts` now report "Expected to fail, but passed" on desktop Chromium. I looked at the end-of-test screenshot: Sam (Woman) is on the left plinth with the brass ring, Alex on the right, no stacking. QA should remove the `test.fail` lines.

### BUG-10 (strip covers the Guide label at 360x640, caption size 1.5)
- `FramingInput.captionScale` (1, 1.25, 1.5); on portrait the safe rectangle's top is the larger of 30% and 64 px (top bar) + strip height (104, 112, 124) + 8 px. The controller reads the setting like the UI (`captionSize` normal 1, large 1.25, xlarge 1.5). At 360x640 with 1.5 the top is 196 px (was 192); at 390x844 the 30% line is already below the strip, so nothing changes there or at scale 1.
- Check: 20 pictures x both Guide sides at 360x640, scale 1.5: every fit rectangle top is at least 196 px, no fallback, worst `pictureVisibleFraction` 1.000. The framing is solved once per presentation, so a caption size change mid-presentation applies to the next one.

### `shownYawDeg`
`snapshot().presentationCamera.shownYawDeg`: the camera's yaw as shown, in degrees, from the actual look direction (atan2 of x and z), updated each frame. Sample it per frame for peak turning speed.

### N-6
No scene change: the events fire as before (`settled` on arrival or `follow` when no framing), which is compatible with measuring the 1.5 s cap from the later of dwell completion and Guide arrival.

### Requests
- technical-artist: the `refreshBones` fix above (then tell me and I will remove `withoutParent`).
- qa-engineer: remove the two BUG-6 `test.fail` markers; BUG-10 can be re-run at 360x640 with caption size 1.5.


## Update 30/10/2026 (round 3): rect tightening and the v1.4 right bound

`typecheck`, `lint`, `test` (712) and `build` pass.

### Cause of the blocked dock
The published character rects were already thin (body plus label). What blocked the card was (a) the Guide walking in: she takes about 2.5 s to arrive, the card's 1.5 s cap fires first, and a Guide passing close to the camera projects up to about 235 x 714 px, and the card's placement is then kept; and (b) the framing's 68% right bound reached x 870 at 1280 while the old card started at x 840.

### Changes
- `SceneDriver.tsx` `publishRects`: while the Guide is in `approach` or `present` for a photo, her published rect is the body plus label at her presentation spot (the spot the framing was solved for), not where she is passing. At the spot the two are identical. Visible effect: from the first published frame the Guide rect is stable (1280x720: x 687, y 141, 116 x 386, right edge 803) instead of 235 x 714 shrinking over 1.5 s. The Visitor rect is body plus label (about 129 x 440 at 1280, of which the label is 77 x 32 at the top). Rects are published at once when the camera arrives (already the case).
- Picture rect: frame only (outer frame corners, no padding): 257 x 233 at 1280x720, 207 x 184 at 390x844, 165 x 137 at 844x390.
- `presentationFraming.ts`: `CARD` constants mirror `--card-width-landscape` clamp(16rem, 30vw, 22rem), `--card-width-wide` clamp(18rem, 28vw, 26rem), `--card-min-width` 16rem and the edge margins (12 px landscape, 24 px wide). `framingRightBound` is R = min(68%, (card left edge - 8) / W); below 55% the Guide is dropped from the fit set first. The dock rect used by the solver is the card's real left edge on landscape and wide, and in portrait it ends 8 px above the safe rectangle (before, an 8 px growth made a picture at the top of the safe rectangle always "touch" the dock, so portrait was never a strict pass).
- Tests: R at 844, 667, 1280, 768; all framed rectangles stay left of the card.

### Results over the 20-picture fixtures (120 per viewport, no fallback)
| Viewport | Worst `pictureVisibleFraction` | Target | Right-most framed edge | Card left edge less 8 px |
|---|---|---|---|---|
| 360x640 | 1.000 | 0.99 | 342 | n/a (top dock) |
| 390x844 | 0.986 (picture 12, Guide dropped) | 0.98 | 371 | n/a |
| 844x390 | 1.000 | 0.90 | 473 | 568 |
| 1280x720 | 1.000 | 0.99 | 725 | 898 less 8 = 890 |

### Check in the browser (headless Chromium, mock test build, the Visitor walks to picture 1, then settles)
| Viewport | Picture | Visitor | Guide | Card chosen (current UI build) |
|---|---|---|---|---|
| 1280x720 | x 264, y 134, 257 x 233 (right 522) | x 540, y 123, 128 x 436 | x 685, y 143, 114 x 381 (right 799) | **full right dock** at x 840, 416 x 114, caption text visible |
| 390x844 | x 41, y 254, 207 x 184 | x 234, y 277, 114 x 348 | x 359, y 271, 123 x 329 (partly off screen; the Guide is dropped from the fit set) | top strip, 366 x 64 (header only, text hidden) |
| 844x390 | x 184, y 65, 165 x 137 | x 353, y 62, 82 x 258 | x 443, y 61, 78 x 227 (right 521) | right strip, 288 x 64 at x 544 (header only) |

At 390x844 and 844x390 the scene rects no longer block anything I can find: the picture, Visitor and Guide all clear the dock rectangles by the old 8 px rule except that the old full candidate is up to 32% of the height (270 px at 844), which reaches the picture top at y 254, and in landscape the old full card started at x 516 to 544 against the Guide's right edge of 521. Both are fixed by the v1.4 card (fitted size, narrower widths, which the frontend-developer is building), not by the scene. The strip at those sizes still hides the caption until that lands. Not re-run with the v1.4 card.

### Requests
- frontend-developer: nothing new. Share `CARD` values with the card (`src/domain/camera/presentationFraming.ts` exports `cardLeftEdge` and `framingRightBound` if you want one source; the UI may import from `@/domain`).


## Update 30/10/2026 (round 2): CR-2 follow-up for spec v1.3

`typecheck`, `lint`, `test` (53 files, 708 tests) and `build` pass. I checked the framing in headless Chromium (software GL) at 1280x720, 390x844, 844x390 and 360x640.

### Changes
- `--ease-camera` mirrored as `cubic-bezier(0.37, 0, 0.63, 1)` in `src/domain/camera/easing.ts`.
- Move out: `moveOutMs` is 600 ms up to 38 degrees, then degrees / 60 per second, capped at 1,000 ms (the swing is measured from the pose on screen to the live follow yaw at release).
- Targets: phone-landscape picture minimum 17%; Visitor maxima 34% portrait, 50% phone landscape, 48% wide. The Visitor height is normalised to the 1.7 m reference (`FRAMING.nominalHeight`), so a 1.85 m Visitor is not penalised; `visitorHeightFraction` in the result is the normalised value.
- Pitch 26 is tried on phone landscape only, after the pitch-20 list, before the least-overlap fallback.
- Stillness: the move starts at the later of 150 ms after dwell and 0.25 s of stillness (`noDelay` once she has been still). Movement before the move starts only delays it (a move in its delay is dropped and framing goes back to pending); movement after it starts releases and blocks re-framing, as before. A reframe from an earlier framing counts as started, so movement releases it smoothly rather than snapping.
- Events (`surprise-museum:presentation-camera`, detail `{ mode, settled, photoId, seq }`):
  - `mode: 'pending'`, `settled: false`, with the photo id, while framing waits for stillness.
  - `mode: 'follow'`, `settled: true`, with the photo id, for fallback, blocked (released by movement or taken over) and a presentation with no framing, fired on the frame it is decided, so the card does not need its 150 ms grace. A reduced-motion cut emits `cut`, `settled: true`.
  - The snapshot adds `pending`. The canvas attribute carries the same mode string, including `pending`.
- Tests added for the out duration, the delay and `moved` rules, `noDelay`, the peak speeds, the v1.3 visibility floors and the 1.7 m normalisation.

### Measured (20 pictures, landscape 1500x1000, portrait 1000x1500 and square, both Guide sides: 120 fixtures per viewport; no fallback anywhere)
| Viewport | Worst `pictureVisibleFraction` | Target | Visitor height (normalised) | Notes |
|---|---|---|---|---|
| 360x640 | 1.000 | 0.99 | 0.29 to 0.33 | 40 of 120 with the Guide dropped |
| 390x844 | **0.986** (1500x1000, picture 12, Guide on the far side, yaw -35, pitch 12, boom 4.90, Guide dropped) | 0.99 | 0.26 to 0.34 | a hair under 0.99; a body edge covers 1.4% |
| 844x390 | 1.000 | 0.90 | 0.46 to 0.50 | the pitch-26 pass was never needed |
| 1280x720 | 1.000 | 0.99 | 0.47 to 0.49 | 60 of 120 with the Guide dropped |

The numbers use the solver's label rectangles (unshifted); the scene also slides touching labels sideways, so on screen they are no worse.

Peak yaw speed, sampled from the curve: in 35 / 45 / 52 / 60 degrees (800 / 1,000 / 1,156 / 1,300 ms) = 69.4 / 71.4 / 71.4 / 73.3 degrees per second (limit 80). Out 35 / 38 / 45 / 52 / 60 degrees (600 / 600 / 750 / 867 / 1,000 ms) = 92.6 / **100.5** / 95.2 / 95.2 / 95.2 (limit 100). The 38 degree out move is 0.5 over the limit, a rounding edge of the spec numbers; the test allows 101.

Stillness worst case against the 1.5 s card cap: if she is already still at dwell completion the move ends by 150 + 1,300 = 1,450 ms. If she was walking and stops `s` seconds after dwell completion, the move starts at `s + 0.25` and ends by `s + 1.55`, so the card (at 1.5 s from dwell completion, or on `settled`) appears while the camera is still moving whenever `s` is more than about 0; the dock re-measures on the next event and on the 100 ms rects. A Visitor who never stops gets no framing and no extra feedback (as decided); the card is released by the cap.

### Seen by eye (headless Chromium, software GL, picture 1 of a test museum)
- 1280x720: a three-quarter view from the left. The whole green picture sits clear in the right-centre of the safe area, both name labels above the figures and off the picture, the Guide (Sam) with the brass ring on the left, the Visitor (Alex) in the middle looking at the picture. Camera is at about 35 degrees yaw and the move took 800 ms (`lastMoveInMs`). No card yet in my frame (the capture was a little early).
- 390x844: the picture is fully visible at the right, characters left, labels clear of the picture, the caption card at the top above them and not overlapping anything; the Visitor is a little under a third of the height. Yaw 45 degrees, 1,000 ms.
- 844x390: the picture is clear in the upper centre-left, characters left of it, the labels sit side by side above the characters and off the picture. **The caption card is a very narrow white pill in the top right showing "S a m" one letter per line**: that is the frontend card's width in the phone-landscape dock, not the camera. Route to the frontend-developer.
- 360x640 reached `framed` with `pictureVisibleFraction` 1; I did not look at that screenshot closely.
- Not looked at: the veil, a reduced-motion cut, a release or re-frame, label sliding, a real phone. I checked modes and timings from the snapshot only for those.

### Requests
- frontend-developer: the phone-landscape caption card collapses to a few pixels wide (see above). The card can also rely on `pending` and `follow` events now instead of the grace period; keep the 1.5 s cap.
- ux-ui-designer: the 38 degree out move peaks at 100.5 degrees per second (limit 100); and 390x844 has one fixture at 0.986 against 0.99. If either matters, nudge the spec (for example out 38 to 36 degrees) or accept.
- qa-engineer: `snapshot().presentationCamera.pending` and the new `pending` event mode; baseline `presenting-photo-1.png` changes by design.


## Update 30/10/2026: CR-1 (gender) and CR-2 (presentation camera)

### Summary
CR-1: `GENDER_LABELS`, `gender: 'neutral'` in both defaults, the 9.4 `describeAvatar` template, label placement tests for every gender, and the builder preview now keeps one rig per character and runs the 250 ms gender morph through the technical-artist's API (instant under reduced motion). CR-2: a pure framing solver and a pure state machine in `src/domain/camera/`, a scene controller that drives them, the veil, input rules, label sliding, a camera-settled signal and the QA hook. `npm run typecheck`, `lint`, `test` (694 plus the new camera and avatar tests) and `build` pass. Nothing was run in a browser this round, so the framing has not been looked at on screen.

### CR-1 details
- `src/domain/characters/avatarOptions.ts`: `GENDER_LABELS` (Woman, Man, Neutral, in that order), `gender: 'neutral'` in `DEFAULT_GUIDE_APPEARANCE` and `DEFAULT_VISITOR_APPEARANCE`, `BODY_TYPE_LABELS` now "Wider hips" and "Wider shoulders" (ids unchanged), and `describeAvatar` follows the 9.4 template: gender word only when not Neutral (read through `avatarGender`), "slim build", "regular build", "wider hips", "wider shoulders", facial hair before the outfit, and hair phrase "bob brown hair" to match the spec example.
- Label placement: `src/scene/characters/labelPlacement.test.ts` builds a rig for every gender x body type x height x role and asserts the label sits 0.35 m (scaled) above the head and does not move when only the gender changes.
- Preview (`src/scene/preview/AvatarPreview.tsx`, new `src/scene/characters/previewAvatar.ts`): the rig is built once per character and a config change calls `update`, which does `beginGenderMorph(to)` then `setAppearance(next)` when the gender changed, and `stepMorph(dt)` calls `setGenderMorphProgress(elapsed / 0.25)` before `applyPose` each frame. Reduced motion calls `setAppearance` alone. Nothing runs per frame when idle. The visit still builds the final shape once (`buildAvatar`). Not changed: kit `index.ts` and `useAvatarRig`.
- Not verified: the morph on a real phone, and the face and silhouette by eye (the technical-artist also did not render).

### CR-2 details
Files: `src/domain/camera/{easing,presentationFraming,presentationCameraMachine}.ts` with tests, `src/scene/cameras/PresentationCameraController.ts`, `FollowCameraRig.ts` (override hook, `adopt`, `moveForward`), `controllers/{labelLayout,framingRects}.ts`, and edits to `SceneDriver`, `SceneRoot`, `commands`, `projection`, `testHooks`.

| Spec item | Behaviour |
|---|---|
| Solver (6.12.4) | Pure `solveFraming`. Candidates: side nearest the current azimuth first, offsets 35, 45, 52, pitch 12 (saved 14) or the saved pitch limited to 8 to 20, then the same list at 20. Strict pass needs: picture inside the safe rectangle and within size limits, no wall rule broken, Guide out of the camera-to-Visitor corridor, no character or label (grown 8 px) on the picture, the card's default dock clear. If none is strict, the least overlap wins (`relaxed: true`). If a wall rule breaks for all, it returns `null` |
| Projection | Exactly three.js's, including the constant view offset; tested against a real `PerspectiveCamera.setViewOffset`. FOV and offset are never changed |
| Walls (6.12.5) | Outer walls and the lectern: aim-to-camera segment kept 0.3 m clear, boom is never shortened, 0.3 m under the ceiling. Partitions: camera-to-corner segments (all four corners) must be clear, so a doorway counts only if it shows the whole picture. Camera on the room side of the wall and not inside any wall |
| Timing (6.12.3) | In: 150 ms delay then 800 ms, longer swings degrees / 45 per second up to 1,300 ms; out 600 ms; resize 450 ms; interrupted move max(300 ms, 600 ms x remaining); easing is `--ease-camera`. Constants are in `CAMERA_TIMING` with a comment pointing at 6.12 |
| Veil | Swings over 60 degrees: veil fades in over 200 ms, cut at the midpoint, fades out over 200 ms (400 ms total). The scene draws it itself (a fixed `div` with `--color-night` at `--z-fade`), because the UI's veil has no scene-facing trigger. Return after such a swing keeps the framing's yaw and pitch and eases only boom and pivot (Reset view then appears) |
| Reduced motion | One-frame cut at the moment the intent starts (the Guide's fade-in starts the same frame) and a cut back |
| Input (6.12.7) | Movement past 15%: release (reverses a move in progress, a move still in its delay is dropped) and no re-frame for that presentation. Look-around, Q/E, Shift+arrows, wheel, plus/minus: `takeOver` adopts the pose on screen with no ease. Reset view: adopts, then the rig eases. Close, Escape, Enter or Space: the director ends the intent, so the camera returns in 600 ms. A new presentation re-frames from the current pose (150 ms delay). Replay and jump: `snapBehind` cancels. Resize: re-solve after 150 ms of stable size, eased 450 ms. Viewer open, hints, sheets: no effect |
| Fallback | Solver returns `null`: the follow camera stays, `presentationCamera.fallback` is true |
| Walking direction | Camera-relative walking uses `rig.moveForward` (the follow direction), not the camera shown, so a camera easing back does not swing the walking direction |
| Labels (5.5, 6.12.8) | While framed, a label touching the picture (grown 8 px) slides sideways away from the picture centre by up to half its width, then the overlap rule raises the farther label. Never hidden or scaled. Offsets are reset when the presentation ends |
| Rectangles | Published at once when the camera arrives, then every 100 ms. The character rectangle is now a thin bound (a body radius of 0.3 m either side of feet and head, along the camera's right) shared by the solver, the published rects and the QA hook |

### Camera-settled signal (for the card change)
The UI may not import the scene and I may not edit `src/state/`, so the signal is a DOM contract plus the test hook:
- `window` event `surprise-museum:presentation-camera` with `detail: { mode, settled, photoId, seq }`, fired on each mode change. `settled` is true when `mode` is not `entering` or `returning`. `seq` increases at each arrival.
- Attribute `data-presentation-camera="follow|entering|framed|returning|cut"` on the canvas element.
- `snapshot().presentationCamera` (test hook): `{ mode, yawOffsetDeg, pictureVisibleFraction, fallback, guideDropped, settled, cutSeq, settledSeq, lastMoveInMs, lastMoveOutMs, photoId, veil }`. `pictureVisibleFraction` uses no pixels. After a hard cut `mode` is `cut` for 300 ms, then `framed`.
- When no framing happens (fallback, blocked, finale, walking) `mode` stays `follow`, so `settled` is already true and the card must not wait. Timing worst case: 150 + 1,300 = 1,450 ms, inside the 1.5 s cap.
- The card should wait for `settled`, or 1.5 s from dwell completion, and re-measure `chooseCaptionDock` on the next event or on the 100 ms rects.

### Decisions
- Framing waits for the Visitor to stop: if she is still walking when the presentation starts, framing begins after 0.25 s of stillness (otherwise a walk up to a picture would almost never frame). Once released by movement, no re-frame (as written). Easy to switch off in `PresentationCameraController.tick` (`waitStill`).
- Lateral and vertical centring: the solver shifts the pivot sideways and vertically (never yaw, pitch, FOV or the view offset) so the group centres in the safe rectangle. Without it the phone landscape column layout (x 5 to 68%) cannot fit.
- Picture width minimum is scaled by the picture's own width over 1.6 m (portrait pictures) and by 0.82 (the 35 degree foreshortening in 6.12.2). Without both, the table's minimum cannot be met at 360 px wide or for tall pictures.
- The picture's minimum width has priority over the Visitor's maximum height (6.12.2: the picture never shrinks), so the boom stops growing once the picture reaches its minimum.
- The Guide must not stand in the camera-to-Visitor corridor at the framed pose, or she would sidestep out of the framing (the Guide's yield rule).
- Veil is scene-drawn (see table).

### Spec issues for the ux-ui-designer
- 6.12.3 says peak turning speed stays under about 80 degrees per second. With `--ease-camera` the peak is about 2.6 times the average, about 115 to 120 degrees per second for 35 degrees in 800 ms. The curve and durations cannot both hold. I followed the tokens.
- 6.12.2 Wide: "picture at least 20% of viewport width" and "Visitor at most 34% of height" cannot both hold for a 1.6 m picture at 35 degrees (needs Visitor about 46%). Picture minimum won, so QA check (b) will see Visitors above the table maximum on wide and phone landscape, unless the Guide was dropped.
- 6.12.3 says the veil is `--duration-fade-through` total; the UI's replay veil uses that duration each way. I used 400 ms total as the camera spec reads.

### Measured (headless maths, 20 pictures, landscape, portrait and square, both Guide sides)
Solver succeeds for every picture at 360x640, 390x844, 844x390 and 1280x720 (no fallback). Strict (nothing covers the picture) is common on portrait phones and wide, and is the exception on phone landscape, where bodies can cover up to 28% of the picture in the worst case (worst `pictureVisibleFraction` about 0.72). The 0.99 acceptance check will not pass there. Not tried: real fonts for label widths (the solver uses the measured label size when the label exists, else 110 x 32 px), safe-area insets (not passed in).

### Not done / open
- No browser check of the framing, the veil, label sliding or the morph; the Playwright baseline `presenting-photo-1.png` will change by design.
- The R2 "Move the camera" switch is out of scope as instructed.
- The caption card change is for the frontend-developer (see signal above).

### Requests for other agents
- frontend-developer: card waits for `surprise-museum:presentation-camera` with `settled: true` (or 1.5 s), then re-measures; optionally add a `cameraSettled` field to `src/state/screenRects.ts` or the session store if a store is preferred over the event.
- ux-ui-designer: the three spec issues above.
- qa-engineer: acceptance checks use `snapshot().presentationCamera`; expect `cut` for 300 ms after a cut, and phone landscape below 0.99 until the spec is settled.
- technical-artist: optional export of the new morph methods from kit `index.ts`.

---

## Previous update (integration round 1)

## Summary
I built the pure domain layer (layout, collision, navigation, presentation director, Guide AI, character sources and registry, camera maths, animation maths, photo load queue) with unit tests, including the NFR-26 30-minute soak, and the R3F scene on top of it: museum, frames, characters with name labels, follow camera, nearest-first photo loading, screen-rectangle output, replay, jump, hint and Playwright test hooks. I checked it end to end in headless Chromium and WebKit (iPhone) through the real `VisitExperience`: welcome, Start, presentation, finale, jump, replay, dismiss, reduced motion, a full route walk, React StrictMode, no console errors. Look and feel is placeholder behind one seam file, ready for the technical-artist.

Verification at the end of integration round 1: `npm test` 516 of 516 pass, `npm run typecheck` is clean, `npm run build` passes. `npm run lint` is clean in my folders; it reports three errors in the backend's in-progress `src/api/mockClient.ts` and `src/api/__tests__/mockPersistence.test.ts`. Headless Chromium at 390x844 and 1280x720, low and high tiers, showed no console errors, working presentation, finale, partition fade and finale signal.

## Integration round 1 (technical-artist kit, graphics tier, preview)
The placeholders are gone and the scene now runs on the technical-artist's final kit through `src/scene/seams.ts`. Added in this round:
- **Final look:** `createSceneMaterials` for the shell, `createMuseumMaterials` (aliased `createLookMaterials`) for the dressing, `SceneLights`, and the skinned avatar rig. Wired in: walnut frames with cream mounts, brass picture lights, soft wall washes, ceiling roses (a larger oculus over the podium), the lectern with guest book, the podium with its brass ring glow (300 ms on enter), a podium floor pool, the finale light cone and dust motes (high tier only; motes hidden under reduced motion), the standing-spot pools, the frame hover and hint glow, and the title plaque from the kit's texture. A 20-photo museum draws in 18 to 21 calls at the shell and dressing level in headless Chromium.
- **Anatomical left and right:** the presenting arm is the character's right arm (-X). The scene no longer drives bones itself: `domain/characters/animation.ts` now produces timing only (walk phase, blend, idle clock, present level) and the kit's `applyPose` turns it into joints. This removes the placeholder `hipHeight` unit problem and the sign comment the technical-artist flagged.
- **Automatic graphics tier** (`runtime/graphicsQuality.ts`, tested): `low` on phones (coarse pointer with a short side under 700 px), on weak or software GPUs (matched on the unmasked renderer name, for example SwiftShader, Mali-4xx/T-series, Adreno 2xx to 5xx, PowerVR SGX, old Intel HD), and on 2 GB or 2-core devices; `high` otherwise. The Visitor's setting wins: `settingsStore.quality` ('auto' or 'low') forces low today, and `resolveGraphicsQuality('high', ...)` is ready for a manual toggle. The tier is published as `<html data-graphics-quality="low|high">` and in `snapshot().quality`. The first render uses device hints, then refines once the GPU name is known. E2E override: `window.__SURPRISE_QUALITY__ = 'low' | 'high'` (only with `__SURPRISE_E2E__`). Low also caps rendering at 30 FPS.
- **Avatar options in the domain:** `src/domain/characters/avatarOptions.ts` holds the labels, defaults and `describeAvatar`; `kit/options.ts` re-exports it, so there is one source of truth. Exports are unchanged (the UI uses them).
- **Partition walls fade** instead of the boom shrinking (design spec 6.3): an internal wall between the camera and the Visitor eases to 25% opacity (instant under reduced motion); collision is unchanged. The camera boom now ignores internal walls but still stops at the outer walls, and still keeps itself out of a wall's thickness. Each partition is its own mesh with its own material; a wall is transparent only while fading, so the common case stays opaque. Name labels show through a faded wall. Verified in the browser: standing in a gallery's near row with the camera in the hall, the wall reads 0.25 and she keeps her on-screen size; walking through the doorway returns it to 1.
- **`AvatarPreview`** (`src/scene/preview/AvatarPreview.tsx`, default export, props from `src/state/avatarPreview.ts`): a separate small Canvas with both characters on plinths in the kit's `PreviewLighting` over `PREVIEW_BACKGROUND`, name labels underneath, the brass ring on the active plinth, click to select, `yawDegrees` turning the pair (0 three-quarter front, 180 back view; eased over about 250 ms, instant under reduced motion), idle breathing with full motion only, `onReady` after the first frame, `onError` on a render error or context loss. Labels are plain DOM over the canvas (drei `Html` roots mounting together raised a React 19 warning and dropped one label).
- **`hintSeq`:** the scene computes the nearest unviewed picture (the finale once all are viewed) by walking distance, sets `sessionStore.hint` with bearing and distance, and glows that frame for 6 s (three pulses, steady under reduced motion). The hint is cleared after 6 s (this was a bug in my first version: it was never cleared).
- **`effectiveTitle()`** is used for the title plaque.
- **`finaleReached`** is written straight to `sessionStore.setFinaleReached`, edge-triggered by `domain/presentation/FinaleSignal.ts`: true on entering the podium zone, false on leaving. After Keep exploring the signal does not return to true until she has left the zone (trigger radius plus 1 m) and entered again; replay and jump reset it, so a jump onto the podium counts as entering. Unit-tested in `FinaleSignal.test.ts`.
- **`canvasInput`** stays off by default.
- Fixed the `SceneRoot.tsx` typecheck error (the `quality` prop).

## Files changed
Domain (`src/domain`, all pure TypeScript):
- `layout/{constants,types,generateLayout}.ts`: deterministic layout for 0 to 20 photos, colliders, picture slots, doorways, finale, spawn, waypoint graph. Tests: `generateLayout.test.ts`
- `navigation/{geometry,collision,navGraph}.ts`: circle versus box collision with sub-stepping, rounded-corner line of sight, A* with string pulling. Tests: `navigation.test.ts`
- `presentation/PresentationDirector.ts`: dwell, switch, dismiss and finale state machine. `presentation/FinaleSignal.ts`: the edge-triggered podium signal. Tests alongside
- `layout/*`: now also `partitions` (internal walls and their colliders) and `hardColliders`
- `guide/AutonomousGuideSource.ts`: follow, approach, present, relocate and yield. `guide/simulation.ts` is the headless world used by tests. Tests: `AutonomousGuideSource.test.ts`, `guideSoak.test.ts` (NFR-26)
- `characters/{LocalVisitorController,ScriptedCharacterSource,CharacterRegistryImpl,createCharacterState}.ts`: the three source kinds and the registry. `characters/animation.ts`: animation timing (walk phase, blend, idle clock, present level). `characters/avatarOptions.ts`: labels, defaults and `describeAvatar`, moved here from the kit. Tests: `characters.test.ts`, `animation.test.ts`
- `camera/composition.ts`: composition targets from design spec 3.4, camera pose, boom occlusion with hard and soft (fading) walls. Tests alongside
- `photos/loadQueue.ts`: priority queue, 3 at a time, back-off, URL-expiry refresh. Tests alongside
- `math/vec2.ts`: 2D helpers
- `characters/characterState.ts` (architect): **no interface changes**

Scene (`src/scene`, excluding `materials/`, `shaders/`, `characters/kit/`):
- `Experience.tsx` (single Canvas, default export), `SceneRoot.tsx`, `FrameCap.tsx`, `seams.ts`
- `runtime/{SceneRuntime,RuntimeContext,motion}.ts(x)`: per-museum collaborators, effective reduced motion
- `controllers/{SceneDriver,commands,actions,hint,projection,testHooks,frameQueue,cursor,CanvasInput}.ts(x)`
- `cameras/FollowCameraRig.ts`
- `characters/{CharacterView,NameLabel,avatarRig}.ts(x)`
- `objects/{Museum,PhotoFrame,TitlePlaque,museumGeometry,glyphs}.ts(x)`
- `photos/PhotoTextures.ts`
- `preview/AvatarPreview.tsx`
- `objects/{museumDressing,partitions,PartitionFade,FrameGlows}.ts(x)`, `runtime/graphicsQuality.ts`
- Deleted: `src/scene/placeholders/` (materials, lights, avatar builder)
- Edited in the technical-artist's folder, with their work finished: `characters/kit/sceneAvatar.ts` and its test (new `AvatarRig` shape), `characters/kit/options.ts` (now a re-export)

## What was built, against the brief
| # | Item | Status |
|---|---|---|
| 1 | Layout generator, unit-tested for 1 to 20 photos | Done |
| 2 | Museum scene from the layout | Done, placeholder look |
| 3 | Visitor movement with collision; joystick, keyboard, drag-to-look; arrow buttons | Done. The input API already exists in `@/state/inputState` (frontend); see "APIs I expect" |
| 4 | Third-person camera, never rotates on its own, rigid under reduced motion | Done |
| 5 | Guide AI with exact thresholds, stand-beside, relocate, reduced motion, 30-minute soak | Done |
| 6 | Local, autonomous and scripted sources, plus a registry | Done |
| 7 | Avatar rig with idle, walk, present | Done on placeholder parts |
| 8 | Name labels via drei `Html`, `zIndexRange={[5, 0]}`, `pointerEvents: none`, raycast off | Done |
| 9 | PhotoLoader: placeholder, nearest-first, failed states | Done |
| 10 | Presentation, rectangles, viewed, finale | Done, except `finaleReached` has no store field yet (request below) |
| 11 | Jump with fade-through, replay, pause rendering for the viewer | Done. The fade veil is the UI's, so the scene cuts at once |
| 12 | Playwright test hooks | Done |

Soak result (30 minutes, 20 photos, 54,000 steps at 1/30 s): 133 presentations, 8 jumps, longest stuck 0 s, longest beyond 8 m 0 s, longest overlap with the Visitor 0.4 s, longest in her path 0.7 s, zero wall violations, zero un-teleported jumps. Two more runs (5 photos, and reduced motion) also pass.

## Decisions
- **Entrance hall 7.5 m deep is accepted by the tech lead.** The architect should update docs (see requests).
- **Entrance hall is 7.5 m deep and the Visitor spawns at (0, -4.9)**, not the architecture's 6 m and (0, -2): the design spec 3.4 camera needs 4.3 to 5.1 m of room behind the Visitor on a phone. With the old spawn the back wall shortened the boom on arrival and she filled the screen. The Guide spawns at (1.0, -4.5). A 20-photo museum is now 65.5 m (about 41 s), not 64 m. The architect should update section 6.2 and ADR 0009.
- **Camera composition** (`domain/camera/composition.ts`), replacing architecture 6.9: phone portrait 30% height, feet at 72%, FOV 60; phone landscape 46%, 80%, FOV 52; wide 40%, 82%, FOV 52. Boom is derived (about 4.8, 3.7 and 4.2 m), default pitch 14 degrees, pivot 0.9 m above the feet, and a constant `setViewOffset`. Unit tests project the Visitor through the real camera maths and assert the ranges in section 3.4. Yaw turns right with positive input, matching the frontend's `inputState` convention.
- **The UI owns keyboard, drag-to-look and wheel** (`useCanvasKeyboard`, `useLookControls`). My `CanvasInput` does the same job but is **off by default** (`<Experience canvasInput />`), because both on would apply orbit input twice. It exists for hosts without that UI.
- **No acceleration ease in the Visitor controller at runtime** (`accelerationTau: 0`): the UI already eases keyboard input and the joystick scales linearly. The domain default stays 0.15 s and is tested.
- **"Same side of the wall" is measured from the wall surface, not from the zone point** (margin 0.2 m). Measured from the zone point, a Visitor standing at the picture (0.3 m off the wall, the closest she can get) would count as behind it. A clear 2D line of sight to the zone point is also required, so a picture on the far side of a partition never triggers.
- **Graphics tier is automatic and Visitor-overridable;** see the integration section.
- **Photo retries:** one try plus three retries after 1 s, 3 s and 9 s, then `failed`. A 400 or 403 asks `museumStore.refreshUrls()` once; waiting photos restart with the new URLs.
- **Reduced motion:** the walk cycle stays (it shows the movement the user asked for, FR-18); idle sway, breathing and the present gesture are off; the Guide fades in beside her over 250 ms instead of walking; relocation is instant; the camera is rigidly attached and resets instantly.
- **Stuck detection** uses net displacement (under 0.6 m in 3 s while wanting to move), not speed, because a Guide sliding back and forth in a pocket was otherwise not detected.
- **Runtime is built inside an effect** and disposed on cleanup, so StrictMode's double mount is safe. It rebuilds only when photo ids, sizes, names, title or avatars change, not when signed URLs refresh.
- **Frame cap on phones:** the Canvas runs `frameloop="never"` and `FrameCap` calls `advance(t / 1000)` at 30 FPS. I found and fixed a bug here in browser testing: passing milliseconds made the simulation run three times too fast.

## Assumptions
- `content.photos` carry `position`; the scene sorts by it. Photo captions are not used by the scene (the UI shows them).
- The finale podium sits 1 m past the finale room's centre, away from the doorway (the doc says "centre + 1 m"; this keeps it visible down the route and clear of the lectern).
- "Exit at r + 1 m" for the finale uses the 1.8 m trigger radius, so 2.8 m.
- A character at medium height is 1.7 m; the three height options scale uniformly (0.91, 1.00, 1.09).
- Photos load behind the welcome screen (the scene is mounted there, as `VisitExperience` does). Ready means the entrance has rendered and the 3 pictures nearest the spawn have loaded or failed, or 6 s have passed.

## APIs I expect from the UI and stores (all already present)
- `useMuseumStore`: `content` (read), `setPhotoStatus`, `refreshUrls()`, `retryRequest` (read, by identity).
- `useSessionStore`: reads `phase`, `viewerPhotoId`, `viewed`, `dismissSeq`, `replaySeq`, `jump`, `resetViewSeq`, `hintSeq`; calls `setPresentation`, `openViewer`, `setSceneReady`, `setSceneProgress`, `setArea`, `setCameraOffDefault`, `setHint`, `setNearFailedPhotoId`, `setContextLost`, `resetView`, `dismissPresentation`.
- `inputState` (read): `move` (camera-relative, y +1 forward, x +1 right), `orbitRate`, `consumeOrbitDelta()`, `consumeZoomDelta()`.
- `publishScreenRects` / `clearScreenRects`: published about every 100 ms while a presentation is active (picture, Visitor, Guide, labels included), cleared when it ends.
- `getEffectiveReducedMotion()` from `settingsStore`, cached for 250 ms; `quality` for the 30 FPS cap and the pixel ratio.
- Arrow-button movement (WCAG 2.5.7): the HUD writes `setMoveSource('arrows', x, y)`. The controller reads the merged `inputState.move`, so joystick, keyboard and arrows all work with no scene change.
- **Replay and jump are cuts**: the UI's veil (`runWithVeil`) should call `replay()` or `requestJump()` at its midpoint, as it does today. The scene snaps the Visitor, puts the Guide beside her, resets the director and snaps the camera behind her.

## Test hooks (Playwright convention)
`window.__surpriseMuseum`, installed only when `window.__SURPRISE_E2E__ === true` (use `page.addInitScript`), or the URL has `?e2e=1` before the hash, or the dev server is running. Nothing is exposed to ordinary visitors.

| Hook | Use |
|---|---|
| `snapshot()` | ready, time, Visitor and Guide (position, heading, speed, locomotion, presentation, `teleportSeq`), Guide mode, opacity and gesture, director intent, dwell, `finaleReached`, `photoStatus`, camera, draw calls, triangles, textures, label visibility |
| `layout()` | rooms, picture zones and standing spots, finale, spawn |
| `walkVisitorTo(x, z)` | real walking with collision; resolves when she arrives |
| `teleportVisitor(x, z, heading?)`, `standAtPhoto(i)`, `standAtFinale()`, `replay()` | cuts |
| `failPhoto(id)`, `retryPhoto(id)` | force a failed frame (works even after it loaded); retry. Prefer `page.route` to fail the image request for realistic tests |

The canvas also gets `data-testid="scene-canvas"`, and `data-scene-ready` on the canvas element.

## Placeholders still in use
None. `src/scene/placeholders/` is deleted and nothing imports it. The swap points remain in `src/scene/seams.ts` (materials, lights, avatar builder), with the shapes defined by the scene.
Not drawn, by decision or by phase:
- Glasses and hats stay Release 2 (tech lead decision); the kit accepts the fields and ignores them.
- Numbered plaques beside each frame (R2) and the Guide off-screen pointer (design 6.8, Should) are not built.
- R2 "all viewed" highlight of the podium (cone and ring pulse) is not built.

## Open questions
- Is a 7.5 m entrance hall (65.5 m total) acceptable, or would the user prefer to keep 6 m and accept a large Visitor on arrival? (architect, user)
- Real-device checks are still needed for the `low` tier thresholds (phone short side under 700 px, the weak GPU list) and for 30 FPS on a reference phone. (performance-optimiser, qa-engineer)
- The kit's blush and eye whites on the deepest skin tones (technical-artist's open question) are still with the ux-ui-designer.

## Requests for other agents
- **frontend-developer:**
  - `src/lib/avatars.ts` duplicates the defaults, labels and `describeAvatar` now in `@/domain/characters/avatarOptions`. Importing the domain copy (the UI may import `@/domain`) leaves one source of truth. The domain exports are stable.
  - Do not pass `canvasInput` to `<Experience />`; keep your keyboard and look hooks as the single input path.
  - To offer a manual graphics toggle later, add `'high'` to `settingsStore.quality`; the scene already accepts it. `document.documentElement.dataset.graphicsQuality` shows the tier in use.
  - The builder lazy-loads `src/scene/preview/AvatarPreview.tsx` (default export). Its wrapper fills its container (`width` and `height` 100%), so give the container a size.
  - `.scene-root > canvas` in `base.css` no longer matches (the canvas is two levels down).
- **architect:**
  - Update architecture 6.2 and ADR 0009 for the accepted 7.5 m entrance hall and spawn (0, -4.9) (65.5 m for 20 photos), and 6.9 for the camera values (phone portrait 30% height, feet at 72%, FOV 60; landscape 46%, 80%, FOV 52; wide 40%, 82%, FOV 52). Also 6.7 for the kit-driven animation, and 6.3 and 6.9 for partition walls fading instead of the boom shrinking.
  - `characterState.ts` needed no change.
- **technical-artist:** thanks, the swap was clean. I edited `kit/sceneAvatar.ts` (new `AvatarRig` shape: `applyPose`, `setOpacity`, `labelHeight`; the scene uses the kit's own pose maths and blob shadow) and made `kit/options.ts` a re-export of the domain file. Please keep both in mind if you touch the kit.
- **qa-engineer:**
  - Test hooks are documented above; `snapshot()` now also reports `quality` and `partitionOpacity` (below 1 means a wall is fading).
  - Force a tier with `window.__SURPRISE_QUALITY__`. Check the finale cone and motes are absent at low.
  - `domain/guide/simulation.ts` is a headless world for NFR-25 and NFR-26 style tests.
- **backend-developer (FYI):** `npm run lint` currently fails in `src/api/mockClient.ts` (`no-unsafe-finally`, lines 271 and 272) and `src/api/__tests__/mockPersistence.test.ts` (`consistent-type-imports`). Not in my folders; I left them.
- **performance-optimiser:** headless Chromium on a software GPU: 18 to 21 draw calls and about 12,000 triangles for a 9-picture museum with both characters; the 3D chunk is now 27 kB gzipped for `Experience` (the shared chunk carries three). Real-device timing is not measured. Textures are not evicted; `PhotoTextures` is the place if NFR-6 needs it.
