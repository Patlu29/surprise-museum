# Handoff: ux-ui-designer

## Update v1.4: readable fallback strip, fitted card, upgrade rule, card widths (30/10/2026)

Design spec is now v1.4 (change note at the top of `docs/design-spec.md`; edits in 3.5, 5.6, 6.12.2, 4.1, copy deck). Only the spec, `src/styles/tokens.css` and this note changed. Nothing was run, committed or pushed.

### Files changed (v1.4)
- `docs/design-spec.md`: v1.4 change note; 3.5 (three sizes, new order table, card widths, expected placement per viewport, selection, upgrade rule, acceptance criteria S1 to S7, U1 to U8, G1); 5.6 strip and fitted variants; 6.12.2 right bound R; 4.1 token row; copy deck rows
- `src/styles/tokens.css`: `--panel-peek-height` 4rem to 6.5rem; new `--panel-fit-min-height` (8rem), `--panel-strip-lines` (2), `--card-min-width` (16rem), `--card-width-landscape`, `--card-width-wide`
- `docs/handoffs/ux-ui-designer.md`: this section

### Decisions (v1.4)
- Strip: 104 px (112 at scale 1.25, 124 at 1.5): 44 px header row (28 px badge, name, one action, Close) plus two clamped caption lines, ellipsis, no fade. "Photo n of N" is dropped visually in the strip (kept as visually hidden text in the region name). I chose a taller strip with the caption under the header over replacing the label alone, because the 44 px Close target cannot shrink and the caption needs a full row
- Look closer leaves the strip header: **Read more** takes its place when the caption is cut off; if the caption fits in two lines, Look closer stays instead. Read more expands in place to the full card, where Look closer is back. Keyboard path to the viewer is therefore one step longer from a cut-off strip
- New **Fitted** size (full card cut to the clear height, at least 128 px) is tried before any strip. At 390x844 it should land at about 168 px; at 360x640 the strip (y 64 to 168) clears the picture (starts y 192)
- Upgrade: yes, with hysteresis. Better candidate clear 600 ms in a row at a 16 px margin (stay test stays 8 px), settled camera only, 1.5 s cool-down (3 s after a downgrade), two upgrades per presentation, never during interaction, same DOM element, never announced. One free re-choice at the first `framed` signal
- Card widths: **min 16 rem (256 px)**, not 18 rem. The container query for Look closer and a 5.5 rem title minimum are enough to stop the pill collapse; 288 px overran the 30% framing column. Landscape `clamp(16rem, 30vw, 22rem)` confirmed with the 16 rem floor. Wide changes from the 26 rem card to `clamp(18rem, 28vw, 26rem)` (358 px at 1280). Cause of the 1280 failure: the old card plus its 24 px edge started at x 840, left of the framing's 68% bound (870), so the Guide's rect always blocked the dock
- Framing right bound R = smaller of 68% and the card's left edge minus 8 px (6.12.2), so the framing and card agree at every width

### Assumptions (v1.4)
- Top bar plus margin is about 64 px in portrait and landscape; the expected numbers in 3.5 depend on it. The dock function measures the real `keepOut`
- The Guide badge at 28 px in the strip is acceptable (the full card keeps 32 px)
- `getBoundingClientRect` measurements in QA are enough to check S1; no pixel diff needed

### Open questions (v1.4)
- If QA finds the full header does not fit at 256 px, the developer may use 17 rem (272 px); the framing's R must use the same constant (frontend-developer to tell the scene-developer)

### Requests for other agents (v1.4)
- frontend-developer (`src/ui/overlays/chooseCaptionDock.ts`, `Hud.tsx`, `useCaptionDock`, `src/ui/styles/visit.css`):
  - Set `STRIP_HEIGHT` to 104 (`--panel-peek-height`, 6.5 rem), with 112 and 124 for caption scale 1.25 and 1.5; retire `TALL_STRIP_HEIGHT` (136) unless you still need it for another reason. Set `MIN_CARD_WIDTH` to 256 (16 rem)
  - Landscape width `clamp(16rem, 30vw, 22rem)` (`--card-width-landscape`) and wide width `clamp(18rem, 28vw, 26rem)` (`--card-width-wide`), replacing the 26 rem `PANEL_MAX_WIDTH` card; keep the 24 px wide edge margin
  - Add the **Fitted** size and the new candidate order in the 3.5 table; fitted height steps down by 8 px from the full height to the first blocker, valid at 128 px or more (`--panel-fit-min-height`)
  - Build the strip variant per 5.6: header row 44 px (28 px badge, name with ellipsis, Read more or Look closer, Close), two-line clamp with the caption at `calc(1rem * caption scale)`, no fade, line breaks collapsed in the strip only; detect truncation (scrollHeight against clientHeight, re-check on resize and font load); Read more and Show less with `aria-expanded` and `aria-controls`; name `{Guide}, photo n of N` as visually hidden text; title minimum 5.5 rem
  - Implement the upgrade rule in `useCaptionDock` (600 ms per-candidate clear timers on the 100 ms samples, 16 px hysteresis, settled-camera gate from the existing `presentation-camera` event, cool-downs, cap of two, interaction guard, free re-choice at the first `framed`); keep the same DOM element and move focus to Close if Read more disappears; no live-region update. Pure parts (timers, hysteresis, cap) belong in a unit-tested module like `captionGate.ts`
  - Unit tests: the S and U criteria that can be pure (S6 geometry at 390x844, S7 widths, U2 to U4 with a fake clock); new strings through the FR-76 scan
  - Expose the card's `getBoundingClientRect` data attributes or test ids for the first caption line and the placed size (`data-card-size="full|fitted|strip"`) for QA
- scene-developer:
  - Use the new right bound R in 6.12.2 for phone landscape and wide (`R = min(68%, (W - edgeMargin - cardWidth - 8) / W)`, card widths in 3.5; below 55% drop the Guide from the fit set). Share the card-width constants with the frontend (a mirrored constant with a comment pointing to 3.5 is fine)
  - Still wanted from the earlier note: a tighter Guide rectangle (body plus label), because that is what blocks the full dock at 1280
- qa-engineer: add acceptance checks S1 to S7, U1 to U8 and G1 from 3.5 (four viewports, three caption lengths, scales 1 and 1.5, 1 and 24 character Guide names); framed screenshots at 844x390, 390x844 and 1280x720 change by design
- product-manager, architect, technical-artist: nothing

---

## Update v1.3: presentation camera as built, CR-2 review (30/10/2026)

Design spec is now v1.3 (change note at the top of `docs/design-spec.md`). I edited only the spec, `src/styles/tokens.css` and this note. Nothing was run.

### Files changed (v1.3)
- `docs/design-spec.md`: v1.3 and change note; 3.4 sentence; 6.12 (trigger with stillness, targets table, scaling rule, priority, Guide corridor, timing table, veil, solver pitch 26 on phone landscape, QA hook fields, acceptance checks); 8.4 row
- `src/styles/tokens.css`: **`--ease-camera` changed** from `cubic-bezier(0.45, 0, 0.25, 1)` to `cubic-bezier(0.37, 0, 0.63, 1)`. No other token changed. **Route a scene check**: the scene mirrors this curve (`src/domain/camera/easing.ts`), and the framing, veil and out-move timings depend on it
- `docs/handoffs/ux-ui-designer.md`: this section

### Decisions (v1.3)
- Peak turning speed: changed the curve, not the duration. The sine curve peaks near 1.6 times the average, so 35 degrees in 800 ms peaks near 70 degrees per second (limit 80). Keeping 800 ms with the old curve would have needed about 1.15 s, which feels slow
- Move out: 600 ms up to 38 degrees, then degrees divided by 60 per second up to 1,000 ms; limit 100 degrees per second out (the Visitor is walking, so it stays quicker than in). Without this, a 60 degree return in 600 ms would peak near 155
- Targets: Visitor maximum raised to 34% portrait, 50% phone landscape, 48% wide; phone-landscape picture minimum lowered from 22% to 17% of the width. Reason: the tech-lead's rules (c) and (d) fix the scale in pixels per metre, so the maxima follow from the minima. A picture-wins rule with the old maxima could never pass. 17% on landscape keeps the Visitor near 47% of 390 px rather than 62%
- Acceptance: `pictureVisibleFraction` at least 0.99 on phone portrait and wide, at least 0.90 on phone landscape, picture never cropped anywhere. Phone landscape also gets a pitch-26 candidate before the least-overlap fallback. I chose a threshold over a different landscape layout because the right 30% column and 16% HUD band are fixed by 3.4 and 3.5
- Stillness (a): the move starts at the later of 150 ms after dwell and 0.25 s of stillness; movement before it starts delays it and does not cancel it; a Visitor who never stops gets no framing (follow camera, as in the fallback). The caption card's 1.5 s cap is unchanged and the card does not wait when `mode` is `follow`
- Veil (b): 200 ms in, cut, 200 ms out, scene-drawn in `--color-night` at `--z-fade`, no veil under reduced motion. The Replay veil in 6.9 is unchanged (full token each way)
- (c), (d), (e) written into 6.12.2 as the tech-lead decided

### Assumptions (v1.3)
- The reference Visitor height is 1.7 m for the height checks; the scene-developer should confirm the constant and the check normalises other heights
- The 0.90 landscape bar is a design call, not measured on screen. The developer measured a worst case of 0.72 before the pitch-26 candidate and the 17% minimum, so the new numbers may or may not reach 0.90 for every fixture
- The peak speeds assume the camera's yaw about the aim point. The sine curve's peak is about 1.57 times the average; I did not sample it in code

### Open questions (v1.3)
- If after the changes some fixture on phone landscape still falls under 0.90, is the user willing to accept a framed view that places the Guide partly off-screen (drop from the fit set already does this), or should the Guide's standing spot on landscape be chosen differently? (scene-developer to report the worst fixture, then user and tech-lead)
- Does a Visitor who never stops walking need any feedback? Spec says no (the card still appears at 1.5 s) (tech-lead)

### Requests for other agents (v1.3)
- scene-developer:
  - Re-read `--ease-camera` (new curve) into the mirrored easing and re-run the solver and timing tests
  - Move out: duration is 600 ms up to 38 degrees, then degrees divided by 60 per second, capped at 1,000 ms
  - Phone landscape: picture minimum 17% (was 22%); Visitor range 26 to 50%; add a pitch-26 candidate after the pitch-20 list, on phone landscape only; wide Visitor maximum 48%; portrait 34%
  - Confirm the stillness rule: move starts at the later of 150 ms after dwell and 0.25 s of stillness; movement before the move starts only delays it. Report the worst case against the 1.5 s card cap
  - Draw the veil as 200 ms in, cut, 200 ms out; none under reduced motion
  - Report the worst `pictureVisibleFraction` per viewport over the 20-picture fixture set after these changes, and the peak yaw speed for 35, 45 and 52 degree moves and for a 60 degree return
  - Camera check by eye in a real browser (not done by anyone yet); the Playwright baseline `presenting-photo-1.png` changes by design
- frontend-developer: no new work. The card still waits for `settled` or 1.5 s
- qa-engineer: test the 6.12.9 acceptance checks (a) to (h) as revised. Key numbers:
  - 0.99 at 360x640, 390x844 and 1280x720; 0.90 at 844x390; the picture rectangle fully inside the viewport everywhere
  - Visitor height (normalised to 1.7 m): 18 to 34%, 26 to 50%, 24 to 48%, or Guide dropped, or picture at its scaled minimum; picture never below its scaled minimum (table width x picture width over 1.6 x 0.82)
  - Move in 800 to 1,300 ms, move out 600 to 1,000 ms, peak yaw speed at most 80 in and 100 out (sample the snapshot yaw each frame); veil 400 ms total for a swing over 60 degrees; reduced motion is one cut with no veil
  - Move does not start until 0.25 s after the Visitor stops; no framing while walking continuously; `mode` is `cut` for 300 ms after a cut
- technical-artist, architect, product-manager: nothing new

## Update v1.2: presentation camera and "Photos weren't kept" notice (30/10/2026)

Design spec is now v1.2 (change note at the top of `docs/design-spec.md`). Both items are the user's decisions of 30/10/2026. Nothing was built or run; no code, architecture or requirements files were touched.

### Files changed (v1.2)
- `docs/design-spec.md`: v1.2 and change note; new 6.12 (presentation camera, with 6.12.1 to 6.12.9); new 5.17 (restored-draft notice); amended 2.1, 3.4, 3.5, 5.5 (framed-view label rule), 6.3, 6.7, 8.3, 8.4, 4.1, copy deck and coverage table
- `src/styles/tokens.css`: new `--duration-presentation-camera-in` (800 ms), `--duration-presentation-camera-out` (600 ms), `--ease-camera`; both durations are 0 ms under both reduced-motion paths
- `docs/handoffs/ux-ui-designer.md`: this section

### Decisions (v1.2)
- Camera: three-quarter side view, yaw offset 35 degrees (then 45, then 52 as fallbacks), pitch 8 to 20 degrees, FOV and view offset unchanged. The boom is solved per presentation so the whole picture plus both characters fit a per-viewport safe rectangle (portrait x 5-95%, y 30-74%; landscape x 5-68%, y 16-82%; wide x 4-68%, y 10-84%). The safe rectangles leave the caption dock and joystick zone clear
- Priority when it does not fit: picture first, Visitor second, Guide third (drop the Guide from the fit set before shrinking the Visitor below 18% / 26% / 24% of the viewport height)
- Timing: 150 ms delay, 800 ms in (up to 1,300 ms for a long swing), 600 ms out, `--ease-camera` (no overshoot). Swings over 60 degrees use the existing 400 ms fade-through veil in; on return the camera does not swing back but adopts the framing's yaw, so there is never a fast whirl while walking
- Movement releases the camera (eases back) but the card and Guide stay; the same presentation is never framed twice (no tug of war). Look-around or zoom takes over instantly, with no return
- Walls: outer walls hard (a candidate fails rather than shortening the boom, which would crop the picture); a partition between the camera and the picture fails the candidate (the picture is never seen through a faded wall); partitions between the camera and a character may fade as ADR 0014. If every candidate fails, the camera stays on the follow camera (v1.1 behaviour)
- Reduced motion: a hard cut in as the Guide's fade-in starts and a cut out on release. I chose a cut over a short fade because a dip through night would be a flash
- Labels stay on, same size, and slide sideways (never hidden) if one still touches the picture
- Notice: information style (info tint, circled "i", no alert role), shown only when a draft was restored with no photos and the stored draft holds something worth restoring; below the step heading on whichever step reopens; Dismiss (this load only); gone when a photo row is created, on dismiss, or on publish or a new draft; never re-announced; removal silent
- Extra, not asked for: an R2 Settings switch "Move the camera to show each picture" (on by default), because this reverses a "camera never moves" promise some Visitors may rely on

### Assumptions (v1.2)
- The Guide's destination spot is known at dwell completion (it is computed before the Guide walks), so the framing can be solved without waiting for arrival
- The scene knows the wall list, each partition's openings, the picture's frame corners and the ceiling height, and can project points through the real camera including `setViewOffset`
- Gallery pictures are on the side walls and a presentation happens inside a room, so most candidates have the camera in the same room; the rare "all candidates blocked" case falls back to the follow camera
- The frontend can tell, at restore time, that a draft was restored and that it holds content (a name, text, a non-default character choice, or step > 1)
- The 6.12.2 numbers are starting acceptance ranges; tune by eye on a real phone, keeping the 6.12.9 calm rules

### Open questions (v1.2)
- Should the R2 camera switch exist, or is the move mandatory? It costs one row in Settings (user, product-manager)
- Does requirement FR-62 ("camera never auto-moves", if worded that strongly) need a note for the new exception? I amended only the design spec (product-manager)
- On a stored draft that equals the defaults, I show no notice, because nothing was lost. Confirm this is wanted (product-manager)
- If the framing falls back to the follow camera in a tight spot, the N-2 view returns. Is that acceptable for the rare case? (user)

### Requests for other agents (v1.2)
- scene-developer:
  - Implement 6.12: a pure solver in `src/domain/camera/` (inputs and tests listed in 6.12.4, same unit-test style as `composition.ts`) and a presentation-camera state machine with modes `follow`, `entering`, `framed`, `returning`, `cut`
  - Keep FOV and `setViewOffset` unchanged; solve the boom through the real projection; apply the outer wall, partition, doorway and ceiling rules in 6.12.5; keep the 6.12.9 calm rules (no roll, no overshoot, peak turn about 80 degrees per second or less)
  - Timing from 6.12.3 with `--ease-camera`; mirror the constants (800, 600, 150 ms delay, 1,300 ms cap, 45 degrees per second, 60 degree veil threshold) with a comment pointing to 6.12; reduced motion is a one-frame cut as the Guide's fade-in starts
  - Input handling per the 6.12.7 table: movement releases and eases back and blocks re-framing for that presentation; look-around and zoom take over with no ease; resize re-solves
  - Publish projected rectangles for the picture, both characters and both labels, and tell the frontend when the camera has settled so the caption card can appear after the framing (card never later than 1.5 s after dwell completion)
  - Name labels in the framed view per 5.5: slide sideways if touching the picture, never hidden
  - Add `snapshot().presentationCamera = { mode, yawOffsetDeg, pictureVisibleFraction }` for QA
  - Update the code comments in `composition.ts` or the camera rig that say the camera never moves for a presentation
- frontend-developer:
  - Build the 5.17 notice in the builder shell (`src/ui/builder/`): condition, placement below the step heading, copy, Add photos action on steps 2 to 4, Dismiss with focus to the step heading, removal rules, and the persistent polite `role="status"` region with the single delayed announcement; keep the dismissed and photo-added state in memory only
  - Make the caption card wait for the camera-settled signal (or 1.5 s) and re-measure `chooseCaptionDock` when the camera settles
  - Add the R2 camera switch to the Settings sheet when that sheet is built (copy in the copy deck)
  - Guard test: the new strings must pass the FR-76 pronoun scan (10.1)
- qa-engineer:
  - Add the 6.12.9 acceptance checks (four viewports, both walls, portrait, landscape and square pictures, reduced-motion cut, each input row, no re-frame after a movement release), and update the `presenting-photo-1.png` visual baseline, which will change by design (N-2 is resolved)
  - Add the notice tests: shown only after a reload with a non-default draft and no photos; not shown for a fresh draft or after removing photos; gone on adding a photo; Dismiss works and moves focus to the step heading; announced once; `US-29 decision: photos are not persisted` gains a line for the notice
  - Re-verify the notice contrast figures in 5.17 with a tool
- product-manager: see the open questions above; note FR-62 wording and the story text for the notice and the camera if you want them as acceptance criteria
- architect: ADR 0014 stays valid for the follow camera; consider a short ADR for the presentation camera (the pure solver, the `presentationCamera` snapshot field and the card-after-camera ordering)

---

## Update v1.1: CR-1 gender option (29/10/2026)

Design spec is now v1.1 (change note at the top of `docs/design-spec.md`). Nothing was built or run; no code, architecture or API files were touched.

### Files changed (v1.1)
- `docs/design-spec.md`: v1.1 and change note; 9.1 gender shape table and revised body types; 9.2 Gender labels, body type label review, facial hair for both; 9.3 defaults; 9.4 tab order and groups, live description; new 9.5 (control and preview change), 9.6 (art guidance), 9.7 (inclusive combinations); copy deck additions; new 10.1 FR-76 audit; 8.4, 6.11, 5.3, 4.1 and coverage table updated; 14 pronoun sentences reworded
- `src/styles/tokens.css`: new `--duration-gender-morph` (250 ms, 0 ms under both reduced-motion paths)
- `docs/handoffs/ux-ui-designer.md`: this section

### Decisions (v1.1)
- Gender is the first group of the **Body** tab, and the **Body** tab moves to first position and opens by default. Reason: gender sets the base shape, and the current default tab (Face) would bury it. Cost: it changes tab order that existing tests may rely on
- Text-tile radiogroup, label "Gender (optional)", order Woman, Man, Neutral, Neutral selected by default, no icons, one row of three tiles on every device
- Preview change is a 250 ms parametric morph of the active character only, instant under reduced motion; no rebuild, so the triangle and draw-call budget is unchanged
- Body type labels: `curvy` becomes "Wider hips" and `broad` becomes "Wider shoulders" (ids unchanged). "Curvy" and "Broad" read as gendered and clash with a Man or Woman choice
- Kept the legacy 1.04 chest depth on Wider hips so published Neutral museums look identical (FR-75). Chest shape from gender is a separate depth scale
- Gender differences are about 10% in shoulder-to-hip ratio, proportion only; no props, colours, lashes, lips or clothing tied to gender; every option stays available for every gender
- Preview description names Woman or Man only when chosen, never anywhere the Visitor sees (A-20); recommend announcing only the changed character's description

### Assumptions (v1.1)
- Stored ids `feminine`, `masculine`, `neutral` as suggested by the product-manager; the architect confirms
- Singular "their" and "your" are acceptable under FR-76
- The Reset button returns the character to the starting look including Neutral; choosing a gender never resets anything

### Open questions (v1.1)
- FR-76 and US-46 conflict slightly: the preview description must name the gender ("man", "woman") while FR-76 lists gendered nouns. I read the FR-76 list as she, her, he, him, girlfriend and boyfriend, and allowed "woman" and "man" only as the Creator's own Gender choice in the builder. Please confirm (product-manager)
- Is the Body-first tab order acceptable, or should Gender sit on the Face tab to keep tab order unchanged? (product-manager, frontend-developer)

### Requests for other agents (v1.1)
- frontend-developer (`src/ui/builder/CharactersStep.tsx`, `src/lib/avatars.ts`):
  - Add a `gender` group as a text-tile `RadioGroup` (label "Gender (optional)", helper text linked with `aria-describedby`, options Woman, Man, Neutral) as the first group of the Body tab; reorder `SECTIONS` to Body, Face, Hair, Outfit and start on `body`
  - Remove `guideOnly` from facial hair so both characters show it; default None
  - Change the display labels for `curvy` and `broad` to "Wider hips" and "Wider shoulders" (ids unchanged); use a two-column grid for body type tiles
  - Update `describeAvatar` to the 9.4 template (gender word only when not Neutral, facial hair when not None, build phrases from 9.2) and announce only the changed character's description
  - Use `repeat(auto-fit, minmax(5rem, 1fr))` for the gender row; no pictograms; focus order puts Gender first after the tabs
  - Load drafts and museums without a gender value as Neutral; add the FR-76 guard test from 10.1 (do not ban "woman" or "man")
  - Reword the pronoun code comments when passing by (optional)
- technical-artist (`src/scene/characters/kit/`, materials):
  - Add the gender parameters in 9.1 and build to 9.6 and 9.7; Neutral must be vertex-identical to today (snapshot test); no extra geometry
  - Run the combination checks in 9.7 (outfits, hair, facial hair, skin tones, both views) and the 120 px silhouette check; report any value tuned beyond 0.03
  - Apply the revised body type rules in 9.1 (bust removed everywhere except the legacy Wider hips value); unit-test the 12 gender and body type combinations against the shoulder and hip limits
  - Make facial hair attach to the jaw parameter; make outfit, hair and badge follow shoulder, waist, hip and chest parameters
- scene-developer:
  - Read `gender` for every character (builder preview, Visitor preview, visit); treat missing as Neutral
  - Tween shape parameters over 250 ms with `--ease-standard` (mirror the constant with a comment pointing to 9.5); retarget on rapid changes with no queue; set it to 0 ms when the effective reduced-motion setting is on; no per-frame cost when idle
  - Confirm name labels do not move when gender changes (height and head are constant)
  - Keep the skeleton silhouettes gender-free
- qa-engineer: add checks for the Body-first tab order, the Gender radiogroup keyboard path, default Neutral, label text, facial hair on the Visitor, the new body type labels, the helper text, reduced-motion instant change, and the FR-76 string scan; update tests that assume the Face tab opens first
- product-manager: see the open questions above and the story prose with "her" and "she" in US-7 and US-8 (not UI copy)
- architect: nothing needed beyond the schema work already in progress; ids in 9.2 are provisional

---

## Summary (v1.0, unchanged)
I wrote the design spec for Surprise Museum (`docs/design-spec.md`) and replaced the placeholder tokens and base styles. The direction is "A private view": a warm, intimate after-hours gallery (linen walls, oak, a claret runner, brass picture lights, a spotlit finale podium) with a catalogue-style 2D UI. The spec covers all Creator and Visitor flows, the HUD and controls for phone and desktop, camera behaviour, name labels, the caption card, the avatar kit and customiser, error states, and WCAG 2.2 AA behaviour. Every colour pair has a calculated contrast ratio recorded in the spec. Nothing was built or run; ratios were calculated by hand from the hex values, so QA should re-verify them with a tool.

## Files changed
- `docs/design-spec.md`: new, version 1.0 (visual direction, flows, layout, tokens, components, 3D interactions, loading and error states, accessibility, avatar kit, copy deck, requirement coverage)
- `src/styles/tokens.css`: replaced the placeholder with the full token set (paper and night colour families, focus, name labels, scene palette, avatar swatches, type, space, sizes, shape, layers, motion, reduced-motion handling). Scaffold names `--font-body`, `--radius-2`, `--touch-target`, `--color-accent`, `--color-surface`, `--color-text`, `--space-2` and `--space-4` still work
- `src/styles/base.css`: replaced the placeholder with resets, type defaults, the two-tone focus ring, `.visually-hidden`, `.skip-link`, `.scene-root`, `.ui-layer`, `.ui-hit`, `.ui-gesture`, `.surface-paper`, `.surface-night`, `.user-text`, forced-colours rules and a reduced-motion safety net
- `docs/handoffs/ux-ui-designer.md`: this note

## Decisions
- Two surface families (paper for 2D screens and cards, night glass for the HUD): one brand that stays legible over a moving scene. HUD text is 8.7:1 even over a pure white pixel
- Name labels are a solid near-black pill with a near-white hairline ring: the fill is the edge on light walls and the ring is the edge on dark walls, so the edge never drops below about 4:1 against any backdrop (the label text itself is 16.3:1)
- Display serif (Fraunces, self-hosted, OFL) for headings, captions and the closing note; the system font stack for everything else: personality where it matters, no extra download for UI text, and `font-src 'self'` is respected
- Caption card, not a world-anchored bubble: a docked paper card chosen by a pure placement function, `chooseCaptionDock`, that tests the projected picture and character rectangles (section 3.5). A world-anchored bubble cannot be kept clear of the picture and the Visitor when the camera is user-controlled
- Camera yaw is user-only; movement is camera-relative, so the camera never swings on its own. This makes "never auto-moves under reduced motion" simple and avoids motion sickness
- Composition is set by screen-space targets (the Visitor is about 24 to 32% of the screen height in portrait) rather than the architecture's starting 3.5 m boom and 2.2 m height, which would fill half the portrait screen and hide the picture
- A "Look closer" button on the caption card, and a small chip for pictures with no caption, give the full-screen viewer a keyboard path in the MVP without needing the Release 2 Pictures list (FR-61)
- Builder is one route with four steps held in history state (no new hash routes), so Back goes to the previous step and does not lose the in-memory draft
- The claret carpet runner, standing-spot floor pools and the visible podium light are wayfinding cues for an unaided first visit (G-4) that do not force a route
- Avatar hair is designed back-first because the Visitor sees her character from behind; the customiser has a "Back view" button
- Reduced-motion tokens work from the OS media query and from an `html[data-motion]` attribute, so the in-app setting and the OS setting both zero all durations

## Assumptions
- Welcome copy adds "Your guide today: {Guide name}" and the eyebrow "A private view". FR-24 requires only the title, "For {name}" and Start
- Closing message with no text shows "The end" and "Thanks for visiting, {name}."
- When every picture is viewed (R2), the "Where next?" button changes to "To the finale" and points at the podium
- The delete confirmation is one dialog with Cancel as the default focus (US-24's "second step"); I did not add a type-to-confirm field because it adds friction to a gift product
- Keep exploring is the primary button on the finale card and Replay is secondary
- Movement speed is 1.6 m/s at most; camera pitch is limited to 4 to 55 degrees; boom is 2.5 to 6 m on desktop; touch has no pinch-zoom because both fingers are used for the joystick and look-around
- Default avatars are given in section 9.3 and avoid assuming gender
- A "Report a problem" link and a Sales team line ("For pricing or contracts, please contact our Sales team") sit in the home footer; their destinations are not decided
- Title plaque and numbered plaques are drawn into canvas textures with the display font, so the scene needs no font download

## Open questions
- Accessibility risk: FR-36 (Pictures list) and FR-60 (2D slideshow) are Should (Release 2), but without them a user who cannot steer a joystick or use a keyboard, or who uses a screen reader, has no complete route through the museum. WCAG 2.5.7 (dragging movements) also expects a non-drag alternative to the joystick. Recommend promoting at least the arrow-button control alternative and the slideshow link to the MVP, or accepting a documented conformance gap (product-manager and user)
- Q-21 (finale podium triggers the closing message) remains the assumed default and the design follows it (user)
- Where should "Report a problem" (takedown contact, A-10) and the Sales team line link to? (product-manager and legal)
- The `heic-to` LGPL licence and the consent and privacy wording are still pending legal review; the spec uses the placeholder consent sentence in Appendix B (legal team)
- Should the Creator be able to choose "Show the note now?" behaviour at all, or is the podium trigger final? (affects only R2 FR-70) (user)

## Requests for other agents
- frontend-developer:
  - Self-host Fraunces (Latin subset, weights 400 and 600, `font-display: swap`, 60 kB or less), for example with `@fontsource-variable/fraunces`, and import it in `main.tsx`; the CSP already allows `'self'` fonts
  - Set `<html data-motion="reduce|full">` and `<html data-caption-size="large|xlarge">` from `settingsStore` (the system value is handled by the media query)
  - Build `chooseCaptionDock` as a pure, unit-tested function (section 3.5) and the overlays, joystick, canvas focus and live regions as specified in sections 5, 6 and 8
  - Keep builder steps in history state (no new hash routes), add a `beforeunload` prompt for an unpublished draft, move focus to each step heading, and use the `.ui-layer`, `.ui-hit` and `.ui-gesture` classes
  - Enforce text limits by Unicode code points (not `maxlength`)
  - Apply `.scene-root` to the Visit wrapper in place of the inline style
- scene-developer:
  - Pass `zIndexRange={[5, 0]}` to drei `Html` for name labels, set `pointerEvents: none`, and implement the label collision and wall-hiding rules (5.5)
  - Disable raycasting on characters so clicks reach the pictures behind them
  - Publish projected screen rectangles (picture, Visitor, Guide, including labels) to a transient object about every 100 ms while a presentation is active, for the placement function
  - Tune the camera to the composition targets in 3.4 using a constant `setViewOffset`; yaw and pitch change only from user input; no damping under reduced motion
  - Expose the dwell progress (0 to 1) for the standing-spot pool (Should), pause rendering while the full-screen viewer is open, implement the fade-through veil hook for Replay and jump, and the floor ring under the presenting Guide
  - Frame states: LQIP, loading glyph, failed glyph with tap-to-retry (7.4)
- technical-artist:
  - Mirror the `--scene-*` and `--avatar-*` tokens in `src/scene/materials/palette.ts` and `src/scene/characters/kit/`, with a comment pointing to the spec
  - Build the look in sections 1.4 and 1.5 (linen walls, oak floor, claret runner, walnut frames with cream mounts, brass picture lights, light-pool decals, finale podium, cone and lectern) within the budgets in architecture section 12
  - Build the avatar kit to Appendix A: proportions, back-first hair readability, the brass Guide badge and Visitor sticker, blush cheeks, and check all ten skin tones under the warm light
  - Author the home and not-found SVG illustrations (aria-hidden, 20 kB or less each)
- architect:
  - Consider `interactive-widget=resizes-content` on the viewport meta so the on-screen keyboard resizes the page in the builder
  - Confirm that the camera numbers in architecture 6.9 (boom 3.5 m, height 2.2 m) are starting values that the composition targets in design spec 3.4 may replace
- qa-engineer:
  - Re-verify every contrast ratio in design spec 4.2 with a tool
  - Add the caption placement check in 3.5 at 360x640, 390x844, 844x390 and 1280x720
  - Run the accessibility test plan at the end of section 8
- product-manager: please consider the accessibility priority question above, and decide the "Report a problem" and Sales team destinations
