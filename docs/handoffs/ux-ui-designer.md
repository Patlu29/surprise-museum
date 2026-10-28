# Handoff: ux-ui-designer

## Summary
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
