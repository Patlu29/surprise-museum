# Handoff: ux-ui-designer

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
