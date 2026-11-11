# Design spec: Surprise Museum

Version 2.0.3 | 11/11/2026 | Owner: ux-ui-designer | Based on requirements v0.4 (CR-4, Epic E10), user stories v0.4 and architecture v1.0

**Change note, v2.0.3 (BUG-18 fix round 1, 11/11/2026).** (1) Tokens: `--look-rim-max` 0.6 to 0.85 and `--look-contour-max` 0.95 to 1 to match the shader; comment records the 0.7 rim and 0.25 contour colour scaling. (2) 12.8.6: edge contrast is accepted at pixel ratio 1.5 (phone Low tier), not supersampled; 1.0 is a stretch case; the DPR governor floor is unchanged (tech-lead, 11/11/2026). (3) 12.8.2: as-built edge note. (4) 12.8.2 review of the darker, wider outline against "ink-aubergine", and the lit-linen option, recorded in the handoff for the user's decision; no wall change made.

**Change note, v2.0.2 (QA round 6, fix round 1, as built, 10/11/2026).** Records as-built behaviour only; no token changed. (1) 12.6.5 and 3.5: the finale card may grow past its placement height (up to 90% of the screen, then its body scrolls); bottom-docked cards grow upwards, others downwards; under a 22 rem card width the footer buttons stack full width; this replaces the v2.0.1 "one row at every width in the 136 px strip" decision (BUG-14). (2) 12.5.3: Escape closes More options and returns focus to its button (BUG-13); the Characters preview stops being sticky in the single-column layout when taller than half the window (BUG-17). (3) 12.6.8: scene name labels are 36vw wide at most on portrait phones, and a still-overlapping lower label drops 4 px below the upper one (BUG-15); the 360x640 picture 1 residual no longer occurs; in the builder the label keeps the full row width. BUG-16 (sideways scroll at 200% text) is a layout fix with no design change.

**Change note, v2.0.1 (after the CR-4 build, 02/11/2026).** Records the build, no design change. (1) 6.3: the follow camera is capped 2 m above the ceiling (5.2 m) and the reduced-motion hysteresis is 2.85 m off, 2.65 m on. (2) 12.8.3: ceiling strip position stated (toward the exit, as built). (3) Tech-lead decisions on frontend deviations: one Preview visible at a time, so on step 4 from 640 px it sits beside Publish (12.4.1, 12.4.4, 12.5.4); preview turn buttons top-right (12.5.3); finale footer on one row in the 136 px strip (12.6.5); step 3 purpose line after the restored-draft notice (12.4.2). (4) 12.3: `--font-display` now includes `'Fraunces Fallback'`. No other token changed.

**Change note, v2.0 (CR-4 polish, 02/11/2026).** The user asked for "Improved UI" (CR-4): polish the current look, keep the identity, layout and flows, with no design checkpoint before the build. All new and changed rules are in **section 12**, which is written to be built as it stands. **Where section 12 and sections 1 to 11 disagree, section 12 wins.** The older sections are kept because they still describe the unchanged behaviour (caption card placement 3.5, presentation camera 6.12, avatar options 9). Short "superseded" pointers were added where a sentence in 1 to 11 is now wrong.
- **Polish, not a new direction (FR-94).** Palette, logo, typeface, the four builder steps and their order, the data model (apart from the two new character options below), camera, controls and Guide behaviour are unchanged. Nothing is removed.
- **User feedback received 02/11/2026, three points.** (1) "More defined characters" now also means **more choice** (FR-96 to FR-102): **Face shape** (5), **six more clothing styles** (twelve in all, Q-30) and a clothing **Pattern** (4, in tints of the outfit colour, Q-31), for every gender, with neutral labels, defaulting to today's look. They all sit in a **More options** group that shares the Reset row, so with it closed the Characters step is no taller than today (FR-102). Placement, pictograms, the 12-style picker and preview behaviour are in 12.5.3; the six style concepts are in 12.8.2 G; avatar rows in 9.2 and 9.4 are extended. (2) **Phones are not hard to use** (FR-82 is now Could, FR-84 Should), so there is no thumb-reach redesign: FR-81 and FR-83 stay as guard rails, and the only reach changes are small and additive (12.7). The caption card dock is untouched. (3) **Ceiling blocks the view from a high camera** (FR-95): 6.3 gains a ceiling fade rule (preferred over a hard pitch clamp).
- **Builder feels shorter through clarity (FR-85 to FR-87, A-25).** A progress line in the sticky action bar; a visible "still to do" list on every step that leads to each field; short labelled sections with Required and Optional tags; a purpose line per step; compact photo rows; a sticky customiser preview on phones; Preview added to the phone action bar (12.4, 12.5).
- **Mobile guard rails (FR-81 to FR-84).** Text floor 12 px, secondary text 14 px (`--text-xs` is now 14 px); 8 px between targets at 360 px; safe areas and keyboard behaviour written down; a small bottom-right **Done** button for the caption card and **Carry on** for the finale (12.7) that leaves every 3.5 behaviour untouched; bottom sheets capped at 60 dvh.
- **Visit polish.** HUD trays, progress ring, welcome, finale and notices restyled; the caption card changes are visual only and never alter the sizes, widths, gaps, strip heights or the upgrade rule in 3.5 (12.6).
- **Art direction (12.8).** Scene finish (contact darkening, dado and rail, brass fillet on frames, stronger picture-light washes, deeper ceiling, contact shadows, finished wall caps for the ceiling cutaway) and character definition (a dual-band screen-space edge, region trims, bigger eyes with catchlights, thicker brows with a 3:1 floor, a deep-skin blush, a clearer idle and walk, plus the face shape and pattern rendering). All inside the budgets: 6,000 triangles (at most 60 added), the three.js chunk under 1,000 kB (guard 985 kB) and the frame-rate targets.
- **Tokens (4.1, 12.9).** Added only; no name changed. Value changes: `--text-xs` 13 to 14 px, `--scene-ceiling`, `--scene-light-ground`. The scene drift test needs `palette.ts` updated in the same change (12.11, technical-artist task 1).
- **Open for the product manager and architect (12.12).** Final option ids and counts for face shape, clothing style and pattern; the one-sentence landing description (FR-80); the 250 ms limit of FR-79 against the existing 300 ms `--duration-normal` (overlays use a new 220 ms token); time hints (FR-88, Could) have no observed data and are not specified. NFR-29 settles the old question: published museums show the improved look with no migration.

**Change note, v1.5 (02/11/2026).** 5.5 "Framed view" gains the portrait caption-strip rule (BUG-10, as built by the scene-developer): on portrait screens during a photo presentation, a name label never sits above the strip's bottom edge; it slides down to that edge (68 px plus the strip height of 104, 112 or 124 px). It may overlap the Guide's head by a few pixels and never the picture. 6.12.8 and 3.5 gain a one-line cross-reference. No tokens changed.

**Change note, v1.4 (readable fallback strip, fitted card, upgrade rule, card widths; 30/10/2026).** Framed screenshots showed the 64 px fallback strip filled by its 44 px header, so the caption was hidden. Changes are in 3.5, 5.6, 6.12.2, 4.1 and the copy deck.
- **The strip is now a caption strip, 104 px tall at normal text size** (token `--panel-peek-height` changes from 4 rem to 6.5 rem). Row 1 is the 44 px header (badge, name, one action, Close). Row 2 is the caption, two lines. **Caption text is always visible in a strip.** "Photo n of N" is dropped visually in a strip (it stays in the accessible name). Look closer moves out of the strip header and is replaced by **Read more** when the caption is cut off.
- **New placement size, "fitted":** a full-style card cut to the clear height in its dock (at least 8 rem). It is tried before any strip, so the strip is a last resort.
- **Upgrade rule (answer: yes, with hysteresis):** a fitted card or strip may move up to a better candidate once that candidate has been clear for 600 ms, tested with a 16 px margin, with a cool-down and a cap. Details in 3.5 Stability.
- **Card widths (answer: adjust).** Minimum card width is **16 rem (256 px)**, not 18 rem. The container query for the Look closer text and a smaller title minimum already stop the pill collapse; 288 px made the card wider than the 30% column the framing reserves. Phone landscape width is `clamp(16rem, 30vw, 22rem)` (the frontend's 30vw is confirmed; only the lower clamp changes). Wide width is now `clamp(18rem, 28vw, var(--panel-max-width))`, because the old 26 rem card (plus 24 px edge) was wider than the 30% column and pushed the Guide's rectangle into it at 1280 px.
- **Framing safe rectangle (6.12.2):** the right bound on landscape and wide is now the smaller of 68% and the card's real left edge minus 8 px, so the framing and the card agree for every width. A small scene change.
- New tokens: `--card-min-width`, `--card-width-landscape`, `--card-width-wide`, `--panel-fit-min-height`, `--panel-strip-lines`.

**Change note, v1.3 (presentation camera as built, CR-2 review, 30/10/2026).** Section 6.12 now matches the scene-developer's build plus the decisions below. Nothing else changed.
- **Token value changed: `--ease-camera`** is now `cubic-bezier(0.37, 0, 0.63, 1)` (ease-in-out sine). Durations are unchanged (800 ms in, 600 ms out). Reason: the old curve peaked at about 2.6 times the average speed (115 to 120 degrees per second for 35 degrees in 800 ms). The new curve peaks at about 1.6 times, so 35 degrees in 800 ms peaks near 70 degrees per second, inside the 80 limit, without a slower move. **The scene must re-read the value (its mirrored curve and `easing.ts`) and a scene check is needed.**
- **Move out is lengthened for big swings:** 600 ms up to 38 degrees, then degrees divided by 60 per second, capped at 1,000 ms (peak about 95 degrees per second at most). The move out was previously exempt from the 80 limit by accident; 600 ms for 60 degrees would peak near 155. The token is unchanged; the scene computes the longer value.
- **Accepted from the tech-lead:** (a) framing waits for 0.25 s of stillness; (b) the scene draws its own veil, 200 ms in, cut, 200 ms out; (c) the picture minimum is scaled by picture width over 1.6 m and by 0.82; (d) the picture wins over the Visitor maximum; (e) the Guide may not stand in the camera-to-Visitor corridor. All are written into 6.12.
- **Targets revised (6.12.2):** the Visitor maximum is raised to 34% (portrait), 50% (phone landscape), 48% (wide), and the phone-landscape picture minimum is lowered from 22% to 17% of the viewport width. These are what the picture minimums physically imply for a 1.7 m Visitor beside a 1.6 m picture at 35 degrees, so they can now all be met together.
- **Acceptance rule (6.12.9):** `pictureVisibleFraction` at least 0.99 on phone portrait and wide, at least 0.90 on phone landscape (the characters' rectangles are conservative bounds, so true coverage is lower). Phone landscape also gains a taller-pitch candidate (up to 26 degrees) to help reach 0.90.
- 3.4 and 8.4 sentences updated to match.

**Change note, v1.2 (two user decisions, 30/10/2026).**
- **Presentation camera (QA N-2, the user chose "move the camera").** New **6.12**: during a presentation the camera eases to a three-quarter side view that frames the whole picture plus both characters, then eases back to the follow camera when the presentation ends, the Visitor moves or the Visitor takes the camera. Framing targets for phone portrait, phone landscape and wide, timing and easing (800 ms in, 600 ms out), reduced motion (a hard cut), input interruption, wall rules and name-label rules are all in 6.12.
  - This **reverses** the v1.0 to v1.1 rule "the camera does not move because of a presentation" (3.4, 6.3, 6.7, 8.4). Those sections are amended: a presentation is now the one camera move the Visitor did not directly ask for, and it is always interruptible. Hints, the finale, the Guide's relocation and the picture list still never move the camera.
  - New tokens `--duration-presentation-camera-in`, `--duration-presentation-camera-out`, `--ease-camera` (0 ms under both reduced-motion paths). The composition targets in 3.4 and ADR 0014 are unchanged for the follow camera.
  - 5.5 gains name-label rules for the framed view; 3.5 gains a QA check at the framed pose; 8.4 and the coverage table are updated. R2 adds a Settings switch (5.13, 6.12.9).
- **"Photos weren't kept" notice (the user chose yes).** New **5.17**: a short inline notice in the builder when a restored draft has no photos. Placement, copy, dismissal, screen-reader announcement and when it disappears are in 5.17; copy deck and 8.3 updated; 2.1 leaving-protection sentence corrected. No new tokens (it reuses `--color-info-tint`).
- Nothing else changed. All new copy is gender-neutral (FR-76).

**Change note, v1.1 (CR-1: gender option, approved 29/10/2026).**
- 9.4: new **Gender** radiogroup (Woman, Man, Neutral; default Neutral; optional) is the first group of the customiser. The **Body** tab moves to first position and becomes the opening tab, so the base shape is chosen before the details.
- 9.4: Facial hair is now shown for both characters (it was Guide only).
- 9.5 (new): preview behaviour when gender changes: a 250 ms shape morph (instant under reduced motion), nothing else changes.
- 9.1 and 9.2: gender shape table; body type labels reworded to **Wider hips** and **Wider shoulders** (ids `curvy` and `broad` unchanged); the bust parameter is removed from body type (chest shape now belongs only to gender).
- 9.6 (new): art guidance for the technical-artist. 9.7 (new): inclusive-combination rules.
- 9.3, 9.4 and 10: defaults, live description and copy deck updated. New token `--duration-gender-morph`.
- 10.1 (new): audit of gendered wording (FR-76). Fourteen spec sentences used "she" or "her" for the Visitor and were reworded. No app-written UI string was found that uses a gendered pronoun or noun.
- Mobile and desktop layouts, the stepper and the 3D visit are otherwise unchanged.

Tokens live in `src/styles/tokens.css` (values) and `src/styles/base.css` (shared rules). This document is the source of truth for look, layout, behaviour and accessibility. Developers build from it and must use tokens, never raw values.

**Release tags.** Each feature is tagged **MVP** (a Must in requirements v0.2) or **R2** (Should or Could, Release 2 or later). R2 items are specified now so that the layout, tokens and component structure leave room for them. Build MVP first.

## Contents

1. Visual direction
2. User flows
3. Layout
4. Design tokens
5. Components
6. 3D interactions
7. Loading and error states
8. Accessibility
9. Appendix A: Avatar kit and customiser
10. Appendix B: Copy deck
11. Appendix C: Requirement coverage
12. CR-4 polish (v2.0): scales, landing, builder, visit, mobile ergonomics, art direction, tokens, task list

---

## 1. Visual direction

### 1.1 Concept: "A private view"

A gallery after hours, opened for just two people. Warm lamplight, quiet rooms, and every picture lit like it matters. The product is a gift, so the 2D screens feel like a beautifully printed exhibition catalogue and the 3D museum feels like a small, intimate gallery rather than a game level or a generic white cube.

| Quality | What it means in practice |
|---|---|
| Warm | Cream, linen, oak, brass and claret. No cold greys, no pure white, no pure black. Light is about 3000 K |
| Intimate | Dark ceilings and soft pools of light on the pictures and the floor in front of them. Rooms feel lit by the photos. Small rooms, a low horizon, no vast spaces |
| Gallery-like | Picture lights, walnut frames with cream mounts, small museum plaques, a claret carpet runner, a spotlit podium at the end |
| Gentle | Slow, soft motion. Nothing flashes, bounces or races. Everything has a calm alternative under reduced motion |
| Personal | Names are everywhere they should be: the welcome screen, the labels, the caption card header and the closing note |

Shape language: soft rounded rectangles (picture-frame proportions) with a hairline brass inner border (`--shadow-inset-frame`). Brass is decoration on light surfaces and text or icon colour on dark ones.

### 1.2 Typography

| Role | Font | Weight | Size token | Use |
|---|---|---|---|---|
| Display | Fraunces (variable, SIL Open Font Licence), self-hosted, Latin subset | 600 | `--text-display`, `--text-3xl`, `--text-2xl`, `--text-xl` | Welcome title, screen headings, plaque titles, caption card name |
| Reading | Fraunces | 400 | `--caption-size` (1.125 rem, scalable), `--leading-reading` | Photo captions and the closing message. A serif at reading size feels like a handwritten museum label |
| UI and body | System UI stack (`--font-sans`) | 400, 500, 600 | `--text-md`, `--text-sm`, `--text-xs` | Buttons, fields, helper text, name labels, HUD. Zero download and the best legibility on phones |
| Eyebrow | System UI, uppercase, `--tracking-eyebrow` | 600 | `--text-xs` | "A private view" above titles |

- Body text and inputs are never below 16 px, which also stops iOS zooming into fields.
- Fraunces is only needed for headings and captions. Load the Latin subset at weights 400 and 600 only, with `font-display: swap`, from the app's own origin (the CSP is `font-src 'self'`). Budget: 60 kB or less for both files. If it is late, the fallback stack (Iowan Old Style, Palatino, Georgia) is metrically similar, so layout stays stable.
- Names typed by the Creator keep accents, emoji and any script exactly as typed. UI text that shows them uses `.user-text` (see `base.css`) and the system font stack, which carries emoji.
- Text must survive 200% zoom and the WCAG 1.4.12 text-spacing overrides without clipping. No fixed-height text containers.

### 1.3 Colour

Two surface families, so the same brand works in the builder and over a moving 3D scene.

| Family | Where | Base colours |
|---|---|---|
| **Paper** | Builder, home, welcome, error screens, caption card, finale card, dialogs | Parchment `--color-bg`, paper `--color-surface`, ink `--color-text`, claret `--color-accent` |
| **Night** | HUD glass over the scene: joystick, top bar, hint chips, name labels, toasts | Aubergine `--color-night` at 84% (`--color-hud`) with a 14 px blur, text `--color-on-night`, brass `--color-brass` for icons and highlights |

Claret is the one action colour on paper. On night, brass carries highlights and rose (`--color-accent-on-night`) carries links. Danger and success always pair colour with an icon and words.

All text and component pairs, with measured WCAG ratios, are in section 4.2. Never use a pair that is not listed there. In particular, brass is never text on paper (2.2:1).

### 1.4 The museum's architectural look

Applies to the default (only) MVP theme. The technical-artist owns materials and lighting; this table fixes the look and the colour targets. Hex values are tokens named `--scene-*`.

| Element | Look | Colour tokens |
|---|---|---|
| Walls | Warm linen plaster, slightly darker towards the ceiling (vertex-colour gradient, 100% to 75%). Painted skirting 0.12 m high | `--scene-wall`, `--scene-wall-shade`, `--scene-skirting` |
| Floor | Wide oak boards running along the route (along -Z), faint grain, matte with a very soft sheen. A claret runner 1.6 m wide with thin brass edge lines runs down the centreline from the entrance through every doorway to the podium. It is wayfinding without being a tour | `--scene-floor`, `--scene-floor-grain`, `--scene-runner`, `--scene-runner-edge` |
| Ceiling | Dark and warm, so each room feels lit by its pictures. A simple brass ceiling rose or recessed strip per room is enough | `--scene-ceiling` |
| Doorways | 2.4 m wide, 2.7 m high, with a 0.12 m painted architrave. A rounded arch top is optional (visual only; colliders stay boxes) | `--scene-skirting` |
| Lighting | Hemisphere light plus one warm directional light, no shadow maps (architecture 6.11). The mood comes from baked-looking gradients and decals, not real-time lights | `--scene-light-warm`, `--scene-light-sky`, `--scene-light-ground` |
| Picture lights | A small brass bar above each frame with a visible emissive strip, and a soft warm wash on the wall around the frame (additive decal, 10 to 14% alpha) | `--scene-brass`, `--scene-pool` |
| Frames | Border 0.06 m total: 0.02 m walnut outer, 0.04 m cream mount inside. Depth 0.05 m. The photo itself is unlit (`MeshBasicMaterial`, FR-40) so it is always evenly lit, never glared or shadowed | `--scene-frame`, `--scene-mat` |
| Standing-spot pools | A soft warm elliptical glow on the floor in front of each picture, about 1.6 m wide, centred 1.6 m from the wall. It marks "stand here" and makes presentations discoverable without instructions (G-4). It brightens with proximity: 40% at 3 m to 100% at 1.5 m. Optional (Should): it fills over the 1 s dwell. Reduced motion: it steps on when the dwell completes | `--scene-pool` |
| Plaques | A small brass-edged cream plaque beside each frame (0.18 by 0.12 m) showing the picture number ("3"), and a larger title plaque on the entrance hall's left wall. Text is drawn into a `CanvasTexture` using the display font (after `document.fonts.ready`), so no font download is needed in the scene and emoji work. Plaques are decorative; the same information is in the UI. **MVP:** title plaque only. **R2:** numbered plaques | `--scene-plaque`, `--scene-plaque-ink` |
| Entrance hall | Title plaque reads, in order: small caps "A PRIVATE VIEW", the museum title (display, up to 3 lines), "For {Visitor}", "Curated by {Guide}". A low bench and a coat stand are optional dressing if the budget allows | |
| Character contact | A soft elliptical blob shadow under each character | `--scene-blob-shadow` |

Frame hover highlight (desktop) and the "Where next?" glow use `--scene-hint-glow`.

### 1.5 The finale room and podium

The final room is the emotional payoff, so it changes mood clearly from the linen galleries.

| Element | Look |
|---|---|
| Walls | Deep claret plaster (`--scene-finale-wall`), the same warm family but darker and richer, so entering feels like arriving somewhere |
| Floor | Dark polished wood (`--scene-finale-floor`). The claret runner ends in a brass-edged semicircle at the podium |
| Podium | A low cream stone disc, radius 1.5 m, height 0.18 m, with a thin brass inlay ring (`--scene-podium`, `--scene-brass`) |
| Light | A soft warm cone falling from a ceiling oculus onto the podium (`--scene-spot`): additive cone mesh at 8 to 10% alpha, plus a floor pool. A few dust motes drift in the cone (40 points or fewer). Low graphics quality: no cone mesh, floor pool only |
| Lectern | At the far edge: a walnut lectern with a cream open guest book on top. Decorative and solid (0.6 by 0.4 m) |
| Visible from afar | The podium's light is visible down the centre line through the doorways, so the Visitor can see where the museum ends from the entrance |
| On enter | The podium ring brightens over 300 ms and the pool grows 15%. Reduced motion: it switches on instantly. No confetti in the MVP (R2, FR-43, and never under reduced motion) |
| R2 "all viewed" highlight | The podium ring and cone brighten and the ring pulses slowly (4 s cycle). Reduced motion: steady, brighter, no pulse |

### 1.6 Avatar style

Full kit, labels and rules are in Appendix A. In short:

- "Designer toy" proportions: about 5.5 heads tall, large head, soft rounded limbs, mitten hands, simple rounded shoes. Friendly, not cartoonish and not uncanny.
- Flat, bold colour blocking. Hair, skin and outfit contrast clearly so each reads at 120 px tall. **v2.0: "no outlines" is superseded.** A thin, soft screen-space contour (about 1.5 px) now separates each figure from its backdrop (12.8.2).
- **The Visitor mostly sees their own character from behind**, so hair and the back of the outfit carry identity. Hair styles are designed back-first (ponytail, bun, braids, bob length and afro volume must read from behind). The customiser has a "Back view" button for this reason.
- Face: two dark oval eyes, thin brows in the hair colour, a small smile, soft rose cheek blush. No nose geometry beyond a tiny bump in a slightly deeper skin tone.
- The Guide wears a small brass round badge on the left chest; the Visitor wears a cream "visitor sticker" with a rose heart in the same spot. This quietly signals roles without relying on name labels, and the Guide's badge is the slot for the Creator's face photo in a later release (FR-21).

### 1.7 Motion personality

Slow, soft, never urgent. Standard ease is `--ease-standard`. All durations come from tokens, which fall to 0 ms under reduced motion (section 8.4 lists every animation and its replacement).

### 1.8 Voice and copy

Warm, plain, a little playful. Short sentences. Australian English ("customise", "colour"). Addresses the Creator as "you" and the Visitor by name. Errors never blame the user and always say what to do next. Copy deck in Appendix B.

---

## 2. User flows

### 2.1 Creator (Epic E1, E2, E6)

```mermaid
flowchart LR
  H[Home #/] --> C1[1 Photos]
  C1 --> C2[2 Words]
  C2 --> C3[3 Characters]
  C3 --> C4[4 Review and publish]
  C1 & C2 & C3 & C4 -. Preview .-> P[Preview #/create/preview]
  P -- Exit preview --> C4
  C4 -- Publish --> R[Published: share link + edit link]
  R --> E[Edit screen #/edit/token: view, copy, delete]
```

The builder is one route (`#/create`) with four steps held in component state and browser history state (`history.pushState` with a step number, no new hash routes), so the Back button goes to the previous step rather than leaving and losing work.

| Step | What the Creator does | Key rules |
|---|---|---|
| Home | Reads one sentence and three steps, taps **Create a museum** | No sign-in, no account prompt (FR-1). Static, no 3D, loads fast |
| 1 Photos | Adds 1 to 20 photos, watches progress, writes optional captions, reorders, replaces, removes | Rejections list the file name and reason; valid files continue (FR-3). Retry per photo (FR-4). Reorder by drag or by Earlier and Later buttons (WCAG 2.5.7). Captions 280 characters with a counter |
| 2 Words | Visitor name (required), Guide name (required), museum title (optional), closing message (optional) | 1 to 24 characters for names, 60 for title, 1,000 for the message. A live sample shows the welcome title and both name labels as typed |
| 3 Characters | Styles the Visitor and the Guide with a live 3D preview | Every option is a labelled control. Preview updates within 1 s. Works without WebGL (options still usable) |
| 4 Review and publish | Checks the summary, ticks the consent, optionally previews, publishes | Consent is required (FR-56). Publish shows progress, cannot run twice, and failure keeps all work |
| Published | Copies or shares the **share link**, copies and saves the **edit link** | Edit link has a prominent "save this" warning and must be acknowledged before "Finish" (FR-50) |
| Edit link | Opens `#/edit/<token>`: sees a summary, copies the share link, deletes | Delete needs a confirmation dialog whose default focus is Cancel (US-24). MVP offers view, copy and delete only |

Preview is available from every step once there is at least 1 photo and both names. If not, the Preview button opens a dialog listing what is missing, with a link to each fix (US-8).

Leaving protection: until published, the browser shows its native "leave site?" prompt on close or reload if the draft has content. After a reload the builder restores names, text, characters and the step from `localStorage`, but **not the photos** (photo restore is Release 2, needs IndexedDB). When that happens the builder shows the "Photos weren't kept" notice (5.17), so the Creator is told why the photo list is empty.

### 2.2 Visitor (Epic E3, E4, E7)

```mermaid
flowchart LR
  L[Open link] --> LD[Loading data]
  LD --> W[Welcome: title, For name, Start]
  LD -. fails .-> ER[Error screens]
  W -- Start --> LS[Loading scene with progress]
  LS --> M[Museum: free roaming]
  M -- pause near a picture 1 s --> G[Guide presents caption card]
  G -- walk away over 4.5 m, or dismiss --> M
  M -- tap a picture --> V[Full-screen photo]
  V -- Close --> M
  M -- step onto podium --> F[Finale card]
  F -- Replay --> M0[Back at entrance]
  F -- Keep exploring --> M
```

| Stage | What the Visitor sees and does |
|---|---|
| Loading data | Paper screen with the brass frame mark and "Opening your surprise". Never blank (FR-57) |
| Welcome | Eyebrow "A private view", the museum title, "For {name}", "Your guide today: {Guide}", a large **Start** button with focus, a small Privacy link. The 3D chunk and the nearest photos download in the background while the Visitor reads |
| Start before ready | The button shows "Getting the gallery ready" with real progress and the screen waits, then cross-fades into the scene. If already ready, the cross-fade is immediate (500 ms, cut under reduced motion) |
| Arrival | The Visitor stands at the entrance facing the route, the Guide beside the Visitor, both labelled. Controls work at once. One quiet coaching hint appears (section 6.1) |
| Free roaming | Walk anywhere. No Next button, no fixed order |
| Presentation | After about 1 s near a picture the Guide walks over and the caption card appears. Walking away or tapping Close ends it, and the Guide follows again |
| Full-screen photo | Tap or click a picture. Zoom, read the caption, Close returns to the same spot |
| Finale | Step onto the podium. The Guide stands beside the Visitor and the closing note appears with **Keep exploring** and **Replay** |

### 2.3 Error states (Epic E6, E7)

| Situation | Screen | Recovery |
|---|---|---|
| Unknown, deleted, expired or mistyped link; any unknown route | **Not found** (7.5): reveals nothing about content, no list of museums | "Go to the home page" |
| Museum data cannot be fetched (offline, server error) | **Couldn't open it** (7.6) with the museum unchanged | "Try again" without a page reload (US-30) |
| WebGL unavailable | **Can't show 3D** (7.7): explanation, supported browsers, how to enable hardware acceleration | R2: "See the photos as a slideshow" |
| Graphics context lost mid-visit | Modal "The 3D view stopped" (7.8) | "Reload" |
| A photo fails to load | In-frame placeholder with a retry affordance, plus a DOM "Retry" chip near the picture, plus a Retry in the full-screen viewer (7.9) | "Retry"; the Guide still presents the caption and the Visitor keeps roaming (FR-58) |
| In-app browser likely to struggle (NFR-9) | Dismissible info card on the welcome screen: "Open in your browser" | Copy link, or the browser's menu |
| Builder: rejected file, failed upload, publish failure, rate limit | Inline messages next to the cause (7.10) | Retry per item; work is never lost |

---

## 3. Layout

### 3.1 Principles

1. **Canvas first.** On the Visit screens the canvas fills the viewport (`.scene-root`). All UI sits above it in `.ui-layer`, which ignores pointer events so empty space still reaches the canvas; each control opts back in with `.ui-hit`.
2. **The centre stays clear.** Controls live at the edges. Panels dock at the edge that is free of the Visitor and the active picture (section 3.5).
3. **Thumb zones.** Movement bottom-left, look-around anywhere else, primary actions in the lower half. Top corners hold rarely used buttons.
4. **Use `dvh`, not `vh`**, and add safe-area insets (`--safe-*`) to every edge so notches, rounded corners and the home indicator never clip a control.
5. **Touch targets 44 by 44 px minimum** (`--touch-target`), 48 px for builder bar buttons and option tiles (`--touch-target-md`), 56 px for primary calls to action (`--touch-target-lg`), 8 px or more between targets (`--target-gap`; v2.0: this is now a hard rule at 360 px, FR-81, and there are no "touching" clusters). **FR-82 (reach) is met by small additions only, not a redesign (12.7).**
6. Orientation changes never restart anything: position, viewed pictures, panels and the Guide are kept (US-33).

### 3.2 Breakpoints

| Name | Width | Visit layout | Builder layout |
|---|---|---|---|
| Phone portrait | 360 to 639 px | Joystick bottom-left; caption card docks top; sheets are bottom sheets | One column; sticky bottom action bar; stepper is "Step n of 4" with a segmented bar |
| Phone landscape | `(orientation: landscape) and (max-height: 500px)` | Joystick bottom-left; caption card docks right (or left); sheets are right-hand drawers | One column, content capped at `--content-max-width`; action bar becomes a compact right-aligned bar |
| Tablet | 640 to 1023 px | As desktop but controls stay touch-sized; joystick shown when `(pointer: coarse)` | Two columns on the Characters step; one column elsewhere |
| Desktop | 1024 px and wider | No joystick; keyboard and mouse hints; caption card docks right; picture list and settings are side drawers | Left vertical stepper (12 rem), content, and on the Characters step a sticky live preview |

Design floor is 360 px wide. Text content (builder, dialogs, error screens) must also reflow without horizontal scrolling at 320 px (WCAG 1.4.10). The HUD is designed from 360 px.

**v2.0 sub-bands.** Phone portrait splits at 480 px: small phone (up to 479 px) and large phone (480 to 639 px). HUD button labels now appear from 480 px (they were 400 px; the 400 to 479 px band needed a 4 px gap that FR-81 no longer allows). The reference viewports for CR-4 are 360 by 640, 390 by 844, landscape 844 by 390 (and 640 by 360), tablet 768 by 1024, desktop 1280 by 720 and the 320 px reflow check.

### 3.3 Visitor screen composition

```text
PHONE PORTRAIT 360 x 640                PHONE LANDSCAPE 740 x 360
+-----------------------------+         +---------------------------------------------+
| [Pictures]  5 of 12   [?]   |         | [Pictures] [Where next?]      5 of 12   [?] |
| +-------------------------+ |         |                                +-----------+|
| | (T) Tom  Photo 3    [X] | |         |                                | (T) Tom [X]||
| | "Caption text ..."      | |         |        (3D scene,              | "Caption   ||
| +-------------------------+ |         |         centre clear)          |  text ..." ||
|                             |         |                                +-----------+|
|    Tom            Sophie    |         |   Tom       Sophie                          |
|     (labels over heads)     |         |                                             |
|  ( joystick )               |         |  ( joystick )                               |
+-----------------------------+         +---------------------------------------------+

DESKTOP 1280 x 720
+--------------------------------------------------------------------------------+
| [Pictures] [Where next?]                 5 of 12                [Reset] [?] [Cog] |
|                                                              +------------------+
|                                                              | (T) Tom   Photo 3 |
|                  (3D scene, centre clear)                    | "Caption ..."  [X]|
|                                                              +------------------+
|        Tom        Sophie                                                         |
|   [ W A S D or arrows to walk . drag to look around ]   (fades after first use)  |
+--------------------------------------------------------------------------------+
```

| HUD element | Position | MVP or R2 | Size |
|---|---|---|---|
| Help button `?` | Top-right | MVP | 44 px round |
| Reset view | Top-right, left of Help; appears only after the camera is turned away from default | MVP | 44 px round |
| Settings | Top-right, left of Reset view | R2 | 44 px round |
| Pictures (list) | Top-left | R2 | 44 px round |
| Where next? | Top-left, right of Pictures | R2 | 44 px tall pill with label |
| Viewed progress "5 of 12" | Top-centre | R2 | Pill, 32 px tall (not interactive) |
| Joystick | Bottom-left, `--hud-margin` plus safe areas from the edges | MVP (touch) | 128 px base, 56 px knob, 176 px hit area |
| Look-around | Whole canvas outside controls and the joystick hit area | MVP | Drag |
| Controls hint chip | Bottom-centre (desktop) or above the joystick (touch) | MVP | Auto-hides |
| Caption card | Docked by the placement rule (3.5) | MVP | Section 5.6 |
| Preview bar | Full-width strip above the HUD in preview only; HUD top inset grows by `--preview-bar-height` | MVP | 44 px |

The Help sheet (MVP) is a short, non-blocking sheet: "How to explore" with the three ideas (walk, pause by a picture, tap a picture), the control table for the current device, and an accessibility note about the keyboard. It is the only way to re-read the coaching hints.

### 3.4 Camera composition targets (for the scene-developer)

The architecture gives a starting boom of 3.5 m at 2.2 m height. At that setting the Visitor fills about half of a portrait screen and hides the picture being looked at, so tune to these screen-space targets instead. Full camera behaviour is in 6.3.

| Viewport | Visitor height on screen | Feet at (from top) | Notes |
|---|---|---|---|
| Phone portrait | 24 to 32% of viewport height | 70 to 74% | The bottom 26% is the joystick zone. The top 30% stays free for the caption card |
| Phone landscape | 42 to 50% | 80% | Left and right 30% columns stay free for the joystick and the caption card |
| Tablet and desktop | 36 to 44% | 82% | Right 30% column stays free for the caption card |

Achieve this with boom length, vertical FOV (50 to 60 degrees), and a constant view offset (`camera.setViewOffset`) that never changes during a session. The offset is a fixed composition, not camera motion.

These targets are for the **follow** camera. During a presentation the camera moves to the framing in 6.12, which has its own targets (the Visitor is smaller than in a close follow view on portrait, 18 to 34% of the viewport height, and larger on landscape and wide screens, up to 50% and 48%, because the picture's minimum width decides the scale; see 6.12.2; and because the picture and both characters must fit). The FOV and the view offset stay exactly the same in both modes.

### 3.5 Caption card placement rule (FR-64, US-12)

The caption card must cover neither the Visitor nor the active picture. Because the camera is user-controlled, the card is placed by a small pure function, `chooseCaptionDock(inputs): Placement`, in `src/ui/overlays/` (frontend-developer), unit-tested.

**Inputs** (screen-space rectangles in CSS px, refreshed about every 100 ms while a presentation is active, not per frame):

| Input | Meaning |
|---|---|
| `viewport` | Window inner size minus safe areas |
| `keepOut` | HUD rectangles the card must not cover: top bar, joystick base (touch), preview bar, and the Look closer or Retry chip when shown |
| `picture` | Bounding rectangle of the active picture's frame projected to the screen, or none if off-screen or behind the camera |
| `actors` | Bounding rectangles of the Visitor and the Guide including their name labels |
| `bigText` | Whether the caption scale is above 1 |

**Candidate placements, evaluated in order.** Each is a dock plus a size. There are three sizes (v1.4):
- **Full:** up to the dock's maximum height, scrolling inside if the caption is longer.
- **Fitted (new):** the same card as Full, in the same dock, anchored at the dock's top edge, with its height cut to the clear height: the distance from the dock's top edge down to the first rectangle that would touch it (picture, actors, keepOut, each grown by 8 px), reduced in 8 px steps. Valid only if the result is at least `--panel-fit-min-height` (8 rem, 128 px) and below the Full height. It keeps the normal header (badge, name, "Photo n of N", Look closer, Close) and shows as many caption lines as fit, scrolling inside for the rest.
- **Strip:** the caption strip in 5.6: 104 px tall at normal text size (`--panel-peek-height`, 6.5 rem), header row plus **two caption lines**, with Read more when the caption is cut off. Strip heights at larger caption scales: 112 px at 1.25 and 124 px at 1.5 (header 44 + padding 12 + two lines at 1 rem x scale x 1.4, rounded up to 4 px). `bigText` never reduces the line count below two. On portrait, a strip at the top also reserves its band against name labels: they slide down to the strip's bottom edge, 68 px plus the strip height (5.5, "Framed view, portrait: below the caption strip").

| Layout | Order |
|---|---|
| Phone portrait | 1 top, full (below top bar, full width minus `--hud-margin`, up to the smaller of 32 dvh and 14 rem). 2 top, fitted. 3 top, strip. 4 bottom strip above the joystick |
| Phone landscape | Card width `--card-width-landscape` = `clamp(16rem, 30vw, 22rem)`. 1 right, full (between top bar and bottom). 2 left, full, above the joystick. 3 right, fitted. 4 right, strip. 5 left, strip, above the joystick |
| Tablet and desktop | Card width `--card-width-wide` = `clamp(18rem, 28vw, var(--panel-max-width))`, 24 px from the edge. 1 right, full (up to 50 dvh). 2 left, full. 3 right, fitted. 4 right, strip. 5 bottom-centre strip |

**Card minimum width (confirmed, adjusted).** `MIN_CARD_WIDTH` is **16 rem (256 px)** (`--card-min-width`), and no dock is ever narrower unless the viewport is. The card is a container (`container-type: inline-size`); Look closer shows its text only when the card is 24 rem or wider, and the title column keeps a minimum of 5.5 rem so a name never wraps one letter per line (the header must fit at 256 px: 12 + 32 + 8 + 88 + 8 + 44 + 4 + 44 + 12 = 252). If QA finds the full header does not fit at 256 px, the developer may raise the constant to 17 rem (272 px) but must then tell the scene-developer, because the framing's right bound uses the same value (6.12.2).

**Where each size lands (expected, for the four test viewports, scale 1).** The dock function measures real rectangles; these are the numbers it should produce when the framing is behaving, so QA can spot a regression. The top bar is taken as about 64 px including its margin.

| Viewport | Dock and card width | Full height | Fitted | Strip (104 px) |
|---|---|---|---|---|
| 360 x 640 | Top, 336 px (full width minus 2 x 12), starts at about y 64 | min(32 dvh = 205, 14 rem = 224) = 205 px, reaches y 269, blocked by the picture (top of the safe rectangle is y 192) | Clear height about 112 px, under the 128 px minimum, so not valid | **Yes: y 64 to 168, clear of the picture by at least 24 px** |
| 390 x 844 | Top, 366 px, starts at about y 64 | min(270, 224) = 224 px, reaches y 288, blocked (safe rectangle starts at y 253) | **Valid: about 168 px (y 64 to 232)** | Not needed |
| 844 x390 | Right, 256 px (30 vw = 253, raised to 256), left edge x 576, between y 66 and y 378 | Up to about 312 px | Valid if the Guide's rectangle blocks the lower part | y 66 to 170 if the column is only partly clear |
| 1280 x 720 | Right, 358 px (28 vw), left edge x 898, between y 72 and y 360 | 50 dvh = 360 px | Valid if blocked below | y 72 to 176 |

**Selection.** Pick the first candidate whose rectangle, grown by 8 px, does not intersect `picture`, any `actors` rectangle, or `keepOut`. If none qualifies, pick the candidate with the least intersection with `picture` (the Visitor takes second priority), **always in strip size** (the 104 px strip, so the caption is still readable). In that last case the strip is allowed to overlap the picture's edge, never the picture's centre third, if any candidate achieves that; if none does, the one with the least picture area wins. Expanding a strip with Read more is an explicit user action, so it may then overlap.

**How the strip avoids covering the picture and Visitor.** The strip is the smallest card that keeps the caption readable, so it is tried only after Full and Fitted fail in every dock. The framing reserves the dock (6.12.2), so on all four test viewports a strip normally lies fully inside the reserved column or band. Where it cannot, the strip overlaps the least picture area, picks the dock with the least overlap with the Visitor second, and the Visitor can still open the full card or the viewer. A strip never covers the Close button of another control (keepOut), and it never grows after placement except by Read more.

**Stability.**
- Once placed, keep the placement unless it has overlapped for 400 ms or more or the layout changes. Never move a card while the Visitor is typing, scrolling its text or has focus inside it.
- **Upgrade rule (v1.4).** A card placed as Fitted, Strip or the least-overlap fallback may move to a better candidate (earlier in the table, so Full beats Fitted beats Strip, and a preferred dock beats a later one). Cards placed as Full in their first-choice dock never move for upgrades. All of these must hold:
  1. **Settled camera only.** Upgrades are evaluated only while the presentation camera mode is `framed`, `follow` or the 300 ms after a `cut` has ended, never during `entering` or `returning`. One free re-choice is allowed at the first `framed` signal if the card appeared earlier (the 1.5 s cap case), with no dwell and no cool-down.
  2. **Dwell.** The better candidate must have been clear (no intersection with `picture`, `actors` or `keepOut`) for **600 ms in a row** of the 100 ms samples. Any sample where it is blocked resets its timer. Each candidate has its own timer.
  3. **Hysteresis.** The upgrade test grows the candidate by **16 px** (the stay test uses 8 px), so a candidate that only just clears is not taken.
  4. **Cool-down.** After any placement change, no upgrade for 1.5 s. After a downgrade (an overlap of 400 ms or more), no upgrade for 3 s.
  5. **Cap.** At most **two upgrades per presentation**, then the placement is frozen until the layout changes.
  6. **Never during interaction.** Not while the card is expanded by Read more, has focus inside it, is being scrolled or touched, or the Visitor is typing. The timers keep running but the move waits until the interaction ends plus 600 ms.
  7. **Same element.** The card is the same DOM element, so focus is not lost. If focus was on Read more and the new size hides it, focus moves to Close. An upgrade is never announced (the live region is not touched) and never replays the entering animation; it cross-fades in `--duration-fast`.
  A downgrade is the existing rule: overlap for 400 ms or more moves the card to the best clear candidate, or to the least-overlap strip.
- Placement changes cross-fade in `--duration-fast`. Under reduced motion they are instant.
- A caption longer than the dock's height scrolls inside the card. The scroll area has `tabindex="0"` so keyboard users can scroll it.
- The Close button is always in the header and never scrolls away.

QA check: in Playwright at 360 by 640, 390 by 844, 844 by 390 and 1280 by 720, with the default camera, the card's rectangle must not intersect the picture rectangle for a short, a 140-character and a 280-character caption.

**Acceptance criteria for the strip, the fitted card and the upgrade rule (v1.4).** Run at the four viewports above, at the framed pose, for a short (30 characters), a 140-character and a 280-character caption, at caption scale 1 and 1.5, and with a Guide name of 1 and of 24 characters.
- **S1 Readable caption.** Whatever size is placed, the caption's first line is visible: its bounding box is inside the card's visible box and has a height of at least 1 line (not clipped by the header or the card edge). In a strip, **two lines** are visible when the caption has two lines or more; a one-line caption shows one. No caption text is ever hidden behind the header (`getBoundingClientRect` of the first caption line is below the header's bottom).
- **S2 Strip size.** A strip's height is 104 px (+/- 1) at scale 1, 112 at 1.25 and 124 at 1.5, and its width is at least 256 px (or the viewport width if narrower). Header row is 44 px.
- **S3 Truncation and Read more.** If the caption needs more than two lines in the strip, the second line ends in an ellipsis and **Read more** is shown (button, at least 44 px high, `aria-expanded="false"`). If it fits, there is no Read more and **Look closer** (icon button, 44 px) is shown in its place. Read more expands in place to the full card (scrolling inside), `aria-expanded="true"`, the label changes to Show less, and focus stays on the button.
- **S4 Controls.** In every size, Close is at least 44 by 44 px and never clipped; no control overlaps another; the name never wraps one letter per line (the name box is at least 5.5 rem wide at 256 px card width and shows an ellipsis if longer); no horizontal scrolling.
- **S5 Footprint.** At the four viewports with the framing behaving, the strip does not intersect the picture rectangle grown by 8 px. If it must (all candidates blocked, forced by a test fixture), it overlaps the picture by no more than 15% of the picture area and not its centre third, and the caption is still readable (S1).
- **S6 Fitted.** At 390 x 844 the placed size is Fitted at roughly 168 px (+/- 16), not a strip, with at least three caption lines visible for the 140-character caption.
- **S7 Widths.** The landscape card is 256 px wide at 844 px (computed from `clamp(16rem, 30vw, 22rem)`), 270 to 280 px at 932, 352 px at 1,200 or wider; the wide card is 358 px at 1280, 288 px at 1024. The card's left edge is at or right of the framing safe rectangle's right edge at 844 x 390 and 1280 x 720.
- **U1 Upgrade happens.** Fixture: the card is placed as a strip because a candidate is blocked; the blocker is removed (move the Guide rectangle away) and stays away. The card upgrades once, between 600 and 800 ms after the blocker clears, and the DOM element and focus are unchanged.
- **U2 No flicker.** Fixture: the blocker toggles on and off every 300 ms for 10 s. The placement changes at most once in that time, never back and forth, and never more than twice per presentation.
- **U3 Hysteresis.** A candidate that clears with a gap of 9 to 15 px is not taken as an upgrade.
- **U4 Cool-down and cap.** No two placement changes are closer than 1.5 s (3 s after a downgrade); a third upgrade never happens.
- **U5 No upgrade during interaction.** With the card expanded, focus in it, or the Visitor scrolling it, no upgrade happens until the interaction ends plus 600 ms.
- **U6 Camera motion.** No upgrade starts during `entering` or `returning`.
- **U7 Reduced motion.** Upgrades are instant (no cross-fade), the same timers apply.
- **U8 No announcement.** An upgrade causes no live-region update.
- **G1 Copy.** The strip and fitted copy contain no he, she, her, him, his, girlfriend or boyfriend (FR-76 scan, 10.1).

**With the presentation camera (v1.2).** The card appears only after the framing has settled or the Guide has arrived, whichever is later (6.12.3), so the dock function always measures the framed pose. The card's rectangle must also not intersect the Visitor's or the Guide's rectangle (labels included) at the framed pose. The framing reserves the card's default dock (top in portrait, right in landscape and wide) in its safe rectangle (6.12.2), so the first candidate placement normally wins. Repeat the QA check above with the framed pose.

**Finale card exception (as built, v2.0.2).** The finale card may grow past its placement height, up to 90% of the screen, so its footer and message never clip. This is the only card allowed to exceed its placement size; see 12.6.5.

### 3.6 Builder layouts

```text
PHONE (360)                              DESKTOP (1280)
+---------------------------+            +---------+-----------------------------------+
| Surprise Museum   Preview |            | Logo    |  Step 3 of 4: Characters           |
| Step 3 of 4  [==][==][=][ ]|            |         |                                    |
|                           |            | 1 Photos|  +-------------+  Guide | Visitor  |
| Characters                |            | 2 Words |  |   live 3D   |  Face and skin   |
| +-----------------------+ |            | 3 Chars |  |   preview   |  Hair             |
| |   live 3D preview     | |            | 4 Publ. |  | (sticky)    |  Outfit           |
| |  Tom        Sophie    | |            |         |  +-------------+  Body             |
| +-----------------------+ |            |         |                                    |
| [Guide: Tom][Visitor: Sophie]|          |         |  [Back]                    [Next] |
| Face | Hair | Outfit | Body|           +---------+-----------------------------------+
| (option tiles ...)        |
+---------------------------+
| [ Back ]          [ Next ]|  sticky action bar, safe-area padded
+---------------------------+
```

The sticky bar and the header never hide a focused control (WCAG 2.4.11): `scroll-padding-block` in `base.css` reserves their height.

---

## 4. Design tokens

### 4.1 Summary

All tokens are CSS custom properties in `src/styles/tokens.css`. Scene tokens (`--scene-*`) and avatar tokens (`--avatar-*`) are references for the technical-artist, who mirrors them in code with a comment pointing to this document.

| Group | Tokens | Notes |
|---|---|---|
| Colour: paper | `--color-bg`, `--color-surface`, `--color-surface-sunken`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-strong` | `--color-border` is decoration only; use `--color-border-strong` for control outlines |
| Colour: action | `--color-accent`, `-hover`, `-active`, `-tint`, `--color-on-accent` | Claret |
| Colour: brass | `--color-brass`, `-hover`, `-deep` | Decorative on paper; text and icons on night |
| Colour: states | `--color-danger`, `-hover`, `--color-on-danger`, `-tint`; `--color-success`, `-tint`; `--color-warning-text`, `-tint`, `-border`; `--color-info-tint` | Always with an icon and words |
| Colour: night | `--color-night`, `-raised`, `--color-hud`, `--color-hud-solid`, `--color-on-night`, `--color-on-night-muted`, `--color-accent-on-night`, `--color-danger-on-night`, `--color-scrim`, `--color-viewer-bg` | `--color-hud` falls back to solid without `backdrop-filter` |
| Focus | `--color-focus`, `--color-focus-edge` | Two-tone ring, rule in `base.css` |
| Name labels | `--label-bg`, `--label-fg`, `--label-ring`, `--label-ring-width`, `--label-dot-visitor`, `--label-dot-guide`, `--label-font-size`, `--label-max-width`, `--label-padding-x`, `--label-padding-y` | Section 5.5 |
| Scene | `--scene-wall`, `-wall-shade`, `-skirting`, `-floor`, `-floor-grain`, `-ceiling`, `-runner`, `-runner-edge`, `-frame`, `-mat`, `-brass`, `-brass-deep`, `-plaque`, `-plaque-ink`, `-light-warm`, `-light-sky`, `-light-ground`, `-pool`, `-finale-wall`, `-finale-floor`, `-podium`, `-spot`, `-blob-shadow`, `-hint-glow` | Section 1.4 and 1.5 |
| Avatar | `--avatar-skin-01..10`, `--avatar-skin-blush`, `--avatar-hair-*` (11), `--avatar-outfit-*` (12), `--avatar-denim`, `-trousers`, `-joggers`, `-shoes`, `-sole`, `-eye`, `-badge-*` | Appendix A |
| Type | `--font-display`, `--font-sans`, `--font-body` (alias), `--text-xs..3xl`, `--text-display`, `--leading-*`, `--weight-*`, `--tracking-eyebrow`, `--measure-reading`, `--caption-scale`, `--caption-size` | `--caption-scale` is 1, 1.25 or 1.5 from Settings (R2) |
| Space | `--space-1..6, 8, 10, 12, 16` (4 px scale) | |
| Size | `--touch-target` (44), `--touch-target-lg` (56), `--icon-sm/md/lg`, `--hairline`, `--border-control` (2), `--border-selected` (3), `--joystick-*`, `--hud-margin`, `--panel-max-width`, `--panel-peek-height` (6.5 rem since v1.4), `--panel-fit-min-height` (8 rem), `--panel-strip-lines` (2), `--card-min-width` (16 rem), `--card-width-landscape`, `--card-width-wide`, `--sheet-max-height`, `--content-max-width`, `--content-wide-max-width`, `--preview-bar-height`, `--safe-*` | |
| Shape and depth | `--radius-sm/md/lg/xl/pill`, `--radius-2` (alias), `--shadow-card/panel/hud/label`, `--shadow-inset-frame`, `--blur-panel` | |
| Layers | `--z-canvas` 0, `--z-labels` 5, `--z-hud` 10, `--z-preview-bar` 14, `--z-panel` 20, `--z-sheet` 22, `--z-fade` 24, `--z-viewer` 26, `--z-screen` 28, `--z-modal` 30, `--z-toast` 40 | Name labels sit below every panel (ADR 0011). Pass `zIndexRange={[5, 0]}` to drei `Html` |
| Motion | `--duration-instant/fast/normal/slow/camera/fade-through/gender-morph`, `--duration-presentation-camera-in` (800 ms), `--duration-presentation-camera-out` (600 ms), `--ease-standard/emphasised/out`, `--ease-camera`, `--press-scale` | All durations are 0 ms under reduced motion. The two presentation-camera durations and `--ease-camera` are mirrored by the scene (6.12.3) |

**CR-4 additions (v2.0).** Full list with values and uses in 12.9. Added: `--text-micro` (12 px), `--text-hero`, `--text-lead`, `--leading-snug`, `--tracking-display`; `--space-7`, `-14`, `-20`, `--target-gap`, `--page-gutter`, `--section-gap`; `--touch-target-md`, `--sheet-max-height-phone`, `--bar-min-height`, `--bar-min-height-compact`, `--progress-bar-height`, `--photo-thumb-size`, `--tile-height`, `--accent-bar-width`, `--preview-sticky-height`, `--joystick-*-compact`; `--color-surface-raised`, `--color-bg-glow`, `--color-accent-top`, `--color-accent-wash`, `--gradient-page`, `--gradient-accent`, `--color-divider-night`, `--color-track-night`; `--shadow-raised`, `-button`, `-button-pressed`, `-glass`, `-bar`, `-art`; `--z-sticky`; `--duration-overlay`, `--duration-stagger`, `--rise-distance`; `--avatar-skin-blush-deep`; and the `--look-*` finish group. **Value changes:** `--text-xs` 13 to 14 px; `--scene-ceiling`; `--scene-light-ground`. No token was renamed or removed.

Scaffold names kept for compatibility: `--font-body`, `--radius-2`, `--touch-target`, `--color-accent`, `--color-surface`, `--color-text`, `--space-2`, `--space-4`.

### 4.2 Contrast record (WCAG 2.2 AA)

Ratios calculated from the token hex values with the WCAG relative-luminance formula. Required: 4.5:1 for text, 3:1 for large text, icons and component boundaries. QA should re-verify with a tool.

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `--color-text` | `--color-surface` | 14.7 | Body text |
| `--color-text` | `--color-bg` | 13.4 | Body text on page |
| `--color-text` | `--color-surface-sunken` | 12.7 | Text in wells |
| `--color-text-muted` | `--color-surface` | 6.0 | Helper text, counters |
| `--color-text-muted` | `--color-bg` / `--color-surface-sunken` | 5.4 / 5.2 | Helper text, placeholders |
| `--color-accent` | `--color-surface` / `--color-bg` / `--color-surface-sunken` | 7.8 / 7.1 / 6.7 | Links, secondary button text |
| `--color-on-accent` | `--color-accent` | 7.8 | Primary button |
| `--color-on-danger` | `--color-danger` | 6.1 | Danger button |
| `--color-danger` | `--color-surface` / `--color-bg` / `--color-danger-tint` | 6.1 / 5.5 / 5.4 | Error text |
| `--color-success` | `--color-surface` / `--color-success-tint` | 5.9 / 5.4 | Success text |
| `--color-warning-text` | `--color-warning-tint` / `--color-surface` | 6.6 / 6.9 | Edit-link warning |
| `--color-warning-border` | `--color-warning-tint` | 3.3 | Warning box outline |
| `--color-border-strong` | `--color-surface` / `--color-bg` / `--color-surface-sunken` | 4.8 / 4.4 / 4.2 | Input and swatch outlines (needs 3) |
| `--color-accent` | `--color-accent-tint` | 6.3 | Selected tile outline |
| `--color-on-night` | `--color-hud-solid` | 15.3 | HUD text and icons |
| `--color-on-night` | HUD glass over a pure white scene pixel (worst case, 84% opacity) | 8.7 | HUD in the worst case |
| `--color-on-night-muted` | `--color-hud-solid` | 9.9 | Secondary HUD text |
| `--color-accent-on-night` | `--color-hud-solid` | 9.1 | Links on night |
| `--color-danger-on-night` | `--color-hud-solid` | 8.7 | Errors on night |
| `--color-brass` | `--color-hud-solid` | 7.3 | Icons and highlights on night |
| `--color-text` | `--color-brass` | 6.6 | Text on a brass button (night primary) |
| `--color-on-night` | `--color-viewer-bg` | 16.8 | Full-screen viewer chrome |
| `--label-fg` | `--label-bg` | 16.3 | Name labels |
| `--color-focus` | `--color-hud-solid` | 12.2 | Focus ring on night |
| `--color-focus-edge` | `--color-surface` / `--color-bg` | 14.7 / 13.4 | Focus ring on paper |

**Name labels over any wall.** The pill has a near-black fill and a near-white hairline ring. Over any backdrop with relative luminance L, the fill edge contrasts at (L + 0.05) / 0.0597 and the ring at 0.97 / (L + 0.05). The worse of the two is never below 3.8:1 at any L (the mid-grey case), so the pill edge is always distinguishable. Checked specifically against linen walls (12.5:1 fill edge), oak floor (5.7:1) and the claret finale wall (11.3:1 ring).

**Not allowed:** brass as text on paper; muted text on night; any text over the 3D scene without a solid or glass backing; colour as the only state cue.

---

## 5. Components

Every control meets 44 by 44 px, has a visible two-tone focus ring (`base.css`), and keeps its state visible without colour alone. State columns: **D** default, **H** hover (pointer only), **F** focus, **A** active (pressed), **X** disabled, **L** loading.

### 5.1 Buttons

| Variant | D | H | A | X | L |
|---|---|---|---|---|---|
| Primary | `--color-accent` fill, `--color-on-accent` text, 56 px tall (calls to action) or 44 px, radius pill | `--color-accent-hover` | `--color-accent-active`, scale `--press-scale` | 45% opacity, `aria-disabled` and a reason in text nearby | Spinner replaces the label's icon, label becomes "Publishing...", `aria-busy`, ignores presses |
| Secondary | `--color-surface` fill, `--border-control` solid `--color-accent`, accent text | Fill `--color-accent-tint` | Tint plus scale | As above | As above |
| Tertiary | Text and icon in accent, underline on hover, 44 px target | Underline | Tint | As above | As above |
| Danger | `--color-danger` fill, `--color-on-danger` text | `--color-danger-hover` | Darker plus scale | As above | As above |
| Night icon (HUD) | 44 px circle, `--color-hud` glass, 24 px `--color-on-night` icon, 1 px `--color-on-night` at 25% ring | Fill `--color-night-raised` | Scale `--press-scale` | 45% | Spinner |
| Night primary | `--color-brass` fill, `--color-text` label | `--color-brass-hover` | Scale | | |

Prefer enabled buttons that explain what is missing on press (inline error plus focus to the first problem) over disabled buttons that hide the reason. Use `aria-disabled` only for genuinely unavailable actions such as Publish while photos are still uploading, and say why in adjacent text.

### 5.2 Fields

| Part | Spec |
|---|---|
| Text field, textarea | Visible label above (never placeholder-only), 16 px text, 48 px minimum height, `--border-control` solid `--color-border-strong`, radius `--radius-md`, fill `--color-surface`. Helper text below in muted. Counter at the bottom right ("12 / 280"). Focus: ring. Error: border `--color-danger`, icon plus message below, `aria-invalid`, `aria-describedby` |
| Character limits | Input stops at the limit and the helper line changes to "That is the limit: 24 characters" (US-4, US-3). The counter is not a live region; the limit message is `role="status"` |
| Name fields | `autocapitalize="words"`, `autocomplete="off"`. The native `maxlength` attribute counts UTF-16 units, so enforce the limit in code by Unicode code points (as `contract.ts` does) so that an emoji counts as one character |
| Closing message | `lang="en-AU"`, spellcheck on, 6 rows, line breaks kept |
| Consent checkbox | 24 px box in a 44 px row, the label is the full sentence. The terms and privacy links open in a new tab with `rel="noopener"`, because the draft is held in memory and must not be lost |

### 5.3 Option tiles, swatches and tabs (customiser)

| Component | Spec |
|---|---|
| Swatch (skin, hair colour, outfit colour) | 44 px circle in a 52 px cell, 2 px `--color-border-strong` ring so the lightest swatches show on paper, selected: 3 px `--color-accent` ring plus a check mark inside, name in `aria-label` and a tooltip-free visible label for the group's current value ("Hair colour: Auburn") |
| Text tile (gender, hair style, outfit, body type, height, facial hair) | 44 px minimum height, label centred, radius `--radius-md`, selected: `--color-accent-tint` fill, `--border-selected` accent ring, and a check icon. Gender tiles are text only, with no pictograms or silhouettes (9.4) |
| Group | `role="radiogroup"` with a visible group label. Arrow keys move and select within the group (roving `tabindex`), Tab leaves the group |
| Tabs (Guide or Visitor; Face, Hair, Outfit, Body) | `role="tablist"`, automatic activation, arrow keys, `aria-selected`, 44 px tall, active tab has a 3 px accent underline plus bold weight |

### 5.4 Photo row (builder step 1)

> **v2.0:** the row's layout and density are superseded by 12.5.1 (compact row, 8 px between actions). Every state, label and keyboard rule below is unchanged.

States: **uploading** (progress bar plus "Uploading 62%"), **processing** ("Preparing photo..."), **ready** (check plus "Ready"), **failed** (alert icon, reason, **Retry**), **removed** (row leaves; announced "Photo removed").

```text
+-----------------------------------------------------+
| [grip] [thumb 64x64 contain]  Photo 3        62%  |
|                               Uploading...         |
| Caption (optional)                                  |
| +-------------------------------------------------+ |
| |                                                 | |
| +-------------------------------------------------+ |
|                                            12 / 280 |
| [ Earlier ] [ Later ] [ Replace ] [ Remove ]        |
+-----------------------------------------------------+
```

- The thumbnail uses `object-fit: contain` on a sunken background, so the Creator sees the true aspect ratio (nothing is cropped, matching the museum).
- Reorder: drag the grip (mouse), long-press 300 ms then drag (touch), keyboard on the grip (Space picks up, arrows move, Space drops, Escape cancels, announced politely: "Photo 3 moved to position 2 of 7"), and the **Earlier** and **Later** buttons, which are the single-pointer alternative required by WCAG 2.5.7. **Earlier** is absent on the first row and **Later** on the last (not just disabled).
- The grip has `touch-action: none`; the rest of the row scrolls normally.
- **Remove** asks for confirmation inline ("Remove photo 3 and its caption? [Remove] [Keep]"). **Replace** keeps the caption (US-3).
- On desktop (1024 px and wider) rows become a three-column grid of the same cards.

### 5.5 Name label (3D, DOM via drei `Html`)

```text
  ( heart )  Sophie        Visitor label: night fill, cream hairline ring, rose heart marker
  ( diamond )  Tom         Guide label:   same, brass diamond marker
```

| Property | Spec |
|---|---|
| Fill and text | `--label-bg` solid, `--label-fg` text, 600 weight, `--label-font-size` (15 px), `--leading-tight` |
| Edge | `--label-ring-width` solid `--label-ring` (hairline that separates the pill from dark walls) plus `--shadow-label` |
| Shape | Pill (`--radius-pill`); one line when it fits, wraps to as many as three lines for long names (`--radius-md` when wrapped), `overflow-wrap: anywhere`, never truncated (names must show exactly as typed) |
| Size | `max-width: min(var(--label-max-width), 44vw)`, padding `--label-padding-y` by `--label-padding-x`. Constant screen size: do not scale with distance |
| Marker | A 10 px CSS shape before the name: heart (rose) for the Visitor, diamond (brass) for the Guide. Decorative, `aria-hidden`. Not relied upon |
| Position | Centred 0.35 m above the head (scaled with height). `pointer-events: none`, `user-select: none`, `aria-hidden="true"` (ADR 0011) |
| Visibility | Always shown while the character is on screen (FR-17). Hidden, with a `--duration-fast` fade, when the wall line-of-sight test fails or the character is off-screen; instant under reduced motion |
| Collision | If the two labels overlap on screen, raise the label of the character farther from the camera by its own height plus 4 px (once) |
| Framed view (v1.2) | While the presentation camera is active (6.12), a label must not cover the picture. The framing solver counts each label's rectangle as part of its character (6.12.4). If a label still intersects the picture rectangle grown by 8 px, shift that label sideways, away from the picture's centre, by up to half its own width (eased over `--duration-fast`, instant under reduced motion). The label is never hidden and never scaled (FR-17). The 5.5 label-collision rule still applies after the shift |
| Framed view, portrait: below the caption strip (v1.5, BUG-10) | On portrait screens during a photo presentation the caption strip (3.5, 5.6) is a reserved band at the top of the screen. A label never sits above the strip's bottom edge: if its top would be higher, it slides down until its top is on that edge. The edge is **68 px plus the strip height** from the top of the viewport (68 px is the top bar and its margin), and the strip height follows the caption size setting:<br>Caption scale 1: 68 + 104 = **172 px**<br>Caption scale 1.25: 68 + 112 = **180 px**<br>Caption scale 1.5: 68 + 124 = **192 px**<br>Rules: (a) this shift is applied **last**, after the sideways shift away from the picture and after the label-collision rule above, so it always wins. (b) It applies to both labels, including the Guide's at her presentation spot. (c) The label may overlap the Guide's head (or the Visitor's) by a few pixels. It must **never** overlap the picture: the framing's safe rectangle already keeps the picture clear of the strip, and the label only moves down to the strip edge, not over the picture. (d) Label size, text and wrapping do not change (FR-17). (e) Eased over `--duration-fast`, instant under reduced motion, like the other shifts. (f) The rule applies only on portrait screens; landscape and wide layouts are unaffected. The framing solver itself is unchanged. QA check: at 360x640 with caption size 1.5 and a 24-character Guide name, the label's top is at least 192 px and the label does not intersect the picture |
| Layer | `--z-labels`, below the HUD and every panel |
| Builder preview | The same style under each preview character, so Creators see exactly what the Visitor will see (US-7) |

### 5.6 Caption card (Guide presentation) (MVP)

```text
+---------------------------------------------+
| (T)  Tom                    [Look closer][X] |   header: badge, name, actions (44 px)
|      Photo 3 of 12                           |
|---------------------------------------------|
| "We found this place by accident and        |   body: Fraunces 400, --caption-size,
|  stayed all afternoon."                     |   --leading-reading, scrolls if long
+---------------------------------------------+
                 \  (optional tail towards the Guide)
```

| Property | Spec |
|---|---|
| Surface | `.surface-paper`, radius `--radius-lg`, brass inset hairline. Opaque, so ink text is 14.7:1 over any scene |
| Header | 36 px round badge filled with the Guide's outfit colour showing the first letter of the Guide's name (letter colour chosen at runtime for 4.5:1; `aria-hidden`), the Guide's name in the display font ("labelled with the Guide's name", FR-26), "Photo n of N" in muted text, a 44 px **Look closer** button (opens the full-screen viewer, 5.8; icon plus text, text hidden below 400 px wide with `aria-label` kept), and a 44 px Close button |
| Body | Caption text with `.user-text` (line breaks kept). Max measure `--measure-reading` |
| Strip variant (v1.4) | Used only when placement gives a strip (3.5). Same paper surface, radius and element as the full card; height 104 px at scale 1 (`--panel-peek-height`). **Row 1 (44 px):** 28 px badge, the Guide's name (Fraunces 600, `--text-md`, one line, ellipsis), then on the right one action and Close. "Photo n of N" is not drawn in a strip (it stays in the region's accessible name, as visually hidden text); it is drawn again if the card is 22 rem or wider and the name leaves room (muted, after the name). **Row 2:** the caption, Fraunces 400 at `calc(var(--text-md) * var(--caption-scale))`, `--leading-reading` capped at 1.4, `.user-text` colour, clamped to **two lines** (`-webkit-line-clamp: var(--panel-strip-lines)`, 2), line breaks collapsed to spaces so the two lines carry as much text as possible, ellipsis at the cut, **no fade-out and no clipping**. Padding 12 px sides, 4 px top, 8 px bottom. **The action:** if the caption is cut off, a text button **Read more** (`--text-sm`, 44 px high, brass-on-paper link style, `aria-expanded`, `aria-controls` the caption); if it is not cut off, the **Look closer** icon button (44 px) instead. Read more expands in place to the full card (Look closer is in its header again) and becomes **Show less**. Close is always 44 by 44. Width needed at 256 px: 12 + 28 + 8 + name 60 + 8 + Read more 80 + 4 + Close 44 + 12 = 256 (the name ellipsises first) |
| Fitted variant (v1.4) | The full card cut to a clear height (3.5): normal header, caption scrolls inside; no Read more (the whole card is already the reading view); the scroll area has `tabindex="0"` |
| Tail (Should) | A 12 px triangle on the card edge pointing at the Guide's head position; hidden if the Guide is off-screen. Decorative |
| States | **Entering:** fade and rise 8 px in `--duration-fast` (instant under reduced motion). **Open.** **Strip:** header row plus two clamped caption lines and **Read more** (see Strip variant; v1.4 replaced the fade-out). **Scrolling:** a thin scroll shadow at the clipped edge. **Exiting:** fade in `--duration-fast`. There is no loading state: it appears when the Guide arrives or after 1.5 s at most (architecture 6.4) |
| Close | The Close button, Escape, or Enter or Space while focus is on the canvas. Dismissal ends the presentation and suppresses that picture until the Visitor is past 4.5 m (FR-27, A-19). Walking away past 4.5 m closes it with no action |
| No caption | No card appears (FR-71). The Guide still walks over and faces the picture |
| Semantics | `role="region"` with `aria-labelledby` on the header. Not a dialog: it does not trap focus or steal it. Announcement is by a separate `role="status"` live region (8.3). Placement: 3.5 |
| Release 2 | The greeting (FR-9) reuses the same card with the header "Tom says hello" |

### 5.7 Finale card (MVP)

Same shell as the caption card with these differences.

| Property | Spec |
|---|---|
| Header | A brass heart seal icon, the heading "A note from {Guide}" (display font), and no Close button; the footer buttons dismiss it |
| Body | The closing message, `.user-text`, `--caption-size`, line breaks preserved. If empty: heading "The end" and the text "Thanks for visiting, {Visitor}." |
| Footer | **Keep exploring** (primary) and **Replay from the start** (secondary), each at least 44 px tall, always visible below the scroll area |
| Long message | Up to 1,000 characters. In a compact dock the body shows about 5 lines with **Read the whole note**, which opens a full-height reading sheet (modal, focus trapped, Escape closes) that has the same footer buttons |
| Entering | Appears within 1.5 s of stepping on the podium (as the caption card). Reduced motion: appears instantly with no celebratory effect |
| Re-entry | Stepping off the podium (beyond r + 1 m) and back on shows it again (US-14) |

### 5.8 Full-screen photo viewer (MVP)

| Part | Spec |
|---|---|
| Surface | `--color-viewer-bg`, `--z-viewer`, modal dialog (`role="dialog"`, `aria-modal`, labelled "Photo n of N"), focus moves to Close, focus returns to the canvas on close (the Visitor is exactly where they were, FR-35) |
| Photo | `<img>` at the `full.jpg` URL with `alt` equal to the caption, or "Photo n of N" if there is none (FR-63). `object-fit: contain`, never cropped. Shows the blurred LQIP while loading |
| Caption | Beneath the photo on its own band in `--color-on-night` (not over the photo). Fraunces, `--caption-size`. Scrolls if long |
| Controls | Close (top-right, 44 px). Zoom in, zoom out, Reset zoom (bottom-right cluster, 44 px, for keyboard and switch users) |
| Zoom | Pinch (touch), wheel (mouse, 1.0 to 5.0 times), double-tap or double-click (toggles 1 and 2.5), plus and minus keys. When zoomed: drag to pan, arrow keys pan. Panning is clamped to the image. Reduced motion: no zoom easing |
| States | **Loading:** LQIP blurred plus a chip "Loading full photo...". **Error:** the LQIP dimmed plus "We couldn't load this photo" with **Try again** and **Close**. **Loaded:** crossfade (instant under reduced motion) |
| Scene behind | Rendering pauses and Visitor input is disabled while open. The Guide and presentation state are untouched |
| Closing | Close button, Escape, or a tap on the dark background outside the photo (when not zoomed) |

### 5.9 Joystick (MVP, touch)

| Part | Spec |
|---|---|
| Base | `--joystick-size` circle, `--color-hud` glass, 2 px `--color-on-night` ring at 40%, faint N, E, S, W ticks. 70% opacity idle, 100% while held |
| Knob | `--joystick-knob` circle, `--color-on-night` at 92%, `--shadow-hud` |
| Hit area | `--joystick-hit` square centred on the base, `.ui-gesture` and `touch-action: none`. Pointer capture on `pointerdown`; the pointer id is tracked so a second finger can orbit independently |
| Mapping | Knob offset limited to `--joystick-travel`. Inside `--joystick-dead-zone` there is no movement. Beyond it, magnitude maps linearly to 0.35 to 1.0 of walking speed. Direction is camera-relative (forward is away from the camera). Output is a `MoveIntent` written to `inputState` |
| Release | Knob returns to centre in `--duration-fast` (instant under reduced motion). Movement stops at once |
| Left-handed (R2) | A Settings option mirrors the joystick to the bottom-right and the look-around to the left |
| Alternative (R2, recommended for MVP) | A Settings option replaces the joystick with four arrow buttons (44 px, press and hold to move). This satisfies WCAG 2.5.7 for users who cannot drag precisely |
| Accessibility | `role="application"` is not used; the joystick is a pointer-only enhancement and the keyboard and arrow-button paths are the accessible ones. It has `aria-hidden="true"` so screen readers do not read a meaningless control |

### 5.10 Look-around and canvas (MVP)

The canvas wrapper is focusable (`tabindex="0"`, `role="application"`, `aria-roledescription="3D museum"`, label "Museum. Press H for help.", `aria-describedby` pointing to the controls description). Focus ring is the inset ring in `base.css`. Detail in 6.1 to 6.3.

### 5.11 Hint chip, edge arrow and progress pill (R2)

| Component | Spec |
|---|---|
| Where next? button | 44 px pill in the top-left cluster, brass compass icon and the label "Where next?" (label hidden below 400 px wide, icon stays, `aria-label` keeps the text). When every picture has been viewed it reads "To the finale" |
| Edge arrow | A 48 px night glass chip with a brass arrow at the screen edge in the direction of the target picture, and the distance in metres ("about 12 m"). If the target is on screen it is replaced by the in-scene frame glow only. Non-interactive, `aria-hidden`; the announcement carries the information |
| Frame glow | The target frame's emissive brass glow `--scene-hint-glow` pulses 3 times over about 4 s then holds steady until 6 s, then fades. Reduced motion: steady glow for 6 s, no pulse |
| Progress pill | Night glass pill, 32 px tall, "5 of 12" in `--text-sm` with a small ring. `role="status"` is not used (the caption announcement already covers the change). Visible label for assistive tech: `aria-label="5 of 12 pictures viewed"` |

### 5.12 Picture list sheet (R2)

| Part | Spec |
|---|---|
| Container | Phone portrait: bottom sheet up to `--sheet-max-height`, drag handle plus Close, scrim. Landscape and desktop: right drawer 22 rem wide. `role="dialog"`, `aria-modal`, focus trapped, Escape closes, focus returns to the canvas |
| Row | 56 px tall button: thumbnail 48 px (`object-fit: contain` on sunken fill), "Photo 3" plus the first line of the caption (ellipsis), and a "Viewed" text with a check icon when viewed (not colour alone). Final row: "Finale: a note from {Guide}" |
| Action | Pressing a row closes the sheet and walks the Visitor's character to stand in front of that picture. The jump is a cut hidden by a `--duration-fade-through` fade veil at `--z-fade` (instant under reduced motion). The camera snaps behind the Visitor facing the picture, the Guide relocates beside the Visitor, and the presentation starts as usual (US-44) |
| Announcement | "Moved to photo 3 of 12" |

### 5.13 Settings sheet (R2)

| Setting | Control | Default |
|---|---|---|
| Sound (shown only when the museum has audio) | Switch "Sound on or off" | On after Start |
| Graphics | Segmented: Auto, Low | Auto |
| Caption text size | Segmented: Normal, Large, Extra large (sets `data-caption-size`) | Normal |
| Motion | Segmented: Follow my device, Reduce, Full (sets `data-motion`) | Follow my device |
| Controls | Segmented: Joystick, Arrow buttons | Joystick |
| Joystick side | Segmented: Left, Right | Left |
| Help | Button "How to explore" | |

Changes apply immediately and persist in `localStorage` (`settingsStore`). Same sheet container as the picture list.

### 5.14 Dialogs, toasts, alerts

| Component | Spec |
|---|---|
| Dialog | `role="dialog"` (or `alertdialog` for destructive and context-lost), `aria-modal`, labelled and described, focus trapped, Escape closes unless it is blocking, initial focus on the safest control (Cancel for delete), focus returns to the trigger, `--z-modal`, `--color-scrim` |
| Alert (inline) | Icon plus bold lead-in plus message, tinted background (`--color-danger-tint`, `--color-warning-tint`, `--color-success-tint`, `--color-info-tint`), border `--hairline` in the state colour; errors use `role="alert"`, progress and success use `role="status"` |
| Toast | Night glass pill at the bottom-centre above the safe area (`--z-toast`), 4 s, then gone; pauses while hovered or focused; every toast outcome is also reflected in the UI (for example the Copy button reads "Copied") so a missed toast loses nothing |

### 5.15 Link field with Copy and Share (publish screen)

| Part | Spec |
|---|---|
| Field | Read-only text input showing the full link, selects all on focus, labelled "Share link" |
| Copy | Primary 56 px button. On success the label changes to "Copied" with a check for 3 s and a `role="status"` message "Link copied". On failure: "We couldn't copy automatically. The link is selected: press and hold, then choose Copy" |
| Share | Shown only when `navigator.share` exists. Opens the device share sheet. Absent otherwise (US-28) |
| Edit link | Same field, label "Private edit link", a warning alert above it, and an acknowledgement checkbox (5.16) |

### 5.16 Stepper and action bar (builder)

> **v2.0:** the phone stepper, the action bar contents and the Preview and Publish placement are superseded by 12.4. Behaviour not mentioned there (focus to the heading, announcement, document title) is unchanged.

| Part | Spec |
|---|---|
| Stepper (phone) | Text "Step 2 of 4: Words" plus four 44 px-tall segments (the visible bar is 6 px; the tap target is taller). Current: `aria-current="step"`. Completed steps are links back; future steps are not focusable until reachable |
| Stepper (desktop) | Vertical list in the left rail with numbered markers and a check when complete. Not colour-only |
| Action bar | Sticky bottom bar on phones: **Back** (secondary) and **Next** (primary), safe-area padded. Last step: **Publish** replaces Next. On step change focus moves to the new step's heading (`tabindex="-1"`) and a polite status announces "Step 3 of 4: Characters" |
| Document title | Updates per step for WCAG 2.4.2, for example "Characters, step 3 of 4 | Surprise Museum" |

### 5.17 Restored-draft notice: "Photos weren't kept" (builder, MVP, v1.2)

A short, calm inline notice that explains why the photo list is empty after a reload. It is information, not an error: no alert role, no danger or warning colour, nothing blocks the Creator.

```text
PHONE (360)                                   DESKTOP (content column)
| Step 3 of 4: Characters        |            | Step 3 of 4: Characters                     |
| +----------------------------+ |            | +-----------------------------------------+ |
| | (i) Photos aren't kept     | |            | | (i) Photos aren't kept after a reload.   | |
| |  after a reload. Please    |[X]|          | |     Please add them again. Your names,  [X]| |
| |  add them again. Your      | |            | |     words and characters are still here. | |
| |  names, words and          | |            | |     [ Add photos ]  (steps 2 to 4 only)  | |
| |  characters are still here.| |            | +-----------------------------------------+ |
| |  [ Add photos ]            | |            | (the step's own content follows)             |
| +----------------------------+ |
```

**Show when (all three):** the builder restored a draft from `localStorage` on this page load; the restored draft has no photos; and the stored draft holds something worth restoring (a name, any text, any character choice that is not the default, or a saved step later than 1). A stored draft that equals the defaults shows nothing, because nothing was lost. It is decided once, at restore time. It is never shown for a draft that was started in this page load (for example when the Creator removes their own photos).

| Property | Spec |
|---|---|
| Placement | Inside the step content column, directly **below the step heading and above everything else in the step** (above the Add photos area on step 1, above the preview on step 3, above the checklist on step 4). It is shown on whichever step the draft reopens on, and stays visible when the Creator moves between steps until it goes away (below). It scrolls with the content: it is not part of the sticky header or the sticky action bar, so it never covers a control (WCAG 2.4.11). On step 4 it sits above, and does not replace, the "Add at least one photo" issues. When a step's error summary is also showing, the notice comes first, then the summary |
| Surface | `--color-info-tint` fill, `--hairline` solid `--color-border-strong` outline, `--radius-md`, padding `--space-3` by `--space-4`, full width of the content column (max `--content-max-width`). Not paper, not the warning box of the edit-link screen |
| Icon | A 20 px (`--icon-md`) circled "i" in `--color-accent`, `aria-hidden`. Never a triangle, exclamation mark or cross |
| Text | First line `--text-md`, weight 600, `--color-text`: "Photos aren't kept after a reload. Please add them again." Second line `--text-sm`, `--color-text-muted`: "Your names, words and characters are still here." Wraps freely; no fixed height; works at 320 px wide and at 200% text zoom |
| Action | Steps 2, 3 and 4 only: a text button **Add photos** (accent text, 44 px tall). It goes to step 1 and moves focus to the step 1 heading, as any step change does (5.16). Not shown on step 1, where the Add photos area is directly below |
| Dismiss | A 44 px icon button (X) at the top-right with `aria-label="Dismiss notice"`. It removes the notice for this page load only (not saved). After dismissal, focus moves to the step heading (`tabindex="-1"`), because the dismiss button has just left the page. Escape does not dismiss it (it is not a dialog) |
| Contrast (calculated; QA to re-verify) | `--color-text` on `--color-info-tint` 13.4:1; `--color-text-muted` on `--color-info-tint` 5.3:1; `--color-accent` on `--color-info-tint` 6.8:1; `--color-border-strong` outline on `--color-info-tint` 4.3:1 (needs 3:1) |
| Motion | Appears with no animation on load. On removal it fades and collapses in `--duration-fast` (instant under reduced motion). Nothing pulses or moves |
| Semantics | A `div` inside the persistent polite live region `role="status"` of the builder (see Announcement). The text is real text, in reading order straight after the step heading. No heading element inside it, so the step's heading outline is unchanged |

**Announcement (screen readers).**
- The builder keeps one persistent `role="status"` region (`aria-live="polite"`, `aria-atomic="true"`) in the DOM from the first render; the notice is rendered inside it, or its text is written into a visually hidden copy inside it, **after** the region exists (the visible notice may sit outside the region if the developer prefers, as long as the same text is announced once). Content added to a region that was created in the same render is often not announced.
- Announced **once**, about 600 ms after the step announcement ("Step 3 of 4: Characters", 5.16), so it queues behind it rather than replacing it: "Photos aren't kept after a reload. Please add them again. Your names, words and characters are still here."
- It never takes focus on load. The page load puts focus on the step heading as usual, so the notice is the next thing in reading order.
- Removal is silent. Adding a photo is already announced by the photo row ("Uploading", "Ready"); a second "notice removed" message would be noise. Dismissal is silent too.
- It is not re-announced when the Creator moves between steps, or when it scrolls into or out of view.

**When it goes away.** Any one of:
1. The Creator adds a photo. It disappears the moment the first photo row is created (when the file is picked, not when the upload finishes).
2. The Creator dismisses it.
3. The draft is published, discarded or replaced (the builder starts a new draft), or the Creator leaves the builder.

It does not come back if the Creator later removes every photo. It does appear again after the next reload if the draft still holds content and no photos, because it is true again. Dismissal and "added a photo" are held in memory only, never in `localStorage`.

**Interaction with other builder rules.** The "Add at least one photo" messages on steps 3 and 4 and the Preview dialog's missing list are unchanged. The leaving-protection prompt (2.1) is unchanged. In Release 2, when photos are restored from IndexedDB (US-29 AC-1), the notice is never shown for a draft that has photos, so no change to the notice is needed.

---

## 6. 3D interactions

Every interaction is specified as Trigger, Feedback, Camera, Exit, Touch, Keyboard.

### 6.1 Interaction: Move

- **Trigger:** touch joystick; W A S D or arrow keys; (R2) arrow buttons.
- **Feedback:** the Visitor walks (walk cycle only while moving, FR-18) and turns to face the direction of travel; footsteps are silent (no audio in MVP). Maximum speed 1.6 m/s (a leisurely gallery pace; the longest museum, 64 m, takes about 40 s). Keyboard has a 150 ms acceleration ease; the joystick scales speed with deflection (5.9). Walls and frames stop the character, which slides along them (FR-34).
- **Camera:** follows the Visitor's translation. It never rotates on its own (6.3).
- **Exit:** release the stick or keys; the character stops at once and idles.
- **Touch:** joystick bottom-left, hit area 176 px.
- **Keyboard:** focus the canvas (it takes focus after Start). Movement is camera-relative. Tab always leaves the canvas; arrow and letter keys are only captured while it has focus.
- **Coaching:** after Start, one hint at a time, each shown once per session, never modal, auto-hidden on first use or after 8 s:
  1. Touch: "Drag to walk" near the joystick and "Drag here to look around" on the right. Desktop: "W A S D or arrow keys to walk. Drag to look around".
  2. About 3 s later if no presentation has happened: "Walk up to a picture and {Guide} will tell you about it".
  3. After the first presentation: "Tap a picture to look closer" (desktop: "Click a picture to look closer").
  Reduced motion: static chips, no ghost-finger animation.

### 6.2 Interaction: Look around (orbit)

- **Trigger:** drag on the canvas (one finger or the mouse, left or right button) outside controls and outside the joystick hit area; Q and E, or Shift with the arrow keys.
- **Feedback:** the camera orbits the Visitor. Touch: 0.3 degrees per px. Mouse: 0.25 degrees per px. Keyboard: 90 degrees per second yaw, 60 degrees per second pitch.
- **Limits:** pitch (camera elevation above the horizontal) 4 to 55 degrees; no panning; yaw unlimited.
- **Exit:** release. The camera stays where the user left it (no snap-back).
- **Touch:** a drag that starts in the joystick hit area is the joystick; a second finger anywhere else orbits independently.
- **Keyboard:** Q and E, or Shift with the arrow keys, as above. R resets (see 6.4).
- **Tap, not drag:** movement under 8 px and 350 ms is a tap, which may select a picture (6.6).
- **Cursor (desktop):** `grab` over the canvas, `grabbing` while dragging, `pointer` over pictures.

### 6.3 Interaction: Camera follow

- **Style:** third-person follow (A-4). Composition targets are in 3.4. Distance (boom) is adjustable only on desktop (wheel, plus and minus keys): 2.5 to 6.0 m, 0.4 m per wheel notch.
- **Follow:** the camera's position follows the Visitor's translation with 120 ms critical damping. Yaw and pitch change only from user input. Movement is camera-relative, so there is no need to swing the camera behind the character as it turns, which avoids unexpected rotation.
- **Occlusion:** when a wall blocks the line to the Visitor the boom shortens, down to 1.2 m, easing over 150 ms.
- **Moves on its own only for a presentation (v1.2).** The camera does not move because of the Guide's walking, a hint, a picture list jump or the finale. The only non-input changes are (a) following the Visitor's own movement, (b) a cut to the default pose after Replay or a jump-to-picture, which the user caused, and (c) the **presentation camera** (6.12), which eases to a framing of the picture when a presentation starts and eases back when it ends or the Visitor moves. (c) is the single exception, it is always interruptible by any input, and it is a cut under reduced motion.
- **Reduced motion:** the same, with no damping (the camera is rigidly attached), no eased boom change, no eased Reset, and no fade-through (hard cuts). The presentation camera becomes a hard cut in and out (6.12.6).
- **Ceiling and a high camera (v2.0, FR-95, user feedback 02/11/2026).** At a high pitch with a long boom (desktop: up to 55 degrees and 6 m, so the camera can sit above the ceiling) the ceiling hides the rooms. Decision: **fade the ceiling out; do not clamp the pitch** (the 4 to 55 degree range in 6.2 stays, because looking down at the whole museum is a nice thing to do). A ceiling only blocks the view when the camera is at or above its plane (the camera is never below the floor and looks down), so the rule is about camera height, not about the line of sight. Owned by the scene-developer; applies in the visit, the preview and the builder's museum preview:
  - The ceiling opacity is a continuous function of the camera's height: `opacity = 1 - smoothstep(ceilingHeight - 0.6, ceilingHeight - 0.1, cameraY)`. Fully opaque with the camera 0.6 m or more under the ceiling, fully clear within 0.1 m of it and above. No timer, so it follows the user's own input and cannot flicker; the ceiling is not drawn at all at an opacity under 0.02 (and goes back to the opaque, non-transparent material at 1, so there is no sorting cost in the default view).
  - **Default view unchanged:** the default follow camera must sit at least 0.6 m under the ceiling so the ceiling is exactly as opaque as today. The scene-developer checks this with the real wall height (`layout.wallHeight`); if the default camera is closer than 0.6 m, start the range at `defaultCameraY + 0.1` instead.
  - Everything fixed to the ceiling fades with it: the rose, the recessed strips, the oculus ring. The finale light cone and floor pool stay.
  - Walls keep their full height so the rooms read as a cutaway. Each wall gets a flat 0.06 m cap in `--look-dado-rail` so the cut edge looks finished (technical-artist, 12.8.3). The camera still never passes through a wall (ADR 0014 occlusion is unchanged).
  - **Reduced motion (FR-95: any fade is instant):** a hard step with hysteresis: the ceiling switches off when `cameraY` rises above `ceilingHeight - 0.35` and back on when it falls below `ceilingHeight - 0.55`, so it never flickers at the threshold. Either way the change only happens because the Visitor moved the camera.
  - The presentation camera (6.12) keeps its 8 to 20 degree pitch, so it never triggers the fade. Low graphics quality: the same rule; it is one opacity value.
  - QA: at pitch 55 degrees and boom 6 m on desktop (and with the keyboard camera controls) the Visitor, the route and at least the next room are visible; at the default pose the ceiling is opaque and the picture matches today's; hovering the camera at the threshold causes no flicker; reduced motion switches in one frame.
  - **As built (v2.0.1, scene-developer, accepted).** (1) **Height cap:** the follow camera is never higher than **2 m above the ceiling, 5.2 m** (`ceilingHeight + 2.0`, H = 3.2). When pitch and boom would put it higher, the boom is shortened for the height only; the pitch and the Visitor's zoom setting are untouched, so lowering the pitch gives the zoom back. With the 0.9 m pivot at 55 degrees the longest boom is therefore about 5.25 m, not 6 m, and the QA line above reads "the longest boom the cap allows" (the 6 m limit in 6.2 still holds below that pitch). The cap is a design decision, not a side effect: it keeps the whole museum in view from above without the camera drifting off to the roof. (2) **Reduced-motion hysteresis:** off when `cameraY` is above 2.85 m (H - 0.35), on again when it is below 2.65 m (H - 0.55), and between the two it keeps its last state; there is no animation and the change lands in one frame. (3) **One down-facing quad per room**, single-sided, so seen from above it is culled and can never hide the view even before the fade starts; it is transparent only while partly faded, so the default view stays opaque and cheap. The roses, oculus ring and strips fade with it (12.8.3).
- **Not used:** camera shake, head bob, FOV changes, motion blur, auto-orbit, intro fly-through (there is no intro; the welcome screen is the intro).

### 6.4 Interaction: Reset view

- **Trigger:** the Reset view HUD button (appears once the camera is more than 20 degrees from the default yaw or pitch, or the boom is changed); R on the keyboard.
- **Feedback:** the camera returns to behind the Visitor at default pitch and boom over `--duration-camera` (instant under reduced motion). The button then hides.
- **Exit:** automatic.

### 6.5 Interaction: Hover a picture (desktop)

- **Trigger:** pointer over a photo mesh. Characters are not pickable (their raycast is disabled so clicks pass through to the picture behind them).
- **Feedback:** cursor `pointer`; frame emissive brass tint 0 to 25% over `--duration-fast` (instant under reduced motion). Highlight within 100 ms.
- **Exit:** pointer leaves.
- **Touch:** no hover state; the standing-spot pool and the onboarding hint carry the affordance.
- **Keyboard:** not applicable; see the Pictures list (R2) and the controls in 6.7.

### 6.6 Interaction: Open a picture full-screen

- **Trigger:** click (desktop) or tap (touch, under 8 px and 350 ms) on a picture from anywhere it is visible; Enter on a focused picture in the Pictures list (R2).
- **Feedback:** frame highlight within 100 ms, then the viewer (5.8) opens within 200 ms. The picture counts as viewed (A-17).
- **Camera:** does not move. Rendering pauses behind the viewer.
- **Exit:** Close, Escape, or the background. The Visitor is exactly where they were.
- **Touch:** same as click; no hover.
- **Keyboard:** pictures live in the 3D world, not the DOM, so they have no tab stops. Every picture that is being presented has a keyboard path through a **Look closer** button (44 px): it is in the caption card header (5.6), and for a picture with no caption, where no card appears (FR-71), it appears as a small night-glass chip, "Look closer at photo 3", at the bottom-centre above the joystick zone while that presentation is active. This gives FR-61 a complete path in the MVP without the Pictures list. In R2 the Pictures list adds a path to any picture, not only the one being presented.
- **Failed photo:** tapping a failed frame retries it (6.10).

### 6.7 Interaction: Presentation (Guide walks over and presents)

- **Trigger:** the Visitor stays within 3 m of a picture's presentation zone for 1 s (FR-26). Values are tunable (A-16); the design does not depend on the numbers.
- **Feedback sequence:**
  1. Approaching: the standing-spot pool brightens with proximity (continuous cue).
  2. Dwell complete: the Guide stops following, turns, and walks to a spot beside the Visitor facing the picture. It never stands between the Visitor and the picture and never hides the Visitor from the camera (FR-30).
  3. Arrival, or 1.5 s at most: the Guide's presenting gesture plays once (R2), a soft brass ring (0.55 m radius, 200 ms fade) appears under the Guide's feet, and the caption card appears (5.6). A polite announcement is made (8.3).
  4. Leaving: past 4.5 m or Close, the ring and card fade out in `--duration-fast` and the Guide resumes following (FR-27).
- **Camera (v1.2):** eases to the presentation framing (a three-quarter side view of the picture, the Visitor and the Guide) at dwell completion, and eases back at step 4 or on any movement input. Full rules in 6.12.
- **Reduced motion:** the Guide fades in beside the Visitor over 250 ms instead of walking across the room (FR-62), there is no presenting gesture (a still pose), the camera cuts to the framing as the Guide appears (6.12.6), and the card appears instantly.
- **Interrupt rules:** pass-through in under 1 s starts nothing; a second zone replaces the first after its own dwell; nothing queues (FR-28). The card must not flicker at the boundary, because the exit distance (4.5 m) exceeds the entry distance (3 m).
- **No caption:** the Guide walks over and faces the picture, no card, the picture still counts as viewed (FR-71).
- **Touch and keyboard:** nothing to press. Dismiss with Close, Escape, Enter or Space on the canvas, or by walking away.

### 6.8 Interaction: Guide presence cues

| Cue | When | Spec |
|---|---|---|
| Name label | Always on screen | 5.5 |
| Follow behaviour | Roaming | Guide stays 2 to 5 m away and idles when the Visitor stops. It never stands in the camera-to-Visitor corridor (yield: sidestep, or fade to 35% opacity, FR-30) |
| Floor ring | During a presentation | Brass ring under the Guide's feet |
| Card header | During a presentation | Guide badge and name |
| Relocate | More than 8 m away or stuck for 3 s | 250 ms fade out, reappear beside the Visitor, 250 ms fade in. Reduced motion: opacity changes instantly, no fade |
| Off-screen pointer (Should) | The Guide has been off-screen for more than 1.5 s while not presenting | A small edge chip with the Guide's name and an arrow, `aria-hidden`, non-interactive, fades after the Guide returns. Never shown during a presentation |
| Badge | Always | Brass badge on the Guide's chest (1.6) |

### 6.9 Interaction: Finale

- **Trigger:** the Visitor steps into the podium zone (radius 1.8 m, FR-29). Per the assumed default (Q-21), this triggers the closing message whatever has been viewed. In R2 (FR-70), if pictures are unviewed, the Guide first asks "You haven't seen everything yet. Show the note now?" with **Show the note** and **Keep exploring**.
- **Feedback:** the podium ring brightens (300 ms). The Guide walks (or fades in) beside the Visitor on the podium. The finale card appears within 1.5 s.
- **Camera:** does not move.
- **Exit:** **Keep exploring** closes the card and suppresses it until the Visitor leaves the zone plus 1 m. **Replay from the start** returns the Visitor and Guide to the entrance (a `--duration-fade-through` veil with a hard cut under reduced motion), clears the viewed count, resets the camera behind the Visitor, and announces "Back at the entrance. Viewed pictures have been cleared."
- **Touch and keyboard:** the two footer buttons; Escape equals Keep exploring.
- **Reduced motion:** no dust motes, no pulse, no confetti.

### 6.10 Interaction: Retry a failed photo

- **Trigger:** the frame shows the failed placeholder (a dark warm panel with a circular-arrow glyph over the blurred LQIP). Tap the frame, or use the DOM **Retry** chip, which appears at the bottom-centre above the joystick when the Visitor is within 6 m of a failed picture ("Photo 3 did not load. Retry").
- **Feedback:** the glyph spins while retrying (a static ellipsis under reduced motion); on success the photo crossfades in over `--duration-normal` (instant under reduced motion).
- **Keyboard:** the DOM chip is a normal button, reachable by Tab; in R2 also from the Pictures list.

### 6.11 Interaction: Customiser preview (builder)

- **Trigger:** change any option; drag the preview to turn the characters (yaw only, 0.4 degrees per px); **Turn left**, **Turn right** and **Back view** buttons (44 px) for keyboard and switch users; click a character to switch the active tab.
- **Feedback:** the changed part updates within 1 s (FR-15), with no flicker. A gender change morphs the shape over 250 ms (instant under reduced motion), section 9.5.
- **Camera:** fixed framing; only the characters turn. Default angle is a three-quarter front view. There is no auto-spin (an optional slow idle turn is allowed only with full motion).
- **Exit:** not applicable.

### 6.12 Interaction: Presentation camera (v1.2, resolves QA N-2)

During a presentation the camera leaves the follow position behind the Visitor and eases to a **three-quarter side view** in which the whole picture is visible and clear, with the Visitor and the Guide standing beside it. It eases back when the presentation ends or the Visitor moves. The aim is calm: one slow move in, one quicker move out, never any roll or zoom, and any input from the Visitor wins.

Terms: **picture** is the active frame including its mat (a rectangle on the wall), **n** is the wall's normal pointing into the room, **V** and **G** are the Visitor and the Guide, **saved pose** is the user's yaw, pitch and boom just before the move.

- **Trigger:** the Guide has been told to present (dwell of 1 s inside 3 m, 6.7). The framing is solved using the Visitor's position and the Guide's destination spot, so it does not wait for the Guide to arrive. **It does wait for the Visitor to be still (v1.3):** the move starts at the later of 150 ms after dwell completion and 0.25 s of stillness (no movement intent past the dead zone and the Visitor's speed at zero), and the solve uses the position at that moment. Movement before the move has started only delays it; it does not cancel it. If the Visitor never stops, there is no framing for this presentation (the follow camera stays, as in the fallback in 6.12.4). Pictures with no caption are framed too (the Guide still presents, FR-71).
- **Feedback:** the camera eases to the framing pose (6.12.3). The caption card appears only once the camera has settled and the Guide has arrived, whichever is later, and never later than 1.5 s after dwell completion (architecture 6.4); if framing is still easing at 1.5 s, the card appears anyway and the dock function re-measures when the camera settles.
- **Camera:** 6.12.2 to 6.12.7.
- **Exit:** see 6.12.7. In short: the card's Close, Escape, Enter or Space on the canvas, any movement input, any look-around or zoom input, Reset view, a new presentation (re-frames directly), Replay or a jump.
- **Touch and keyboard:** nothing extra to press. All the exits above already exist.

#### 6.12.1 What stays the same

Vertical FOV (60 degrees portrait, 52 otherwise) and `camera.setViewOffset` are **not changed** (3.4, ADR 0014): the framing is made by where the camera stands and aims, so a viewport rotation or resize never makes it jump. The camera never rolls. The follow camera's rules (120 ms damping, boom 2.5 to 6.0 m, pitch 4 to 55 degrees) apply again the moment the presentation camera releases.

#### 6.12.2 Framing pose and targets

**Pose.** The aim point is the centre of the world-space box that contains: the four picture corners, and for each of V and G the feet and the top of the head. **Azimuth** (compass direction of the camera from the aim point) is n rotated by a **yaw offset** to one side. **Pitch** is the saved pitch limited to 8 to 20 degrees (if the saved pitch is outside that range, it eases to the nearest limit; default 12 degrees when the saved pitch is the default 14). **Boom** is the shortest distance, from 2.5 up to 6.5 m, at which the fit set below lies inside the safe rectangle when projected through the real camera including the constant view offset. The vertical position of the group on screen therefore comes from the same view offset as the follow camera, and the safe rectangle's bottom edge keeps the joystick zone clear.

**Fit set, in priority order.** (1) The whole picture, always. (2) The Visitor, from feet to head top, with the name label. (3) The Guide, with the name label. If the safe rectangle cannot hold all three at the minimums below, drop the Guide from the fit set first (the Guide may then sit partly off-screen; the label hides as in 5.5). The picture is never cropped, and never shrinks below its minimum width.

**Targets, as fractions of the viewport after safe-area insets.** The dock columns follow 3.5, so the caption card's default dock is left clear.

| Viewport (class as ADR 0014) | Safe rectangle for the fit set (x from left, y from top) | Picture on screen | Visitor height on screen | Why |
|---|---|---|---|---|
| Phone portrait (narrower than 640 px) | x 5 to 95%, y 30 to 74% | Width at least 45% of the viewport width, at most 90%; height at most 85% of the safe height | 18 to 34% of viewport height | Top 30% is the caption dock and top bar, bottom 26% is the joystick zone (3.4). The group has about 44% of the height. The upper bound is 34% (was 28%) because 45% of a 360 px screen already makes a 1.7 m Visitor about 33% of 640 px |
| Phone landscape (landscape, 500 px tall or less) | x 5 to **R**, y 16 to 82% (R in the note below) | Width at least **17%** of the viewport width (was 22%), at most 60% of the safe width | 26 to **50%** | The right 30% column holds the caption card; top 16% holds the HUD; the joystick sits bottom-left over the scene. The screen is only 390 px tall, so a readable picture means large characters. 17% is about 143 px wide at 844 px; the Visitor can open the picture full screen (5.8) |
| Wide (tablet, desktop) | x 4 to **R**, y 10 to 84% (R in the note below) | Width at least 20% of the viewport width, at most 60% of the safe width | 24 to **48%** | Right 30% column holds the card; the HUD top bar is 10% |

**Right bound R (v1.4).** On phone landscape and wide, **R = the smaller of 68% and the card's left edge minus 8 px, as a fraction of the viewport width**, where the card's left edge is `W - edge margin - card width` (edge margin is `--hud-margin` plus the safe inset on phone landscape and 24 px on wide; card width is `--card-width-landscape` or `--card-width-wide` in 3.5, never under `--card-min-width`). Examples: 844 px landscape gives (844 - 12 - 256 - 8) / 844 = 67.3%; 667 px landscape gives 58.6%; 1280 px wide gives 68% (card 358 px, edge 24, so 69.5% is capped); 1024 px wide gives (1024 - 24 - 288 - 8) / 1024 = 68.8%, capped to 68%; 768 px wide gives 58.3%. If R falls below 55%, drop the Guide from the fit set before narrowing further. This keeps the framing and the caption column in agreement, so the Guide's rectangle does not push a full card out of its dock.

**Scaling of the picture minimum (v1.3, as built).** The minimum width in the table is for a 1.6 m wide picture seen at the 35 degree yaw. For any picture it is multiplied by (the picture's own width in metres divided by 1.6) and by 0.82 (the foreshortening at 35 degrees). This keeps the on-screen scale in pixels per metre the same for every picture, so a narrow or tall picture does not force the characters to be huge. The 0.82 factor is applied at every yaw (it is not re-derived at 45 or 52 degrees, which can only make the picture larger than needed).

**Priority (v1.3).** The picture's minimum width **wins** over the Visitor maximum: the boom stops growing once the picture reaches its minimum, even if the Visitor then exceeds the table maximum. With the revised maxima this should not happen for a Visitor of the reference height of 1.7 m (the check normalises other heights: on-screen height multiplied by 1.7 and divided by the Visitor's real height in metres). If the Visitor would come out below the lower bound, drop the Guide from the fit set (above) before accepting a smaller Visitor.

These are acceptance ranges, not exact values: the solver picks the shortest boom that fits.

**Guide corridor (v1.3).** At the framed pose the Guide's spot must not be inside the camera-to-Visitor corridor (the strip between the camera and the Visitor, about 0.6 m wide), or the Guide's yield rule (FR-30) would make the Guide sidestep out of the framing. A candidate that puts her there fails; the next one is tried.

**Yaw offset candidates, tried in this order** (6.12.4): 35, 45 and then 52 degrees. 35 degrees is the intended three-quarter view (the picture is foreshortened to about 82% of its full width). The limit is 52 degrees, where the picture is still about 62% of its full width. Never more.

#### 6.12.3 Timing and easing

| Move | Delay | Duration | Easing | Notes |
|---|---|---|---|---|
| In (follow to framing) | 150 ms after dwell completion, or 0.25 s of Visitor stillness if that is later (6.12 Trigger), so the Guide's turn reads first | `--duration-presentation-camera-in` (800 ms) for a swing of up to 35 degrees; longer swings take the swing in degrees divided by 45 degrees per second, up to a cap of 1,300 ms | `--ease-camera` (`cubic-bezier(0.37, 0, 0.63, 1)` from v1.3, ease-in-out sine: slow start and slow stop; no overshoot) | Position, aim, yaw, pitch and boom all use the same progress value, so the move is one smooth arc. Peak speed is about 1.6 times the average, so the peak turning speed is about 70 degrees per second at 35 degrees in 800 ms, and about 72 at the longest swing the eased move allows (60 degrees in 1,300 ms). Limit: 80 |
| Out (framing to follow) | None: it starts on the input that caused it | `--duration-presentation-camera-out` (600 ms) for a swing of up to 38 degrees, shorter because the Visitor is now walking and should not wait. Larger swings (up to 60) take the swing in degrees divided by 60 degrees per second, up to 1,000 ms (v1.3). Peak turning speed limit for the move out: 100 degrees per second (about 92 for 35 degrees in 600 ms) | `--ease-camera` | Target is the saved pose at the Visitor's current position (a moving target, so the follow damping takes over from the first frame) |
| Re-frame (second presentation replaces the first) | 150 ms | As In, measured from the current pose | `--ease-camera` | Goes straight from one framing to the next. It does not return to the follow pose in between |
| Interrupted mid-move | None | Retargets from the current pose, never jumping: time = the larger of 300 ms and the full duration multiplied by the fraction of the move still to go | `--ease-camera` | A move in that is interrupted by movement turns round at once and returns |
| Swing over 60 degrees (the Visitor had turned the view far from the picture) | None | A fade-through veil instead of an eased swing, to avoid a fast whirl: **200 ms fade in, the cut, 200 ms fade out, 400 ms in total** (that is `--duration-fade-through` in total, half each way; the Replay veil in 6.9 uses the full token each way and is unchanged). The scene draws this veil itself (a fixed full-screen layer in `--color-night` at `--z-fade`, no pointer events, hidden from assistive technology) because the UI veil has no scene trigger. Fades use a linear opacity ramp | n/a | Under reduced motion, a hard cut with no veil, as everything else |
| Return when the swing is over 60 degrees | None | Do not swing back. Keep the framing's yaw and pitch as the new user pose and ease only the boom and the pivot to follow in 600 ms. The Reset view button appears (6.4) so the Visitor can go back to default | `--ease-camera` | Stops a fast turn in the middle of walking |

Mirror the durations and the easing in the scene constants with a comment that points to this section.

#### 6.12.4 How the solver chooses a pose

A pure function in the camera domain (`src/domain/camera/`, scene-developer, unit-tested like `composition.ts`). Inputs: the viewport class and size, the picture's corners and wall normal, V and G positions and heights, label rectangles in screen pixels, the saved pose, the wall list (outer and partition, with openings) and the ceiling height. Output: a pose, or none.

Candidates are tried in this order; the first that passes all tests wins:

1. Side order: the **side nearest to the camera's current azimuth** first (the shortest swing), then the other side. For each side, the yaw offsets 35, 45 and 52 degrees at the pitch from 6.12.2.
2. If none pass, repeat the whole list with the pitch raised to 20 degrees (looking slightly more down so the characters fall below the picture's lower edge). **Phone landscape only (v1.3):** if none pass, repeat once more at 26 degrees. This is the single exception to the 8 to 20 degree pitch range, and it applies only on phone landscape, where the screen is too short for the characters to clear the picture otherwise.
3. If none pass, pick the candidate with the **least overlap of the picture by a character or label**, as long as the picture is fully inside the safe rectangle and no wall rule (6.12.5) is broken. A label that still overlaps is moved sideways (5.5).
4. If every candidate breaks a wall rule, return **none**: the camera stays on the follow camera and the presentation goes ahead as in v1.1 (this is the N-2 behaviour, accepted for this rare case).

**Tests each candidate must pass:**
- The picture's four corners lie inside the safe rectangle, and the picture meets its minimum width in the table.
- The Guide is not in the camera-to-Visitor corridor (6.12.2, v1.3).
- The picture is unobstructed: the rectangles of V's and G's bodies and their labels, grown by 8 px, do not intersect the picture's rectangle. (The body rectangle is a conservative bound: a body radius of 0.3 m either side of the feet and head along the camera's right, so real coverage is lower.) The Visitor's body and label are checked first; the Guide's second (the Guide may be in front of the picture's side edge only if no other candidate clears).
- The caption card's default dock rectangle, grown by 8 px, does not intersect the picture or either character (3.5).
- 6.12.5 passes.

The result is stable: it is computed once per presentation (and again only for a new presentation or a viewport change), not every frame, so the camera cannot hunt between two poses.

#### 6.12.5 Walls and the room

| Wall type | Rule |
|---|---|
| Outer walls (hard, ADR 0014) | The segment from the aim point to the camera must not cross an outer wall. Allowed boom is the distance to the wall minus 0.3 m. The framing never shortens the boom to squeeze in (that would crop the picture); a candidate that needs a longer boom than the wall allows fails and the next candidate is tried. Keep the camera at least 0.3 m below the ceiling |
| Partition walls between the camera and the picture (or the picture's wall face) | The candidate **fails**. The picture must be seen at full opacity, never through a faded wall |
| Partition walls between the camera and V or G only | Allowed. They fade to 0.25 opacity as in ADR 0014 (eased; instant under reduced motion). Collision, navigation and line of sight for presentations are unchanged. Name labels show through a faded wall |
| Doorways | A candidate seen through a doorway opening counts as clear. Check the picture's four corners against the wall list, not just its centre |
| The picture's own wall | The camera is always on the room side of n. A candidate whose camera position is behind the picture's wall fails |

On release (6.12.7) the follow camera's normal occlusion rules apply again (outer walls shorten the boom to 1.2 m, partitions fade).

#### 6.12.6 Reduced motion

When the effective reduced-motion setting is on (8.4), the presentation camera is a **hard cut**: the camera jumps to the framing pose in a single frame at the moment the Guide's 250 ms fade-in begins (so the change is read together with the Guide appearing), and jumps back at the moment of release. There is no eased move, no veil and no fade (the veil would flash; a cut does not), and `--duration-presentation-camera-in` and `-out` are 0 ms. A viewport change re-solves the pose with a cut. The framing, wall rules and input rules are otherwise identical.

#### 6.12.7 Input and interruptions

| Input during a presentation | What the camera does | What the presentation does |
|---|---|---|
| Movement: joystick past its dead zone (15% deflection), W A S D or arrows, arrow buttons (R2) | Releases at once and eases back to the saved pose in 600 ms (reverses a move still in progress) | Continues: the card and the Guide stay until Close or the Visitor passes 4.5 m (6.7). The camera does **not** frame this presentation again, so there is no tug of war if the Visitor steps back and forth. A new presentation (a new dwell) frames again |
| Look-around: drag on the canvas, Q and E, Shift with arrows | **Takes over instantly, with no ease.** The user's pose becomes whatever the camera shows at that frame; the follow camera resumes from it. It does not return to the saved pose | Continues; no further framing for this presentation |
| Zoom: wheel, plus and minus (desktop) | Same as look-around: takes over from the current pose | Continues |
| Reset view (button or R) | Eases to default behind the Visitor in `--duration-camera` (instant under reduced motion) | Continues |
| Close, Escape, or Enter or Space on the canvas (card dismissal, 5.6) | Eases back in 600 ms, while the card fades out in `--duration-fast` | Ends and suppresses that picture until the Visitor is past 4.5 m (FR-27, A-19) |
| Tap or click the picture, or Look closer | Stays where it is. Rendering pauses behind the viewer (5.8). On close the camera is exactly as it was and the presentation is unchanged | Continues |
| A second presentation starts | Re-frames directly from the current pose (6.12.3) | The first is replaced after its own dwell (FR-28) |
| Replay from the finale, a jump (R2) | Cut to the default pose, as 6.9 (a presentation does not survive these) | Ends |
| Rotation or window resize (US-33) | Re-solves the pose for the new viewport class and eases to it in `--duration-camera` (cut under reduced motion) | Continues, nothing restarts |
| Hint chips, the Help sheet, the settings sheet, Tab, a failed photo retry | No effect | No effect |

The camera is never driven by anything except those rows and the Guide's presentation starting. Walking past 4.5 m needs movement, so the camera has already released by then.

After release, the Visitor may be standing between the camera and the picture again (the v1.1 view). That is accepted: the Visitor chose to walk or to take the camera.

#### 6.12.8 Name labels while framed

See 5.5, "Framed view" and "Framed view, portrait: below the caption strip". In short: labels stay on, stay the same size, count as part of their character in the solver, and slide sideways, never up over the picture, if a label would still touch the picture. On portrait a label also never sits above the caption strip's bottom edge (68 px plus 104, 112 or 124 px); it slides down to it. Labels hidden by the wall line-of-sight test stay hidden. The Visitor's and the Guide's labels never swap sides.

#### 6.12.9 Calm rules, setting and accessibility

- **Calm rules.** One slow move in and one quicker move out per presentation; no roll; no FOV change and no dolly zoom; eased start and stop; no overshoot; peak turning speed at most 80 degrees per second on the move in and 100 on the move out (6.12.3); pitch stays between 8 and 20 degrees while framed (26 on phone landscape in the rare crowded case, 6.12.4); the camera cannot hunt (one solve per presentation); no screen shake; the card, Guide and ring appear as in 6.7, not timed to the camera's motion.
- **Setting (Should, R2; with Settings, 5.13).** A switch "Move the camera to show each picture" (on by default). When off, the camera stays on the follow camera during presentations (the v1.1 behaviour), and the caption card still avoids the picture (3.5). Helper text: "When this is off, the view stays behind your character." The switch is separate from "Reduce motion", which turns the move into a cut but does not turn it off.
- **Screen readers.** The camera move is not announced: the presentation announcement is unchanged (8.3), and no focus moves. Nothing in this section changes what is read.
- **Keyboard.** The existing exits are the keyboard paths (movement keys, Q and E, R, Escape). No new key.
- **WCAG.** 2.3.3 (animation from interactions): the move is the only non-essential motion, is a cut under reduced motion, and the Visitor can stop it by any input and (R2) switch it off. 2.2.2 (pause, stop, hide): the move lasts under 1.3 s and ends by itself. No flashing.
- **QA hook.** `snapshot().presentationCamera = { mode: 'follow' | 'entering' | 'framed' | 'returning' | 'cut', yawOffsetDeg, pictureVisibleFraction, fallback, guideDropped, settled, cutSeq, settledSeq, lastMoveInMs, lastMoveOutMs, photoId, veil }` (as built), where `pictureVisibleFraction` is the share of the picture rectangle that is inside the viewport and not covered by a character or label rectangle. The hook uses no pixels. After a hard cut `mode` is `cut` for 300 ms, then `framed`. The same state is published as the `surprise-museum:presentation-camera` window event and `data-presentation-camera` on the canvas, which the caption card uses to wait for `settled`. When no framing happens (fallback, finale, walking), `mode` stays `follow` and `settled` is true.
- **Acceptance checks.** At 360 by 640, 390 by 844, 844 by 390 and 1280 by 720: (a) when `mode` is `framed` (and `fallback` is false), `pictureVisibleFraction` is at least **0.99 on phone portrait (360 by 640, 390 by 844) and wide (1280 by 720), and at least 0.90 on phone landscape (844 by 390)**, and the picture rectangle is always fully inside the viewport (never cropped), for pictures on both side walls, in portrait, landscape and square, in a doorway-adjacent room and in the last room. Reason for the lower landscape bar: the screen is 390 px tall and the picture needs at least 17% of the width, so the characters cannot always clear it; the covering rectangles are conservative, so 0.90 on paper is a small real overlap, and no framed view is accepted below 0.90; (b) the Visitor's height, normalised to the 1.7 m reference (6.12.2), is inside the table range (18 to 34%, 26 to 50%, 24 to 48%), or the Guide was dropped from the fit set, or the picture is at its minimum width (the picture wins); the picture is never below its scaled minimum (6.12.2) in any case; (c) the caption card does not intersect the picture or either character (3.5); (d) the move in lasts 800 to 1,300 ms and the move out 600 to 1,000 ms (`lastMoveInMs`, `lastMoveOutMs`), the peak turning speed measured from sampled yaw is at most 80 degrees per second in and 100 out, a swing over 60 degrees shows the veil for 400 ms in total (200 in, cut, 200 out), the move is a single frame under reduced motion with no veil, and the move starts no earlier than 0.25 s after the Visitor stops; (e) each row of 6.12.7 behaves as written, including no re-frame after a movement release; (f) `partitionOpacity` is 1 for any partition between the camera and the picture; (g) the Visitor's name label is never hidden while framed unless a wall hides it; (h) the existing 3.4 composition numbers are unchanged for the follow camera before and after a presentation.

---

## 7. Loading and error states

### 7.1 Loading: opening the link (MVP)

Full-screen paper (`--z-screen`). Centre: a 120 px brass picture-frame mark; below it "Opening your surprise" in the display font; below that a progress line. Phase 1 (fetching the museum) is indeterminate (a slow brass sweep along the frame; static under reduced motion). Phase 2 (after Start, assets) is determinate with real progress.

- Progress element: `role="progressbar"` with `aria-valuenow`. Track `--color-surface-sunken` with a `--color-border-strong` outline; fill `--color-accent`. Text percentage beneath ("Hanging the pictures... 62%").
- Messages: "Opening your surprise" (data), "Hanging the pictures" (assets), "Almost there" (after 6 s). The `role="status"` region updates at most every 5 s or at 25% steps, so screen readers are not flooded.
- Never blank: this screen is the first paint of the route.

### 7.2 Welcome (MVP)

```text
+---------------------------------------+
|  +-------------------------------+    |   brass hairline double frame, inset 16 px
|  |        A PRIVATE VIEW         |    |   eyebrow
|  |                               |    |
|  |   A museum for Sophie         |    |   --text-display, display font, balanced
|  |                               |    |
|  |   For Sophie                  |    |   --text-2xl, claret
|  |   Your guide today: Tom       |    |   --text-md, muted
|  |                               |    |
|  |      [   Start   ]            |    |   56 px, min width 12 rem, focused
|  |                               |    |
|  |         Privacy               |    |   small link
|  +-------------------------------+    |
+---------------------------------------+
```

- States: **ready**, **Start pressed but scene not ready** (button label "Getting the gallery ready", progress line, `aria-busy`, further presses ignored), **in-app browser notice** (dismissible info alert above the card), **WebGL unavailable** (replaced by 7.7).
- The title may be up to 60 characters and wraps. "For {Visitor}" uses `.user-text`.
- Start has initial focus (US-11). Enter and Space activate.
- Document title: the museum title.

### 7.3 Loading: scene after Start (MVP)

Covered by 7.1 phase 2 and the Start button's state. Photos that are not yet loaded show their blurred LQIP in the frame, never blank (NFR-3). Frames load nearest-first, so close pictures sharpen first. A frame never pops: the sharp texture cross-fades over `--duration-normal` (instant under reduced motion).

### 7.4 Frame placeholders in the scene (MVP)

| State | Look |
|---|---|
| Placeholder | The 24 px LQIP, smoothly upscaled, with a slow diagonal sheen (static under reduced motion) |
| Loading | As placeholder plus a tiny three-dot glyph in the frame centre |
| Loaded | The photo, crossfaded |
| Failed | The LQIP desaturated and dimmed to 40%, a circular-arrow glyph (brass on night) in the centre |

### 7.5 Not found (MVP)

Paper screen, centred, no navigation to other museums.

- Illustration: an empty walnut frame hanging slightly crooked under a brass picture light (static SVG, 20 kB or less, `aria-hidden`).
- Heading (h1): "We can't find that museum".
- Body: "The link might have a typo, or the museum may have been taken down. Check the link, or ask the person who sent it to send it again."
- Action: **Go to the home page** (secondary). No other content, no hints about what existed.
- Used for unknown, deleted and expired links and unknown routes (FR-55). R2 adds "expired" and "not yet" variants with the same layout.

### 7.6 Couldn't open it (MVP)

Heading "We couldn't open your surprise". Body: "It looks like the connection dropped. Check you're online and try again." Action: **Try again** (primary; re-fetches without reloading the page). `role="alert"` on the heading region.

### 7.7 WebGL unavailable (MVP message, R2 slideshow)

- Heading "This device can't show the 3D museum".
- Body: "Your browser couldn't start the 3D view. Try the latest Chrome, Safari, Edge or Firefox, and check that hardware acceleration is turned on in its settings."
- R2 action: **See the photos as a slideshow** (primary). Slideshow: full-screen night background, the photo `contain` in the upper area, caption in a band beneath it (never over the photo), "Photo 3 of 12", **Previous** and **Next** (56 px), arrow keys, and a final slide with the closing note. A "Back" link returns to this message.
- Also shown inside the builder's Characters step as "3D preview isn't available on this device. Your choices are still saved." (options remain usable).

### 7.8 Graphics context lost (MVP)

`alertdialog` over the dimmed scene: "The 3D view stopped. This can happen when a phone is low on memory." Actions: **Reload** (primary), and the message "Your place in the museum won't be kept." (NFR-11).

### 7.9 Failed photo (MVP)

Three places, as 6.10: the in-scene glyph, the DOM Retry chip, and the viewer's error state. The Guide still presents the caption and the Visitor keeps roaming (FR-58).

### 7.10 Builder errors (MVP)

| Situation | Presentation |
|---|---|
| Rejected files | A `role="alert"` box above the photo list: "3 files weren't added", then a list of "{file name}: {reason}". Persistent until dismissed. Valid files carry on |
| Failed upload | The row shows an alert icon, "Upload failed: check your connection", and **Retry** (only this photo) |
| HEIC cannot be read | Row error: "We couldn't open this HEIC photo. Try exporting it as a JPEG." |
| Over 20 photos | "You can add up to 20 photos. Remove one to add another." |
| Missing required fields | Inline error under the field plus a summary alert at the top of the step with links to each field; focus moves to the summary on a failed Next |
| Publish failure | `role="alert"`: "We couldn't publish your museum. Your photos and words are safe." plus **Try again** |
| Rate limit | "That's a lot of tries in a short time. Please wait a few minutes and try again." |
| Offline | Persistent bar "You're offline. We'll carry on when you're back." Uploads resume |
| Edit link not found or deleted | The not-found screen (7.5) |

### 7.11 Preview mode (MVP)

A 44 px strip at the top (`--z-preview-bar`): a brass "Preview" tag, "This is how {Visitor} will see it", and **Exit preview**. The HUD's top inset grows by `--preview-bar-height`. The welcome screen is included. Exit returns to Review with everything intact (US-8). If the minimum is not met, the preview is replaced by the list of what is missing (2.1).

---

## 8. Accessibility (WCAG 2.2 AA)

### 8.1 Keyboard

Every Visitor action is available by keyboard (FR-61). Canvas shortcuts are active only while the canvas has focus (WCAG 2.1.4). Tab always moves focus out of the canvas; the canvas never traps it.

| Key (canvas focused) | Action |
|---|---|
| W A S D, arrow keys | Walk (camera-relative) |
| Q and E, or Shift with Left and Right | Turn the view |
| Shift with Up and Down | Tilt the view |
| Plus, Minus (desktop) | Camera closer, further |
| R | Reset view |
| Escape | Close the topmost panel, card or viewer |
| Enter or Space | Dismiss the caption card when focus is on the canvas (otherwise normal activation) |
| H | Open Help |
| P | Open Pictures (R2) |
| N | Where next? (R2) |

Tab order on the Visit screen: skip link to the canvas, canvas, caption or finale card when open, HUD buttons (top-left to top-right), then any chips. Dialogs and sheets trap focus, restore it on close, and are dismissible with Escape.

Focus is never moved automatically onto the caption card (the Visitor may be walking). Instead the announcement (8.3) tells keyboard and screen reader users the card is open, and the first Tab from the canvas reaches it. Exception: the finale card is a decision point and takes focus on **Keep exploring** when it appears, if the previous focus was the canvas.

### 8.2 Visual

- Contrast per section 4.2. Name labels and captions have solid backings, 4.5:1 or better (NFR-12).
- Non-text contrast 3:1: control outlines, focus ring, swatch rings, progress bars.
- Visible focus on every interactive element: two-tone ring (`base.css`). In Windows High Contrast the ring becomes a system `Highlight` outline.
- Colour is never the only cue: selected tiles have a check, viewed pictures say "Viewed", errors have an icon and words, role markers on labels are decoration.
- Reflow: content works at 320 px wide without horizontal scrolling; at 200% text zoom nothing is clipped; text-spacing overrides (WCAG 1.4.12) do not break cards (no fixed-height text boxes).
- Target size: 44 px minimum everywhere (the AA minimum is 24 px).
- Orientation: both orientations are supported; nothing is locked.
- No content flashes more than three times a second.

### 8.3 Screen readers and the scene description

| Region | Behaviour |
|---|---|
| Canvas label | "Museum. {Title}. Press H for help." with `aria-describedby` to a visually hidden controls description |
| Scene description (visually hidden, on Start) | "You are in the entrance hall of {title}. {N} pictures hang along {R} galleries, leading to a finale room. {Guide}, your guide, is beside you. Walk freely. Pause by a picture and {Guide} will tell you about it." |
| Presentation live region (`role="status"`, polite) | "{Guide}, photo 3 of 12: {caption}". With no caption: "Photo 3 of 12" (FR-63). Announced once when the presentation starts |
| Room changes (polite, throttled to one per 4 s) | "Entrance hall", "Gallery 2 of 3", "Finale room" |
| Finale | "Finale. {Guide} is sharing a note." then the note's text is read from the card (the card gets focus on its primary button, 8.1) |
| Hint (R2) | "Nearest picture you haven't seen: photo 4 of 12, about 9 metres ahead on your left" |
| Jump (R2) | "Moved to photo 3 of 12" |
| Replay | "Back at the entrance. Viewed pictures have been cleared." |
| Failed photo | "Photo 3 did not load. A Retry button is available." |
| Builder, restored draft (v1.2) | Once, about 600 ms after the step announcement: "Photos aren't kept after a reload. Please add them again. Your names, words and characters are still here." Polite, never takes focus, removal and dismissal are silent (5.17) |
| Builder | Upload progress per photo is `role="progressbar"` with text; reorder, remove and replace outcomes are announced politely; step changes are announced; copy success is announced |

The picture's alternative text is its caption, or "Photo n of N" if there is none (FR-63). Name labels are `aria-hidden`; names are announced through the above regions.

### 8.4 Reduced motion (FR-62, US-32)

Effective setting: Settings (R2) over the operating system's `prefers-reduced-motion`. The frontend mirrors it to `<html data-motion="reduce">` and the scene reads the same value from `settingsStore`.

| Animation | Normal | Reduced motion |
|---|---|---|
| Camera | Follows the Visitor with 120 ms damping | Rigidly attached. Moves on its own only for a presentation, as a hard cut (below) |
| Presentation camera (6.12) | Eases in over 800 ms (up to 1,300 ms for a long swing) and out over 600 ms (up to 1,000 ms for a long swing), after 0.25 s of stillness | A hard cut in as the Guide's fade-in begins, and a cut out on release. No veil |
| Reset view and boom changes | Eased 150 to 450 ms | Instant |
| Guide to the Visitor for a presentation | Walks | Fades in beside the Visitor over 250 ms |
| Guide relocation | 250 ms fade out and in | Instant |
| Presenting gesture | Plays once | Still pose |
| Replay and jump | 400 ms fade-through veil | Hard cut |
| Standing-spot pool | Brightens with proximity and dwell | Steps on at dwell completion |
| Podium ring and dust motes | Brightens, pulses (R2), motes drift | Steps on, no pulse, no motes |
| Confetti (R2) | Plays up to 5 s | Never |
| Loading sweep, frame sheen | Slow looping sweep | Static |
| Panels, sheets, toasts, hover tints | `--duration-*` eased | Instant (durations are 0 ms) |
| Hint glow | Pulses 3 times | Steady |
| Joystick knob return | Eased | Instant |
| Customiser gender change (9.5) | 250 ms shape morph | Instant, same end state |

Reduced motion never removes information: every effect above has a still equivalent.

### 8.5 Non-3D alternatives

| Need | Alternative |
|---|---|
| Walk without a pointer | Keyboard (MVP), arrow buttons (R2, recommended) |
| Reach a picture without steering | Pictures list with jump (R2) |
| See photos and captions without 3D | Slideshow (R2, FR-60). The MVP shows an explanatory message only. See the open question |
| Read captions without sight | Live region announcements and the viewer's `alt` text |
| Larger captions | Caption text size setting (R2), and browser zoom always works |

### 8.6 WCAG 2.2 AA checklist for the build

| Criterion | How it is met |
|---|---|
| 1.1.1 Non-text content | Picture alt is the caption or "Photo n of N"; decorative art is `aria-hidden` |
| 1.3.1, 1.3.2 | Real headings, lists, labels and landmarks (`main`, `nav`); DOM order matches visual order |
| 1.3.4 Orientation | No lock |
| 1.4.3, 1.4.11 | Section 4.2 |
| 1.4.4, 1.4.10, 1.4.12 | rem-based type, reflow at 320 px, no fixed-height text |
| 1.4.13 Content on hover or focus | No hover-only content; there are no tooltips |
| 2.1.1, 2.1.2, 2.1.4 | Keyboard for everything; canvas never traps; shortcuts only when focused |
| 2.2.2 Pause, stop, hide | Moving ornament is slow, small, and off under reduced motion; hints auto-hide but are re-readable in Help |
| 2.3.1, 2.3.3 | No flashing; reduced motion |
| 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7 | Skip link, titles per step, logical focus order, descriptive headings, visible focus |
| 2.4.11 Focus not obscured | `scroll-padding-block`, sticky bars are measured |
| 2.5.1, 2.5.2 | No multi-finger or path gestures are required (pinch has buttons; joystick has the keyboard and, in R2, arrow buttons) |
| 2.5.3 Label in name | Visible labels are contained in accessible names |
| 2.5.7 Dragging movements | Reorder has Earlier and Later buttons; the joystick has alternatives (see the open question for MVP) |
| 2.5.8 Target size | 44 px |
| 3.2.6 Consistent help | The Help button is always in the same place |
| 3.3.1, 3.3.2, 3.3.3, 3.3.4 | Labels, instructions, error text with a fix, review step before publish |
| 3.3.7 Redundant entry | Names are entered once and reused everywhere |
| 3.3.8 Accessible authentication | No authentication; the R2 passcode field allows paste and has no puzzle |
| 4.1.2, 4.1.3 | Names, roles and values on custom controls; status messages through live regions |

Test plan for QA: automated axe checks on every builder step and overlay; manual keyboard-only run of the full Visitor path; VoiceOver (iOS and macOS) and TalkBack on the welcome, the museum and the finale; reduced-motion run; 200% zoom and 320 px reflow; forced-colours check.

---

## 9. Appendix A: Avatar kit and customiser

### 9.1 Proportions (medium height, 1.70 m)

| Part | Spec |
|---|---|
| Overall | About 5.5 heads tall |
| Head | Slightly oval sphere, 0.30 m wide and 0.32 m tall, on a 0.05 m neck |
| Torso | 0.55 m, shoulders 0.40 m wide (regular) |
| Legs | 0.80 m, hips 0.30 m wide (regular) |
| Arms | 0.62 m including the mitten hand |
| Feet | Rounded boxes 0.26 m long |
| Heights | Shorter 0.91 (about 1.55 m), Medium 1.00 (1.70 m), Taller 1.09 (about 1.85 m), uniform scale |
| Gender shape (v1.1) | Multipliers on the Neutral values above, applied first. Full table below. Neutral is all 1.00 and is exactly the shape every museum had before v1.1 (FR-72, FR-75). Gender never changes head size, overall height, or hair, outfit, skin, facial hair, body type or height choices |
| Body types | Applied on top of the gender shape (multiplied). Slim: torso and hips 0.90. Regular: 1.00. Wider hips (`curvy`): hips 1.12, waist 0.96, chest depth 1.04. Wider shoulders (`broad`): shoulders 1.15, torso 1.08, hips 1.00. Head size never changes with body type. The 1.04 chest depth on Wider hips is a legacy value kept so published Neutral museums look identical (FR-75); do not add chest changes to any other body type |
| Budget | 6,000 triangles and 10 draw calls per character (architecture 6.7). Prefer a few clean shapes to many small ones |

**Gender shape table (v1.1).** Values are multipliers on Neutral, so Neutral renders exactly as before. Gender and body type multiply. The technical-artist may tune each value by up to 0.03 to read well, but must keep the ordering Woman < Neutral < Man for shoulders, waist, neck, limbs and brow, and the reverse for hips, jaw softness and eye size.

| Parameter | Woman | Neutral | Man | Why |
|---|---|---|---|---|
| Shoulder width | 0.95 (0.38 m) | 1.00 (0.40 m) | 1.07 (0.43 m) | Main back-view cue |
| Waist width | 0.92 | 1.00 | 1.02 | Taper between shoulders and hips |
| Hip width | 1.06 (0.32 m) | 1.00 (0.30 m) | 0.97 (0.29 m) | Main back-view cue |
| Shoulder to hip ratio (result) | about 1.19 | about 1.33 | about 1.47 | Neighbours differ by 10% or more |
| Torso length | 0.98 | 1.00 | 1.02 | Legs scale 1.01, 1.00, 0.99 so the total height is identical |
| Chest depth | 1.04 | 1.00 | 1.02 | Soft front curve inside the torso scale; no separate shape |
| Neck width | 0.92 | 1.00 | 1.12 | Neck length is unchanged |
| Arm and leg thickness | 0.94 | 1.00 | 1.06 | Hands 0.95, 1.00, 1.05 |
| Head width and height | 1.00 | 1.00 | 1.00 | Never changes; name labels and hair never move |
| Jaw (lower-head width) | 0.94 | 1.00 | 1.06 | Rounder or squarer, same head mesh |
| Brow thickness | 0.90 | 1.00 | 1.15 | Still a thin stroke |
| Eye size | 1.06 | 1.00 | 0.97 | Eyes stay two dark ovals |
| Mouth, nose bump, cheek blush | same | same | same | Identical on every shape |

Combined extremes stay inside these limits, so no runtime clamp should fire: shoulders 0.34 to 0.50 m (Man with Wider shoulders is 0.49 m), hips 0.26 to 0.36 m (Woman with Wider hips is 0.36 m). Unit-test the 12 gender and body type combinations against these limits.

### 9.2 Option labels and swatches

Option ids are the stable storage keys in `contract.ts`. The labels below are the display text and the accessible names. Hex values are the `--avatar-*` tokens.

| Option | Ids and labels |
|---|---|
| Skin tone (10) | `skin-01` Very light `#FBE3D0`, `skin-02` Light `#F4CFB0`, `skin-03` Light medium `#EBB68F`, `skin-04` Medium `#DDA073`, `skin-05` Medium tan `#C98858`, `skin-06` Tan `#B06F44`, `skin-07` Medium brown `#8F5733`, `skin-08` Brown `#70412A`, `skin-09` Deep brown `#52301F`, `skin-10` Very deep `#3A2218` |
| Hair style (12) | `shaved` Shaved, `buzz` Buzz cut, `short-crop` Short crop, `side-part` Side part, `curly-short` Short curls, `bob` Bob, `long-straight` Long straight, `long-wavy` Long wavy, `ponytail` Ponytail, `bun` Bun, `afro` Afro, `braids` Braids |
| Hair colour (11) | `black` `#1C1618`, `dark-brown` `#3B2820`, `brown` `#5E3E2B`, `auburn` `#8B3A22`, `ginger` `#C2652A`, `blonde` `#DDB45E`, `platinum` `#EEE3C6`, `grey` `#A19DA3`, `white` `#F2EFEA`, `pink` `#E487A9`, `blue` `#4D7BD6`. Labels: Black, Dark brown, Brown, Auburn, Ginger, Blonde, Platinum, Grey, White, Pink, Blue |
| Outfit style (6) | `tee-jeans` T-shirt and jeans (top in the outfit colour, fixed denim `--avatar-denim`), `hoodie` Hoodie (hoodie in the outfit colour, fixed joggers), `shirt-trousers` Shirt and trousers (shirt in the outfit colour, fixed charcoal trousers), `dress` Dress (all in the outfit colour, skin-tone legs), `suit` Suit (jacket and trousers in the outfit colour, cream shirt), `jumpsuit` Jumpsuit (all in the outfit colour) |
| Outfit colour (12) | `red` `#C23B3B`, `coral` `#EE7B66`, `orange` `#E98A2E`, `mustard` `#D9A82B`, `green` `#4F9A5E`, `teal` `#2F8F8F`, `sky` `#6DB2E0` (Sky blue), `navy` `#263A66`, `purple` `#7B55A6`, `pink` `#E58FB0`, `charcoal` `#3A3A44`, `cream` `#EFE3CC` |
| Gender (3, optional, v1.1) | `feminine` **Woman**, `masculine` **Man**, `neutral` **Neutral** (default). Ids are the architect's to confirm in the schema decision; the labels are fixed. Display order is Woman, Man, Neutral |
| Face shape (5, new in v2.0, both characters, any gender) | **Provisional ids, the architect confirms:** `oval` **Oval** (default; exactly today's head), `round` **Round**, `square` **Square**, `heart` **Heart**, `long` **Long**. Neutral shape words only; no option is tied to a gender. A draft or museum with no value loads as Oval. Rendering rules in 12.8.2 |
| Clothing pattern (4, new in v2.0, both characters, any gender) | **Provisional ids:** `plain` **Plain** (default, exactly today's garments), `stripes` **Stripes**, `checks` **Checks**, `dots` **Dots**. Applies to the garment that carries the outfit colour (tee, hoodie, shirt, dress, jacket and trousers of a suit, jumpsuit); fixed garments (denim, trousers, joggers, shoes) stay plain. The pattern's second colour is derived from the outfit colour (12.8.2), not chosen. Missing value loads as Plain |
| Outfit style (12 from v2.0, Q-30) | The existing six (above) plus six new, **provisional ids and labels**: `sweater` **Sweater**, `overalls` **Overalls**, `coat` **Coat**, `cardigan` **Cardigan**, `tracksuit` **Tracksuit**, `tunic` **Tunic**. Every style is offered to every gender. Colour roles, silhouettes and the triangle rule are in 12.8.2 G; the picker is in 12.5.3 (today's six stay visible, the new six sit in More options). A missing or old value keeps its existing style |
| Body type (4) | `slim` Slim, `regular` Regular, `curvy` **Wider hips**, `broad` **Wider shoulders**. Ids are unchanged, only the display text and accessible names change (see the review below) |
| Height (3) | Shorter (about 1.55 m), Medium (about 1.70 m), Taller (about 1.85 m) |
| Facial hair (5, both characters, v1.1) | None, Stubble, Moustache, Goatee, Full beard (in the hair colour). Available with every gender |
| Glasses (R2) | None, Round, Square (thin walnut frames) |
| Hat (R2) | None, Beanie, Cap (in the outfit colour) |

Shoes are fixed (`--avatar-shoes` with a `--avatar-sole`). Skin tones are neutral-warm so they read true under the warm light; the technical-artist should check all ten against the finale room's claret and the linen walls.

How options read in the scene:

| Option | Reads as |
|---|---|
| Skin tone | Face, neck, hands, arms and legs share one colour. A faint blush disc (`--avatar-skin-blush`) on the cheeks |
| Hair style | Silhouette first, designed from the back. Volume and length are exaggerated slightly so styles differ at 120 px tall |
| Hair colour | Applies to hair, brows and facial hair |
| Outfit | Large flat colour block plus one fixed contrasting garment, so it reads from behind |
| Gender | Silhouette (shoulders, waist, hips, neck, limbs) and a small change to the jaw, brows and eye size. Head size, height and every other choice stay as they are |
| Body type, height | Silhouette only; the head stays constant |

**Review of the body type labels beside Gender (v1.1).**

| Old label | Problem next to Gender | New label (id unchanged) |
|---|---|---|
| Slim | None. Describes size only | Slim |
| Regular | None | Regular |
| Curvy | Reads as a word about women's bodies, so "Man, Curvy" and "Woman, Broad" look like contradictions or jokes. It is also a judgement about a body rather than a description of the shape | **Wider hips** (`curvy`) |
| Broad | Reads as a word about men's bodies, with the same problem | **Wider shoulders** (`broad`) |

The new labels describe where the shape is wider, which is what the model actually does, so they can sit under any gender. The group label stays **Body type**. In the preview description they read "slim build", "regular build", "wider hips" and "wider shoulders". Tiles are in a two-column grid, so "Wider shoulders" (about 120 px at `--text-md`) fits at 320 px and wraps to two lines at larger text sizes without clipping.

### 9.3 Defaults for a new draft

| | Guide | Visitor |
|---|---|---|
| Gender | Neutral | Neutral |
| Skin tone | `skin-04` | `skin-04` |
| Hair style, colour | `short-crop`, `dark-brown` | `bob`, `brown` |
| Outfit, colour | `shirt-trousers`, `navy` | `jumpsuit`, `coral` |
| Body type, height | Regular, Medium | Regular, Medium |
| Facial hair | None | None (now offered, v1.1) |

Defaults avoid assuming anyone's gender and keep the two characters visibly different at a glance. Neutral is a middle shape, not a "default man": a draft or museum with no gender value always loads as Neutral and looks exactly as before (FR-75), and the customiser then shows Neutral selected. The Creator is never asked to choose.

### 9.4 Customiser layout and behaviour

**Phone portrait.** The live preview is the top 42 dvh. One canvas shows both characters side by side on a shared round plinth (Guide left, Visitor right), each with its name label, so the Creator sees both together (US-7). The active character has a brass ring on its plinth. Below the preview:

1. Tabs: **Guide: {name}** and **Visitor: {name}** (just "Guide" and "Visitor" until names are entered).
2. A second tab row: **Body**, **Face**, **Hair**, **Outfit** (v1.1: Body moves from last to first and is the tab selected when the step opens, because gender sets the base shape the other choices sit on).
3. The options for the chosen tab, each group labelled:
   - Body: **Gender (optional)**; Body type; Height. Gender is always the first group, so it is the first control after the tabs in the tab order.
   - Face: Skin tone; Facial hair (both characters, v1.1).
   - Hair: Hair style; Hair colour.
   - Outfit: Outfit style; Outfit colour.
4. Preview controls on the preview itself: **Turn left**, **Turn right**, **Back view** (44 px, night glass, top-right of the preview), and **Shuffle** and **Reset** under the tabs (tertiary buttons; R2 or Could).

**Phone landscape.** Preview takes the left 45% at full height; the controls scroll in the right 55%.

**Desktop.** Two columns: a sticky preview on the left, the controls on the right.

**Behaviour.**
- Selecting an option updates the preview within 1 s (FR-15), rebuilding only the affected part. There is no "Apply" button.
- Selections persist in the draft; coming back to the step shows them (US-6).
- All option groups are radiogroups with arrow-key navigation. Tabs use automatic activation.
- The preview is `role="img"` with a live text description that updates (debounced 400 ms, polite). Template: "{Name}: [woman or man, only when not Neutral, ]{height} height, {build}, {hair style} {hair colour} hair[, {facial hair}], {outfit}." Examples: "Tom: man, medium height, regular build, short crop dark brown hair, goatee, navy shirt and trousers." and, for Neutral, "Sam: medium height, regular build, bob brown hair, coral jumpsuit." The gender word is the label of the option the Creator chose and appears only here and in the Gender group, never in any Visitor-facing text (A-20). Announce only the description of the character that changed, not both, to keep screen-reader chatter low. **v2.0 additions to the template:** after the build, `{face shape} face` only when the shape is not Oval ("round face"); and a pattern word before the outfit only when the pattern is not Plain: Stripes "striped", Checks "checked", Dots "spotted" ("navy striped shirt and trousers", "coral spotted jumpsuit"). Example: "Tom: man, medium height, regular build, square face, short crop dark brown hair, goatee, navy striped shirt and trousers."
- Gender, facial hair and the reset button are scoped to the active character: the Guide and the Visitor each keep their own value, and switching the Character tab shows that character's selection.
- **Reset** returns the active character to the starting look (9.3), including Neutral. Choosing a gender never resets anything else.
- Drag-to-turn is an enhancement; the Turn buttons are the keyboard and switch path.
- **Loading:** a skeleton silhouette pair and "Getting your characters ready". **Failure:** "We couldn't show the 3D preview. Your choices are still saved." and **Try again**; the option lists stay usable (US-6). **No WebGL:** the text description replaces the preview.
- Lighting in the preview is neutral and slightly cool-white on a soft cream backdrop, so skin and hair colours read true while they are chosen.

### 9.5 The Gender control and the preview change (v1.1)

**Control.**

| Item | Spec |
|---|---|
| Type | Text-tile `role="radiogroup"` (5.3), the same as Body type and Height. Roving `tabindex`, Arrow keys move and select, Space selects, Tab leaves the group. No new component |
| Label | Group label **Gender (optional)** (visible, `--text-sm`, `--weight-semibold`, as the other groups). The radiogroup is `aria-labelledby` that label and `aria-describedby` the helper text |
| Options | **Woman**, **Man**, **Neutral**, in that order. Text only; no icons, pictograms or silhouettes, so the tiles cannot stereotype |
| Default | Neutral is selected on a new draft for both characters and for any older draft or museum with no value. It is shown selected (accent ring and check), not as an empty state. Nothing is required and there is no "skip" control |
| Helper text | "Changes the shape and face. Your other choices stay as they are." Below the tiles, `--text-sm`, `--color-text-muted` (contrast as the other helper text, 4.2). Always visible, not a tooltip |
| Layout, all sizes | One row of three equal tiles: `grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr))`, gap `--space-2`, tiles 44 px tall (`--touch-target`). Down to 320 px they stay in one row; at 200% zoom they may wrap, never clip. Phone portrait, phone landscape and desktop use the same row: it sits at the top of the Body tab, then Body type (two columns), then Height (one row of three) |
| States | Default, hover (`--color-accent-tint` at half strength, desktop only), focus (two-tone ring from `base.css`), selected (tint, `--border-selected` ring, check), disabled never (the control stays usable while the preview loads or fails, US-46) |
| Announcement | The radio's own "Woman, radio button, 2 of 3, selected" is enough. The debounced preview description follows 400 ms later (9.4) |

**Preview behaviour on change (FR-15, US-46).**

| Case | Behaviour |
|---|---|
| Trigger | Selecting a Gender tile by click, tap, Arrow key or Space |
| What changes | Only the active character. Shoulders, waist, hips, torso, neck, limbs, hands, jaw, brows and eye size move to the values in 9.1. Hair, outfit, facial hair, badge, name label, camera and the other character do not move |
| Motion | One 250 ms morph (`--duration-gender-morph`, `--ease-standard`): every shape parameter interpolates linearly from its current value to the target in the same tween. No pop, sparkle, spin, scale overshoot or sound |
| Timing | The first changed frame appears within 100 ms of the change and the final shape within 350 ms, well inside the 1 s limit |
| Reduced motion | The target shape appears in one frame, with no tween (`--duration-gender-morph` is 0 ms; the scene must read the effective setting from `settingsStore`, 8.4) |
| Rapid changes | A new choice retargets the tween from the current values. There is no queue, so sweeping Arrow keys across the three tiles never lags and ends on the selected shape |
| Parts that depend on shape | Outfit, hair, facial hair and the badge are attached to the same shape parameters, so they follow the morph. If a part must be rebuilt, rebuild it in the first frame and tween only transforms. Never show an unclothed, hairless or empty frame |
| Loading and failure | The choice is saved at once. While the preview is loading, the skeleton silhouettes are generic and do not depend on gender. If the preview fails, the Gender group stays usable and the preview shows the saved choice when it recovers (Try again) |
| Visit and Visitor preview | The same kit and parameters render the characters in the Visitor preview and the visit, so the shape matches the builder on every device |

### 9.6 Art guidance: how Woman, Man and Neutral differ (for the technical-artist)

Principle: **one body, three proportion sets.** The three shapes are the same mesh with different parameters (9.1). They must look like three members of one family within the "designer toy" style (1.6), not three different characters. Differences are in proportion, never in props, colour or clothing.

| Area | Woman | Neutral | Man | Notes |
|---|---|---|---|---|
| Silhouette from behind (most important, the Visitor is seen from behind) | Narrower shoulders, a clear waist, fuller hips | Today's shape | Broader shoulders, straighter taper, narrower hips | Render each shape as a flat single-colour silhouette at 120 px tall. The shoulder to hip ratio must differ by 10% or more between neighbouring shapes, or raise the shoulder and hip values by up to 0.02 each |
| Shoulders | 0.38 m, rounded | 0.40 m | 0.43 m, a little squarer | Keep the soft rounded form; no hard edges |
| Waist | Gentle waist | Straight | Straight | Never an exaggerated hourglass |
| Hips | 0.32 m | 0.30 m | 0.29 m | |
| Neck and limbs | Slightly slimmer | Today's | Slightly thicker | The mitten hands scale with the limbs |
| Face | Rounder jaw, slightly larger eyes, thinner brows | Today's | Squarer jaw, thicker brows, slightly smaller eyes | Same two dark oval eyes, tiny nose bump, small smile and rose blush on all three. No eyelashes, no lips, no eye shadow, no stubble by default |
| Head, height, name label | Identical | Identical | Identical | Gender never makes a character taller or shorter |

Do not add: separate bust geometry (the chest change is a depth scale only), heels or different shoes, gendered colours, gendered accessories, or different badge and sticker designs. The brass Guide badge and the Visitor sticker stay on the left chest and follow the chest depth so they never float or clip.

Keep the budget: no new geometry for gender, so the 6,000 triangle and 10 draw-call limits are unchanged. If the budget is tight, the product-manager's fallback applies: ship the shape and proportion changes and defer the face changes to Release 2.

**Neutral is unchanged.** All Neutral multipliers are 1.00, so it must be vertex-identical to today's character. Add a snapshot test of a Neutral character against the v1.0 build, because FR-75 requires older museums to look the same.

### 9.7 Inclusive combinations

Every option works with every gender. The customiser never hides, reorders, pre-selects or disables an option because of the gender chosen, and the Creator can build any look, for example a Man in a dress, a Woman with a full beard, or a Neutral character with a bun and a suit.

Technical-artist check list (extends 9.2; run in the builder preview and in the visit):

| Check | Range |
|---|---|
| No clipping or gaps between outfit, body and hair | All 6 outfits by 3 genders by 4 body types by 3 heights (216 combinations), with the outfit sleeves, collars, skirt and trouser hems following shoulder, waist and hip values. The dress skirt starts at the waist and flares from the hip value, so it fits all shapes |
| Hair against shoulders | All 12 hair styles by Man with Wider shoulders (broadest) and Woman with Slim (narrowest). Long, ponytail, braids and afro must not pass through the shoulders or leave a gap at the neck |
| Facial hair on the jaw | All 4 styles (not None) by 3 genders by the 12 hair styles. Facial hair attaches to the jaw parameter so it follows a rounder or squarer jaw without floating |
| Skin tone | All 10 skin tones by 3 genders. Brows and blush stay visible: thin Woman brows in black or dark brown on `skin-09` and `skin-10` must still read at the preview's default size; if not, raise the Woman brow value to 1.00 |
| Hair colour | All 11 hair colours for brows and facial hair, including white and platinum on `skin-01` |
| Back view and front view | Every shape in both views, since the Visitor sees their own character from behind |

The Visitor-facing experience never shows a gender label (A-20). Name labels, the badge and the sticker are the same for every gender.

---

## 10. Appendix B: Copy deck (Australian English)

| Where | Copy |
|---|---|
| Home heading | "Turn your photos into a little museum" |
| Home body | "Add your photos, meet your guide, and send a link. They open it on their phone and wander through, with you as their guide." |
| Home steps | "1 Add up to 20 photos", "2 Make your two characters", "3 Send the link" |
| Home primary | "Create a museum" |
| Home footer | "Privacy", "Terms", "Report a problem" (destination to be confirmed). "For pricing or contracts, please contact our Sales team." |
| Step names | "Photos", "Words", "Characters", "Review and publish" |
| Add photos | "Add photos" / "You can add 1 to 20 photos. JPEG, PNG, WebP or HEIC, up to 15 MB each." |
| Photo order help | "Photos hang along the museum from the entrance to the finale, in this order." |
| Caption label | "Caption (optional)" / helper "This is what your guide says about the photo." |
| Visitor name | "Who is this museum for?" / helper "Their name floats above their head. Up to 24 characters." |
| Guide name | "Your name" / helper "Your guide wears this above their head. Up to 24 characters." |
| Title | "Museum title (optional)" / helper "Leave it blank and we'll use \"A museum for {name}\"." |
| Closing message | "Closing message (optional)" / helper "Your guide shares this when they reach the finale. Up to 1,000 characters." |
| Consent | "I have the right to share these photos, and the people in them know about this and are comfortable with it." plus "Read the terms" and "Privacy policy" |
| Publish | "Publish museum" / progress "Publishing your museum... 80%" |
| Published heading | "Your museum is ready" |
| Share link | "Share link" / "Send this to {name}. Opening it on a phone works best." / "Copy link" / "Share..." / "Copied" |
| Edit link | "Private edit link" |
| Edit warning | "Save this link now. It is the only way to change or delete your museum, and we can't recover it if you lose it. Don't share it." |
| Edit acknowledgement | "I've saved my edit link." / button "Finish" |
| Delete dialog | Title "Delete this museum for good?" Body "{name}'s link will stop working straight away, and your photos and words will be removed. This can't be undone." Buttons "Cancel" (default) and "Delete museum" |
| Deleted | "Your museum has been deleted. The link no longer works." / "Make a new museum" |
| Welcome | Eyebrow "A private view", title as set, "For {name}", "Your guide today: {Guide}", button "Start" |
| First hints | "Drag to walk", "Drag here to look around", "Walk up to a picture and {Guide} will tell you about it", "Tap a picture to look closer" |
| Card header | "{Guide}" / "Photo 3 of 12" |
| Caption strip (v1.4, 5.6) | Buttons "Read more" and "Show less" (accessible names "Read more of the caption" and "Show less of the caption"). Strip region name: "{Guide}, photo 3 of 12" (the visually hidden text). Look closer keeps its label |
| Finale | "A note from {Guide}" / "Keep exploring" / "Replay from the start" / no message: "The end" "Thanks for visiting, {name}." |
| Hint | "Where next?" / "To the finale" |
| Retry chip | "Photo 3 did not load." / "Retry" |
| Restored draft notice (v1.2, 5.17) | Line 1 "Photos aren't kept after a reload. Please add them again." Line 2 "Your names, words and characters are still here." Action "Add photos" (steps 2 to 4). Dismiss button label "Dismiss notice". Announcement is the three sentences in one |
| Camera setting (R2, v1.2, 6.12.9) | Switch "Move the camera to show each picture" / helper "When this is off, the view stays behind your character." |
| Not found | As 7.5 |
| Context lost | As 7.8 |
| Customiser, gender (v1.1) | Group label "Gender (optional)"; options "Woman", "Man", "Neutral"; helper "Changes the shape and face. Your other choices stay as they are." |
| Customiser, body type (v1.1) | Group label "Body type"; options "Slim", "Regular", "Wider hips", "Wider shoulders" |
| Customiser, tabs (v1.1) | "Body", "Face", "Hair", "Outfit" (in that order) |
| Customiser, facial hair | Group label "Facial hair"; "None", "Stubble", "Moustache", "Goatee", "Full beard"; shown for the Guide and the Visitor |
| Preview description | As 9.4: "{Name}: [woman or man, ]{height} height, {build}, {hair}, [{facial hair}, ]{outfit}." Names the gender only when it is not Neutral |

### 10.1 Audit of gendered wording (FR-76, US-48)

Scope: app-written text in this spec. The app never writes a gendered pronoun or noun (she, her, he, him, girlfriend, boyfriend) for the Guide, the Visitor or the Creator. Singular "their" and "your" are allowed. The words "woman" and "man" appear only as the Creator's own Gender choice in the builder (labels and the preview description) and never in the Visitor experience.

Result of the search: no copy deck entry, no UI string and no screen-reader string in this spec used a gendered word. Fourteen sentences of behaviour prose (which developers copy into code comments and test names) used "she" or "her" for the Visitor. They are reworded here.

| Section | Was | Now |
|---|---|---|
| 1.6 | "The Visitor mostly sees her character from behind" | "...sees their own character from behind" |
| 2.2 Welcome | "while she reads" | "while the Visitor reads" |
| 2.2 Arrival | "the Guide beside her" | "the Guide beside the Visitor" |
| 2.2 Finale | "stands beside her" | "stands beside the Visitor" |
| 3.4 | "the picture she is looking at" | "the picture being looked at" |
| 5.8 Viewer | "exactly where she was" | "exactly where they were" |
| 5.12 Picture list | "walks the Visitor to stand...", "relocates beside her" | "walks the Visitor's character to stand...", "relocates beside the Visitor" |
| 6.1 Move | "stop her and she slides", "she stops at once" | "stop the character, which slides", "the character stops at once" |
| 6.3 Follow | "behind her as she turns" | "behind the character as it turns" |
| 6.6 Viewer exit | "exactly where she was" | "exactly where they were" |
| 6.7 Presentation | "between her and the picture and never hides her" | "between the Visitor and the picture and never hides the Visitor" |
| 6.8 Guide cues | "when she stops" | "when the Visitor stops" |
| 6.9 Finale | "beside her", "until she leaves", "behind her" | "beside the Visitor", "until the Visitor leaves", "behind the Visitor" |
| 7.9 Failed photo | "and she keeps roaming" | "and the Visitor keeps roaming" |

Remaining watch list for other owners (not in this document):
- Code comments and test names under `src/` (for example `FinaleSignal.test.ts`, `composition.ts`, `AutonomousGuideSource.ts`, `hair.ts`) use "she" and "her" for the Visitor. They are not app-written text, so they are out of scope for FR-76, but the frontend-developer can reword them when passing by.
- `docs/requirements/user-stories.md` story text (for example US-7 "walking with her", US-8 "what she will see") uses gendered pronouns in the story prose; this is not UI copy. The product-manager may want to reword it.
- Guard test: scan app-written strings for the whole-word list she, her, hers, he, him, his, herself, himself, girlfriend, boyfriend. Do not include "woman" or "man", which are the Creator-facing Gender labels.

---

## 11. Appendix C: Requirement coverage

| Requirement | Where addressed |
|---|---|
| FR-1 to FR-8, FR-10 to FR-12 (builder) | 2.1, 3.6, 5.1 to 5.4, 5.15, 5.16, 7.10, 7.11 |
| FR-13 to FR-16, FR-20 (characters) | 1.6, 9 |
| FR-72, FR-73 (gender, shape only), FR-15 (preview within 1 s) | 9.1, 9.4, 9.5, 9.6, 9.7 |
| FR-74, FR-75 (render everywhere, older museums are Neutral) | 9.3, 9.6 (same kit and same parameters in builder, preview and visit) |
| FR-76 (no gendered pronouns or nouns) | 10.1 (the v1.2 notice and setting copy use none) |
| FR-26, FR-30, FR-62, QA N-2 (presentation camera, picture fully visible) | 3.4, 3.5, 5.5, 6.3, 6.7, 6.12, 8.4 |
| FR-12, US-6 AC-3, US-29 AC-1 partial (restored draft, photos not kept) | 2.1, 5.17, 8.3, 10 |
| FR-17, FR-18 (labels, animation) | 5.5, 6.1, 6.8 |
| FR-24, FR-25 (welcome, arrival) | 2.2, 7.2 |
| FR-26 to FR-31, FR-71 (Guide) | 3.5, 5.6, 6.7, 6.8 |
| FR-29 (finale) | 1.5, 5.7, 6.9 |
| FR-32, FR-69, FR-70 (hint, progress, prompt) | 5.11, 6.9, 8.3 (R2) |
| FR-33 to FR-36 (movement, viewer, list) | 5.8, 5.9, 5.12, 6.1 to 6.6 |
| FR-39, FR-40 (layout, lighting) | 1.4 |
| FR-47 to FR-52, FR-55, FR-56 | 2.1, 5.15, 7.5 |
| FR-57 to FR-60 (loading, failures, WebGL) | 7 |
| FR-61 to FR-65 (accessibility, reduced motion) | 8 |
| NFR-10 (devices, 44 px) | 3.1, 3.2 |
| NFR-12 (WCAG 2.2 AA, 4.5:1 labels) | 4.2, 5.5, 8 |
| NFR-13 (privacy link) | 7.2, 10 |
| NFR-23 (Australian English, DD/MM/YYYY) | 1.8, 10 |
| NFR-25 (live-readiness) | The card, labels and cues read presentation and state from the registry and `sessionStore` only, so a future network source needs no design change. In live mode the Guide's header and card would be driven by the Creator's input without layout changes |

---

## 12. CR-4 polish (v2.0)

Requirement IDs are from requirements v0.4 (Epic E10, FR-77 to FR-94, NFR-27 to NFR-31) and user stories US-49 to US-61. This section is written to be built as it stands. Hex values live in `src/styles/tokens.css`; this section names the tokens.

### 12.0 How to read this section

| Rule | Detail |
|---|---|
| Precedence | Section 12 wins over sections 1 to 11 where they disagree |
| Unchanged | Palette, logo, typeface family (Q-29 default: keep Fraunces and the system stack), flows, the four builder steps and their order, draft and museum formats (except the new optional character choices in 9.2: face shape, six clothing styles, pattern), camera and Guide behaviour, the caption card rules in 3.5, the presentation camera in 6.12 |
| No new CSS file | Every rule goes into the existing `src/ui/styles/*.css`. `src/styles/base.css` needs no change |
| Selector safety | Existing class names, ids, `data-*` attributes and accessible names stay (list in 12.11). New elements get new class names. Where a control must appear in two places (Preview on phones), exactly one is visible per viewport and the hidden one is `display: none` so it leaves the accessibility tree |
| Motion | Every new transition uses a token and is 0 ms under reduced motion (`--duration-overlay`, `--duration-stagger`, `--rise-distance`). No overlay, sheet, dialog or card transition is over 250 ms (FR-79) |
| Copy | New text follows FR-76 and Australian English (12.10) |

### 12.1 Scales and one component style set (FR-77, FR-78)

**Type scale (FR-83: 16 px body, 14 px secondary, 12 px floor).**

| Token | Size | Use |
|---|---|---|
| `--text-micro` | 12 px | Floor. Decorative or repeated text only, for example joystick direction marks. Never the only place information appears |
| `--text-xs` | 14 px (was 13) | Counters, eyebrows (uppercase, `--tracking-eyebrow`), file names, step labels, tags, edge-arrow distance |
| `--text-sm` | 14 px | Helper text, tertiary buttons, HUD pill, caption card secondary text (unchanged) |
| `--text-md` | 16 px | Body, inputs, buttons, tabs, tiles, strip caption |
| `--text-lg` / `--text-lead` | 18 px | Lead lines, captions, card titles, large buttons |
| `--text-xl` | 22 px | Section headings (h2) |
| `--text-2xl` | 28 px | Screen headings (h1), "For {name}" |
| `--text-display` | 30 to 52 px | Welcome title |
| `--text-hero` | 32 to 56 px | Landing heading only |

Line heights: `--leading-tight` 1.2 for display and h1, `--leading-snug` 1.3 for card titles and lead lines, `--leading-normal` 1.5 body, `--leading-reading` 1.6 captions. Headings are Fraunces 600; from 28 px up add `letter-spacing: var(--tracking-display)`. Weights: 400 body, 500 labels, 600 headings and buttons. The caption card header and strip keep their exact sizes (3.5 depends on them).

**Spacing.** The 4 px scale only. Inside components: `--space-2` (8), `--space-3` (12), `--space-4` (16). Between siblings in a stack: `--space-4`. Between sections: `--space-6` on phones, `--space-8` from 640 px. Between targets: never under `--target-gap` (8 px). Page side padding is `--page-gutter`. Landing sections use `--section-gap`.

**Radius.** `--radius-sm` 6 (scroll shadows, chips inside a card), `--radius-md` 12 (fields, tiles, alerts, inline cards), `--radius-lg` 20 (cards, dialogs, sheets, caption card), `--radius-xl` 28 (welcome card, landing frame), `--radius-pill` (buttons, tags, HUD trays, stepper segments).

**Elevation (one scale for every surface).**

| Level | Token | Used by |
|---|---|---|
| 0 flat | none | Fields, tiles, tags on a card |
| 1 card | `--shadow-card` | Builder cards, review cards, photo rows |
| 2 raised | `--shadow-raised` | Hovered or selected card, landing step cards; the action bar uses `--shadow-bar` |
| 3 panel | `--shadow-panel` | Caption and finale cards, dialogs, sheets |
| 4 glass | `--shadow-glass` | HUD trays, hint chips, night buttons |

**Component style set.** Same component, same style on every screen.

| Component | Style |
|---|---|
| Primary button | Fill `--gradient-accent` (top `--color-accent-top` to `--color-accent`), text `--color-on-accent`, `--shadow-button`, pill. Heights 44 (`--touch-target`), 48 (`--touch-target-md`, builder bar) or 56 (`--touch-target-lg`, calls to action). Hover: `--color-accent-hover` fill (gradient off). Pressed: `--color-accent-active`, `--shadow-button-pressed`, scale `--press-scale`. Focus: the two-tone ring (base.css) |
| Secondary | `--color-surface` fill, `--border-control` accent outline, accent text. Hover `--color-accent-tint`. Pressed tint plus scale |
| Tertiary | Transparent, accent text, 44 px. Hover tint and underline |
| Danger | `--color-danger` fill, `--color-on-danger` text. Used only for delete, remove and start again. Never next to a primary of the same size without a visual gap of `--space-4` |
| Night | Glass over the scene (5.1), `--shadow-glass` |
| Fields | 48 px minimum, `--border-control` `--color-border-strong`, `--radius-md`, label above, helper below, text 16 px |
| Cards | `--color-surface`, `--radius-lg`, `--shadow-card`, padding `--space-4` (phone) or `--space-5` (640 px up) |
| Alerts | Tint fill, state icon, a `--accent-bar-width` bar on the left in the state colour (danger, warning, success, info = `--color-accent`), `--radius-md`. Role rules in 5.14 |
| Tags | Pill, `--text-xs`, 600. **Required**: `--color-accent-tint` fill, `--color-accent` text. **Optional**: `--color-surface-sunken` fill, `--color-text-muted` text. The word is always in the tag, never colour alone |
| Tabs | Segmented: equal-width pills in a `--color-surface-sunken` track, selected pill `--color-accent` with `--color-on-accent` text, 44 px, 8 px gap |
| Dialogs and sheets | `--radius-lg`, `--shadow-panel`, brass hairline (`--shadow-inset-frame`), scrim `--color-scrim`, enter in `--duration-overlay` |

**Hierarchy: one primary action per screen (FR-78).**

| Screen | Primary | Secondary | Destructive |
|---|---|---|---|
| Landing | Create a museum | Footer links | none |
| Builder steps 1 to 3 | Next | Back, Preview | Remove (photo row, inline confirm) |
| Builder step 4 | Publish museum | Back, Preview | none |
| Published | Copy link (share) until the edit link is acknowledged, then **Finish** | Copy edit link, Share..., Open my museum, and Copy link once Finish is primary | none |
| Edit screen | Copy share link | Back to home | Delete museum |
| Delete dialog | Cancel (default focus, secondary look until focused) | | Delete museum |
| Welcome | Start | Privacy | none |
| Caption card | none (Close and Look closer are quiet icon buttons; Read more is a text button) | | |
| Finale card | Keep exploring | Replay from the start | none |
| Error screens | Try again, or Go to the home page | | none |
| Photo viewer | none (Close is the strongest control, a night icon button) | Zoom buttons | none |
| Dialogs (missing items, context lost) | Close, Reload | | none |

### 12.2 States, transitions, empty and error states (FR-79)

| State | Rule |
|---|---|
| Default | As 12.1 |
| Hover | Pointer only: `@media (hover: hover)`. A tint or fill change in `--duration-fast`. Never the only cue |
| Focus | Two-tone ring (base.css), unchanged. Never removed |
| Pressed | Scale `--press-scale` plus the pressed fill. Instant under reduced motion |
| Disabled or unavailable | 45% opacity, `aria-disabled`, the reason in nearby text (5.1). Not for hiding information |
| Loading | Spinner in place of the icon, `aria-busy`, presses ignored, label kept short |

**Transitions.** Colour and fill changes: `--duration-fast` (150 ms). Cards, sheets, dialogs, hint chips: enter with a fade and a rise of `--rise-distance` over `--duration-overlay` (220 ms), `--ease-out`; exit in `--duration-fast`. Bottom sheets slide up 100% over `--duration-overlay`. Progress fills keep `--duration-normal` (they are not overlays). Siblings that enter together (landing steps, welcome lines) delay by `--duration-stagger` each, at most four siblings. All three tokens are 0 under reduced motion, so the final state appears at once.

**Empty and error states are designed, not bare text.** Shared pattern: a `--color-surface` card on `--gradient-page`, radius `--radius-xl`, `--shadow-raised`, brass hairline, an illustration or frame mark of 96 to 160 px, a heading, one sentence, one primary action.

| State | Design |
|---|---|
| No photos yet (step 1) | The drop area itself: frame mark (64 px), "No photos yet", the file rules line, **Add photos** (56 px). When photos exist the same area shrinks to the count line |
| Upload failed (photo row) | A 4 px danger bar on the row's left, the alert icon and reason in the status line, **Retry** as a primary 44 px button in the row |
| Museum not found, Couldn't open it | 7.5 and 7.6 on the shared pattern; the crooked-frame illustration on not found |
| WebGL unavailable, and the builder's "3D preview isn't available" | 7.7 on the shared pattern; in the builder the message sits inside the preview frame with the text description of both characters under it |
| Offline | The offline bar (12.6.7) |

### 12.3 Landing page (FR-80, NFR-27)

**Order of content (DOM order changes: the Create button moves above the steps).** Header (brand) then main: eyebrow, h1, description, **Create a museum**, "No account needed.", the three steps, then the framed illustration (on phones it comes after the steps visually; on desktop it sits in the right column). Footer last. The illustration is decorative (`alt=""`), so reading order is unaffected.

| Part | Spec |
|---|---|
| Page | Background `--gradient-page`, min-height 100 dvh. Side padding `--page-gutter`. Content max `--content-wide-max-width` |
| Header | Brand in Fraunces 600, `--text-lg`, 44 px target, with the frame mark (24 px) before it. Padding `--space-3` `--page-gutter` plus the top safe area |
| Eyebrow | "A private view", `--text-xs`, uppercase, `--tracking-eyebrow`, muted, preceded by a 24 by 1 px brass rule (decoration) |
| Heading | `--text-hero`, Fraunces 600, `--leading-tight`, `--tracking-display`, balanced, max 14 em wide. Copy unchanged |
| Description | The copy-deck sentence pair, `--text-lead`, `--leading-reading`, `--color-text`, max 34 em |
| Create a museum | Primary, 56 px, minimum width 15 rem on phones (full width up to 22 rem), `--shadow-button` |
| Reassurance | "No account needed." below the button, `--text-sm`, muted. Source: FR-1 |
| Steps | An ordered list of three cards (`--color-surface`, `--radius-lg`, `--shadow-card`, hairline `--color-border`). Phone: stacked rows, each 64 px minimum: number disc (36 px, brass hairline ring, Fraunces numeral in accent) then the title (`--text-md`, 600) and a muted one-line description (`--text-sm`). From 640 px: three columns, number on top. Cards enter with the stagger (12.2). Hover (pointer) lifts to `--shadow-raised` and `--color-surface-raised` |
| Illustration | Inside a picture frame: `--scene-mat` mat 12 px, `--scene-frame` outer 6 px, brass hairline, `--shadow-art`, `--radius-md`, rotated -1.5 degrees (static). Phones: width 70% (max 14 rem), centred, after the steps. Desktop: the right column, width up to 26 rem |
| Footer | Hairline `--color-border` above, links centred on phones and left on desktop, 44 px targets with 8 px gaps, the Sales line in `--text-sm` muted |

**Step descriptions (new muted lines).** 1: "Photos hang along the museum in the order you choose." 2: "Pick a look for you and for your visitor." 3: "They open it on their phone and wander through."

**Above the fold.** At 360 by 640 the brand, eyebrow, heading (three lines at about 33 px), description (about four lines at 18 px) and the Create button end near y 420 to 450 (header 52, then 16, 20, 12, 119, 12, 112, 20, 56, and the reassurance line). It must be fully visible with at least 80 px to spare at 360 by 640 and 390 by 844. At 1280 by 720 the two-column layout puts everything above y 560. QA measures the Create button's bottom edge in both. FR-80 asks for a one-sentence description; the copy deck has two short sentences. They stay as one paragraph so the existing copy and tests hold; if the product manager wants one sentence, drop the second (12.12).

**Size and stability (NFR-27, NFR-28).** CSS only: no new font (Fraunces 400 and 600 as now), no new image, the illustration is the existing 5.8 kB SVG. Expected growth is under 10 kB. Give the illustration `width`, `height` and `aspect-ratio` so nothing shifts; add an `@font-face` fallback for the display font with `size-adjust` and `ascent-override` tuned to Georgia, so the swap moves the layout by less than 0.02 CLS. Measure CLS at 360 by 640 and 1280 by 720: 0.1 or less.

*As built (frontend, measured; tokens updated 02/11/2026):* the fallback face is `'Fraunces Fallback'` (Georgia at `size-adjust: 93%`, declared in `src/ui/styles/fonts.css`). It is part of the token: `--font-display` is `'Fraunces Variable', 'Fraunces', 'Fraunces Fallback', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`, so the fallback comes straight after the real font and the frontend needs no override of its own.

### 12.4 Builder shell: progress, outstanding list, bar (FR-82, FR-84 to FR-88)

#### 12.4.1 Header

Brand left (44 px). From 640 px the **Preview** tertiary button stays in the header, **except on step 4 (Review)**. Below 640 px it moves into the action bar (12.4.4) and the header button is `display: none`. The header scrolls away; it is not sticky.

*Decision, 02/11/2026 (tech lead, matches the build):* **one Preview is visible at a time.** On step 4 at 640 px and up the Preview sits **beside Publish** (12.5.4) and the header copy is hidden; on steps 1 to 3 it stays in the header. The DOM holds three Preview buttons (header, action bar, Review) and CSS leaves exactly one visible, the others `display: none` so they leave the accessibility tree (12.0, selector safety). Back and Preview are not rendered while publishing.

#### 12.4.2 Step header and stepper

Every step opens with the same block: eyebrow (`--text-xs`, "Step 2 of 4"), the h1 (the step name, focused on arrival as today), and a **purpose line** (`--text-lead`, muted, at most two lines at 360). Purpose lines (new copy, 12.10) tell the Creator what the step is for and what is required. *Order, decision 02/11/2026 (tech lead, matches the build): the restored-draft notice (5.17) is the heading's next sibling, so on step 3 the order is h1, notice (when shown), purpose line, "Still to do". The purpose line comes after the notice because the notice's test and markup require it directly after the heading.* The stepper nav keeps its text "Step 2 of 4: Words" in the DOM exactly as today; visually only "Step 2 of 4" shows (the rest is a visually hidden span), which removes the duplicated step name.

| Part | Phone and tablet (under 1024 px) | Desktop (1024 px and up) |
|---|---|---|
| Position | In the page flow, **not sticky** (it was sticky and took 80 px for good) | Left rail, sticky at 16 px, 14 rem wide (was 12) |
| Form | Four segments, 8 px gap. Each: a 44 px-tall button whose top part is the bar (`--progress-bar-height`, 8 px) and under it a short label (`--text-xs`): Photos, Words, Characters, Review. Accessible names stay the full labels ("Review and publish") | Vertical list: 32 px numbered marker, label `--text-md`, a 2 px `--color-border` connector between markers |
| Done | Bar fill `--color-accent`, label with a 16 px check icon before it, plus the visually hidden " (done)" | Marker filled accent with a check |
| Current | Bar `--color-accent-tint` fill, `--border-control` accent outline, label 600, `aria-current="step"` | Row `--color-accent-tint`, marker ringed accent, label 600 |
| Reachable, not done | Empty bar with `--hairline` `--color-border-strong`, label normal | Marker outlined |
| Locked | Not a button, label `--color-text-muted`, no outline change | Same |
| Narrow or large text | Container query on the nav: from `min-width: 20em` four across; under it a 2 by 2 grid (it happens at 320 px and at 200% text). Labels wrap, never clip | n/a |

#### 12.4.3 "Still to do" list (FR-85)

A region under the purpose line on every step, always visible, never behind a control.

| Part | Spec |
|---|---|
| Source | `validateDraft(snapshot, 'publish')`, the same function and issue ids as the Preview "what is missing" dialog (which shows its preview-level subset). One list, two views |
| Contents | Only what is still outstanding. Chips for these issue ids, in step order. Short labels (new copy): `photos` "Add a photo"; `photos-uploading` "Wait for photos to finish"; `photos-failed` "Fix the photo that didn't upload"; `visitorName` "Add the Visitor's name"; `guideName` "Add a Guide name"; `consent` "Confirm you can share the photos". Final strings come from the shared issue list; these are the targets |
| Empty | One line with a check icon: "Ready to publish" |
| Heading | A visible label "Still to do" (`--text-sm`, 600) |
| Chip | A button, 44 px tall, `--radius-pill`, `--color-accent-tint` fill, accent text `--text-sm` 600, an open-circle icon (20 px) before the label, 8 px gaps, wraps. Pressing it does what the dialog links do: go to the step and focus the field (`goToIssue`) |
| Phone | Chips wrap in the flow under the purpose line (at most about 100 px tall with four chips) |
| Desktop | In the left rail under the stepper, as full-width left-aligned rows |
| Behaviour | Not a live region and never announced (it would chatter). A chip leaves when its item is fixed (fade in `--duration-fast`, instant under reduced motion). It does not hide while the user is typing |

#### 12.4.4 Action bar (sticky)

| Part | Spec |
|---|---|
| Position | `position: sticky; bottom: 0`, `--color-bg` background, `--shadow-bar`, no hard top border. Padding `--space-3` `--space-4` plus the bottom safe area. `min-height: var(--bar-min-height)` (never a fixed height, so it grows with text size). Landscape phone: `--bar-min-height-compact` |
| Progress line | A 3 px line along the bar's top edge: track `--color-border`, fill `--color-accent`, width 25%, 50%, 75%, 100% for steps 1 to 4, width change in `--duration-normal`. `aria-hidden` (the stepper carries the meaning) |
| Phone (under 640 px) | Three controls in one row, 8 px gaps: **Back** (secondary, 48 px, from step 2; absent on step 1, its slot stays empty), **Preview** (tertiary with the eye icon, 48 px), **Next** (primary, 48 px, minimum 7 rem, `margin-left: auto`). Step 4: Next is absent and Publish stays in the content (12.5.4) |
| 640 px and up | Back left, Next right (as today). Preview stays in the header on steps 1 to 3; on step 4 it sits beside Publish (12.4.1, 12.5.4) |
| While publishing | Back and Preview are not rendered; nothing else changes |
| Large text | The row may wrap to two lines; nothing is clipped |
| Keyboard open (FR-84) | `index.html` already sets `interactive-widget=resizes-content`. For browsers that ignore it (iOS Safari): while a text field is focused and `visualViewport.height` is under 75% of `innerHeight`, set `data-keyboard="open"` on `.builder`; the bar becomes `position: static` at the end of the content so it never covers the field, and every field gets `scroll-margin-block: 7.5rem` so the focused field clears the keyboard. Inputs stay at 16 px, so the page never zooms on focus |
| Browser bars | Use `dvh`. The bar is sticky inside the scrolling page, so a retracting address bar never leaves a gap or hides it |

#### 12.4.5 Validation (FR-87)

Required fields show their message **on blur** (after the Creator has typed in the field, or tabbed through it empty) and on a failed Next, beside the field (5.2). Never on first render and never while the Creator is still typing in it. The message says how to fix it ("Add your name so the museum can greet you" is the target tone). Existing messages from the draft issue list are reused.

#### 12.4.6 Time hints (FR-88, Could)

Not specified. The requirement wants figures from observed usability tests, and none exist. Do not invent times.

### 12.5 Builder steps

Every step: step header (12.4.2), "Still to do" (12.4.3), then sections. Sections are labelled groups: a card with an h2 (`--text-lg`, Fraunces 600) and a tag, **Required** or **Optional** (FR-86). The reading order is the DOM order. Nothing is removed or reordered across steps. **Three Next presses reach Publish:** step 1 Next (needs one usable photo), step 2 Next (needs both names), step 3 Next (always allowed, everything has a default), then on step 4 the consent box and Publish (FR-86).

#### 12.5.1 Step 1: Photos

| Part | Spec |
|---|---|
| Purpose line | The existing sentence: "You can add 1 to 20 photos. JPEG, PNG, WebP or HEIC, up to 15 MB each." (it moves up from the body into the purpose slot) |
| Section "Your photos" | Tag **Required** with the text "at least 1 photo" |
| Drop area | The card from 12.2 (empty state). Contains the **Add photos** primary button (56 px, full width up to 22 rem on phones), the count line "5 of 20 photos" (`--text-sm`) and a determinate bar (8 px, `aria-hidden`, fill `--color-accent`). Desktop adds "or drag photos here" (pointer devices only) |
| Order help | "Photos hang along the museum from the entrance to the finale, in this order." once photos exist, `--text-sm` muted |
| After the list | When 1 to 19 photos exist, a secondary **Add more photos** button below the list (different name from "Add photos") |
| DemoNotice, rejections | Unchanged, using the alert pattern with the accent bar |

**Compact photo row (phone and tablet; replaces the 5.4 layout, behaviour unchanged).** Target at 360 px: no more than 300 px tall (it is about 390 px today), so 12 photos scroll about a quarter less.

| Part | Spec |
|---|---|
| Card | `--shadow-card`, `--radius-lg`, padding `--space-3` |
| Header row | Grip (44 px) then thumbnail (`--photo-thumb-size`, 72 px, `contain`) then the title "Photo 3" (`--text-md`, 600) and the status line (`--text-sm`: Ready with a check, Uploading 62%, Preparing, or the failure). The file name stays in the DOM but is visually hidden under 640 px |
| Upload | A determinate 8 px bar directly under the header row while uploading |
| Caption | Label "Caption (optional)", textarea of **2 rows** (it grows as the Creator types, up to 6 rows, then scrolls), helper on the left and the counter on the right of one line, wrapping if it must |
| Actions | One row of 44 px buttons, 8 px gaps (also between wrapped rows): **Earlier** and **Later** as icon-only buttons under 480 px (their accessible names keep "Earlier" and "Later" plus the photo number, exactly as now; from 480 px the word shows), **Replace** and **Remove** as icon plus text. Earlier is absent on the first row and Later on the last. Remove still asks inline |
| Failed | A 4 px danger bar, the reason in the status line, Retry (primary, 44 px) in place of the actions' first slot when retryable |
| Desktop | The three-column grid of 5.4 stays; rows use the same layout inside each card |

#### 12.5.2 Step 2: Words

Order and grouping change; every field, label, id and limit is unchanged.

| Order | Section | Fields |
|---|---|---|
| 1 | **The names** with tag **Required** (card with a 4 px `--color-accent` bar on its left and a faint `--color-accent-wash` fill) | "Who is this museum for?" and "Your name". Both keep "(required)" in the label |
| 2 | **How it will look** (the live sample, unchanged content) | Shows the title, "For {name}" and both name labels as typed, so the Creator sees the result of the names at once |
| 3 | **Make it yours** with tag **Optional** (plain card, no bar, visually quieter) | "Museum title (optional)" and "Closing message (optional)" |

- Defaults shown, not stored (FR-86): the title field's **placeholder** is "A museum for {name}" and updates as the Visitor name is typed; the closing message's placeholder is "For example: Thanks for coming. I hope it made you smile." Placeholders never replace labels; their colour is `--color-text-muted` (6.0:1 on a card). The draft format is unchanged; blank still means the default.
- The purpose line says what is required: "Two names are all you need. The rest is optional."
- Validation: 12.4.5.

#### 12.5.3 Step 3: Characters, with the new options (FR-96 to FR-102)

**Layout.** Preview, then the character switch, then the appearance tabs, then groups. The data model adds three optional choices per character (face shape, six more clothing styles, pattern), each defaulting to today's look. **All of them live in a "More options" group; with it closed the step shows exactly the controls it shows today (FR-102).**

| Part | Phone portrait and tablet | Phone landscape | Desktop (1024 px and up) |
|---|---|---|---|
| Preview | **Sticky** at the top of the step (`position: sticky; top: var(--safe-top); z-index: var(--z-sticky)`), height `--preview-sticky-height` (176 to 256 px, 32 dvh), full width, radius `--radius-lg`, stage backdrop (12.8.4). The stepper and the "Still to do" list scroll away above it; the options scroll under it | Left 45%, sticky, full height minus the compact bar | Left column, sticky (as today) |
| Preview controls | Turn left, Turn right and Back view become **icon-only 44 px night buttons** over the preview's **top-right** corner, 8 px gaps. Their accessible names are unchanged. *Decision, 02/11/2026 (tech lead, matches the build): top-right, not bottom-right. The name labels run along the preview's bottom edge and the buttons covered one* | Same | The existing tertiary buttons under the preview |
| Character switch | Two segmented tabs "Guide: {name}" and "Visitor: {name}" (names unchanged), then a muted line: "The Guide is you. The Visitor is who you're making this for." | Same | Same |
| Section tabs | Body, Face, Hair, Outfit as four equal segments (44 px, 8 px gap) | Same | Same |
| Description | The live text description under the section tabs (not in the sticky area) | Same | Under the preview |

**Preview un-sticks when tall (as built, v2.0.2, BUG-17).** In the single-column layout (phone portrait and tablet) the preview stops being sticky and scrolls with the page when it is taller than half the window, for example at 200% text on a short screen, where it would otherwise cover the option tabs. Desktop and phone landscape are not affected. At normal text on 360 by 640 the preview stays sticky.

Purpose line: "Both characters already have a starting look. Change as much or as little as you like." The step is marked **Optional** as a whole (a tag by the h1's purpose line: "Optional: everything here has a starting look"). Reset keeps its place.

**Where the groups sit.** "Closed" is exactly today's content. Every group inside More options is labelled "(optional)" in text (FR-86, like Gender) and starts on its default.

| Tab | Visible with More options closed (unchanged, same DOM, same tiles) | Inside **More options** (new) |
|---|---|---|
| Body | Gender (optional), Body type, Height | none (no disclosure on this tab) |
| Face | Skin tone, Facial hair | **Face shape (optional)** |
| Hair | Hair style, Hair colour | none |
| Outfit | Outfit style (today's six tiles, text only), Outfit colour | **More styles (optional)** (the six new styles), **Pattern (optional)** |

Why this split: today's controls, their order, their tiles and their accessible names stay where tests and habits expect them. A new radio never duplicates an existing name. The clothing style is **one value** (`outfitStyle`) shown in two radiogroups: "Outfit style" (six tiles) and "More styles" (six tiles). Exactly one tile is selected across the two; choosing in one deselects the other. If the saved style is one of the six new ones, More options opens by itself so the choice is visible.

**Making the step feel no longer (FR-102).**
- **The disclosure shares the Reset row.** Today the last row is the Reset button (44 px, then the stack gap). The closed disclosure button and Reset sit in **one** row of the same height, so a tab with More options is exactly as tall as today. Body and Hair keep the Reset row alone, as now.
- **Measure.** The strict check: the options panel (everything under the section tabs) is no taller closed than today at 360 by 640 and 390 by 844, on every tab. The whole-step height is also checked and is expected to be no taller: the sticky preview is 32 dvh against today's 42 dvh (about 64 px shorter at 640, 98 px at 844) and the turn buttons leave the flow (about 52 px), which pays for the purpose line (about 48 px), the character line (24 px) and the "Still to do" block (24 px when ready, about 68 px with a row of chips). If the whole-step check fails, shorten the purpose line to one line first.
- The preview stays in view (sticky), so the Creator never scrolls up to check a change inside More options.

**Footer row and the More options disclosure (new component `MoreOptions`).**

| Part | Spec |
|---|---|
| Row | One flex row, `justify-content: space-between`, 8 px gap, 44 px tall: the **More options** button on the left, **Reset** (tertiary, as today) on the right. With no disclosure on the tab, Reset sits alone at the left as today. Under 480 px Reset's visible text is "Reset" (the accessible name stays "Reset Guide to the starting look" or "...Visitor...", which contains the visible word) so both fit in 336 px |
| Button | 44 px tall (`--touch-target`), `--radius-md`, `--color-surface-sunken` fill, `--border-control` `--color-border-strong`, label "More options" (600), a chevron that turns 180 degrees in `--duration-fast` (instant under reduced motion). When any group inside is off its default a small count chip follows the label ("1", accent tint, with the visually hidden text " changed"), so a changed value is never hidden |
| Content | Opens **under the row**, in the order of the table above, groups separated by `--space-4`, in the page flow (no inner scrolling). Closing hides it; choices are kept |
| Semantics | `aria-expanded`, `aria-controls` the content. Hidden content is `hidden` so it leaves the tab order and the accessibility tree |
| Escape (as built, v2.0.2, BUG-13) | While open, Escape pressed on the button or inside the panel closes the group and returns focus to the button. The key event is stopped (default prevented, propagation stopped), so a parent dialog does not also close. Choices are kept |
| State | Open state is kept per character role and tab, in memory only (not in the draft). New draft: closed |
| Open on load | Opens when any value inside is not its default (including a saved new clothing style) |
| Keyboard and touch | Enter and Space toggle; focus stays on the button; the button is a 44 px target |
| Reset | Resets everything for the active character, including the new options, to the starting look (9.3 plus Oval and Plain), and closes nothing |

**Face shape picker.**

| Part | Spec |
|---|---|
| Group | `role="radiogroup"`, label "Face shape (optional)", helper "Changes the shape of the face. Your other choices stay as they are." (`--text-sm`, muted). Inside More options on the Face tab |
| Tiles | Five tiles in one row: `grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr))`, gap `--space-2`, minimum height `--option-tile-tall` (72 px). A 32 px pictogram (`--option-thumb-size`, a plain head outline in `currentColor`, one shape per option: oval, round, square, heart, long) above the label (Oval, Round, Square, Heart, Long, `--text-sm`). At 360 px five tiles are about 56 px wide in one row; at larger text they wrap to three and two. Selected: tint, `--border-selected` accent ring and a check (5.3). Roving tabindex, arrow keys, as every radiogroup |
| Neutrality | The pictograms are bare outlines with no hair, features or expression. Every shape is offered to every gender, and nothing is pre-selected by gender |

**Clothing style: twelve in all (Q-30), six visible and six in More options.**
- **"Outfit style" (visible, unchanged):** today's six text tiles (T-shirt and jeans, Hoodie, Shirt and trousers, Dress, Suit, Jumpsuit), no pictograms and no size change, because a taller tile or an extra wrapped row would make the closed step taller (FR-102).
- **"More styles (optional)" (in More options):** the six new styles as a grid of pictogram tiles. `grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr))`, gap `--space-2`: **two columns at 360 px** (about 164 px each), three rows, about 160 px tall in all. Each tile is 48 px tall (`--tile-height`), with a 24 px garment pictogram (`--option-thumb-size` scaled to 24) at the left and the label at its right, centred as a pair. At 200% text the tiles wrap their label (never clip) and stay one column wide at 320 px. Selected: tint, `--border-selected` accent ring, check (5.3). Roving tabindex and arrow keys as every radiogroup.
- **Pictograms** sit on one shared neutral torso outline (no bust, no waist cue) and are drawn in the **current outfit colour** (`fill: var(--swatch)`), so the choice previews the colour too. The text label is always visible and is the accessible name. No pictogram is tied to a gender.
- Order in "More styles": Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic (concepts and silhouettes in 12.8.2 G).
- If the user and product manager later accept moving all twelve into More options (and the tests are updated), show one pictogram grid of twelve (three columns from 480 px); nothing else in this section changes.

**Pattern picker (inside the disclosure).**

| Part | Spec |
|---|---|
| Group | `role="radiogroup"`, label "Pattern (optional)", helper "Adds a pattern in tints of your colour. There is no second colour to pick." |
| Tiles | Four tiles in one row (`repeat(4, 1fr)`, 8 px gap), minimum height `--option-tile-tall`. Each carries a **fabric swatch** 32 px square (radius `--radius-sm`, `--color-border-strong` hairline) above its label (Plain, Stripes, Checks, Dots). The swatch is pure CSS in the current outfit colour and its derived second colour (12.8.2): Plain a flat fill, Stripes `repeating-linear-gradient` bands, Checks two crossed gradients, Dots a `radial-gradient` grid. No images |
| Disabled | Never. For outfit styles where the main garment is small the pattern still applies to it |

**Preview behaviour (FR-15, live update).**

| Change | Behaviour |
|---|---|
| Any choice | The preview updates within 1 s (it should be near-instant); no Apply button; saved to the draft at once |
| Face shape | The active character's head shape morphs over `--duration-gender-morph` (250 ms, `--ease-standard`, instant under reduced motion), the same mechanism as gender (9.5): shape parameters interpolate, hair and facial hair follow the head because they are built on the same head warp. Retargets on rapid changes with no queue. Nothing else moves; the name label does not move (12.8.2) |
| Pattern | The pattern amount cross-fades from the old value to the new over `--duration-fast`, as a material uniform, with no geometry rebuild. Instant under reduced motion |
| Outfit style (any of the twelve) or colour | As today (rebuild or colour change); the pattern is kept. A style rebuild shows no unclothed or empty frame (9.5) |
| Face tab opened | The preview frames the **active character's head and shoulders** over `--duration-camera` (450 ms, `--ease-standard`; a cut under reduced motion), so a small sticky preview still shows the face shape. The other tabs return to the two-character framing. If the Creator has turned the preview with Back view, the framing keeps that yaw. Should; Turn buttons are the fallback |
| Description | The text description (9.4) gains "round face" and "striped" words when not default; announced only for the character that changed |

**Phone targets.** Every tile, swatch cell, tab and the More options button is at least 44 by 44 px with 8 px between neighbours (FR-81): swatch cells become 48 px (`--tile-height`) with a 40 px visible swatch and `--space-2` gaps, six to a row at 360 px.

#### 12.5.4 Step 4: Review and publish

| Part | Spec |
|---|---|
| Purpose line | "Check everything, then publish. You can preview first." |
| Cards | Three summary cards, each: h2 left, **Edit** tertiary (44 px) right; the card's content is one short block. Your museum (title, For, Guide, closing message), Photos (all thumbnails in a grid of `minmax(3.5rem, 1fr)`, so about five per row at 360 px, never truncated), Characters (the two descriptions) |
| Consent | Its own card with the tag **Required**. The checkbox is 28 px inside a 48 px-tall row; the full sentence is the label; links on their own line (44 px targets). Error state: a danger bar, an icon and the message |
| Actions | Preview (secondary; the only visible Preview on this step from 640 px, the header one is hidden, 12.4.1) and **Publish museum** (primary, 56 px) in one row from 640 px, stacked on phones with Publish last and full width. **Under 640 px the in-content Preview is `display: none`** (the bar has it, 12.4.4); Publish stays in the content, at the bottom of the page where the Creator has just ticked consent. Reason line for an unavailable Publish stays under the button |
| After a failed publish | The danger alert (with the accent bar) above the actions; button reads "Try again" |

#### 12.5.5 Published screen

A brass seal icon (48 px) and the h1 "Your museum is ready". Share link card first, with **Copy link** as the one primary (hierarchy table). The edit link card beneath, using the warning alert (accent bar `--color-warning-border`), **Copy edit link** secondary, then the acknowledgement. **Finish** is secondary and unavailable until the box is ticked, and becomes the primary then. Cards use `--shadow-card`; all targets 44 px or more with 8 px gaps.

### 12.6 The visit: HUD, welcome, cards, notices

Polish only. Nothing here changes a position that the caption dock, the framing safe rectangles (6.12.2) or the label rules depend on, except where stated.

#### 12.6.1 Top bar

| Part | Spec |
|---|---|
| Trays | Each `.hud__cluster` becomes a **tray**: one glass pill (`--color-hud`, 14 px blur, `--shadow-glass`, 1 px ring of `--color-on-night` at 18%, `--radius-pill`) that holds its buttons. The buttons inside lose their own fill, ring, shadow and backdrop filter (one blur per tray, not per button; three blur layers instead of five). They stay 44 by 44 px, **8 px apart** (`--target-gap`) with a 1 px by 24 px `--color-divider-night` rule centred in each gap. Hover or pressed: a `--color-night-raised` disc behind the icon. Left tray: Pictures, Where next?. Right tray: Settings, Help, and Reset view when shown (it joins as the middle item, as now) |
| Labels | "Pictures" and "Where next?" show their words from **480 px** (was 400), so the 8 px gaps hold at 360 to 479 px. At 359 px and narrower the gaps may fall to 4 px (the 320 px reflow case only) |
| Progress pill | 36 px tall (not interactive), `--color-hud`, `--shadow-glass`. A 16 px progress ring before the text: `conic-gradient(var(--color-brass) calc(var(--p) * 1%), var(--color-track-night) 0)` with a 5 px hole (radial mask); the frontend sets `--p` to viewed divided by total times 100. Text "5 of 12", `--text-sm`, 600. The ring is `aria-hidden`; the visually hidden "5 of 12 pictures viewed" stays |
| Fit at 360 px | Left tray 96, right tray 96 (148 with Reset), pill up to 84, two 8 px gaps, margins 2 by 12: 96 + 84 + 148 + 16 = 344 of 336 available only if the pill is 84 px **and** Reset is showing. So the pill drops its ring below 400 px when Reset is showing (text only, 72 px) |
| Preview mode | The preview bar (7.11) stays at the top; its Exit button is a once-only action |

#### 12.6.2 Controls and hints

| Part | Spec |
|---|---|
| Joystick | Same size, position and hit area on phones in portrait (128 px base, 56 px knob, 176 px hit). Restyle: base `--color-hud` plus a soft radial highlight at the top left; four small chevrons (CSS triangles, `--color-on-night-muted` at 70%) replace the N, E, S, W letters; knob `--color-on-night` at 92% with a 3 px inset `--color-brass` ring and `--shadow-glass`; held: base opacity 100%, knob scale 1.06 in `--duration-fast` (none under reduced motion) |
| Compact joystick (Could) | On phone landscape the hit area is 45% of the screen height, so the tokens `--joystick-size-compact` (112), `-knob-compact` (48), `-hit-compact` (152) and `-travel-compact` (40) are available. The frontend may switch to them there; the joystick maths reads the sizes from CSS |
| Arrow pad | Same layout; buttons restyled like the tray buttons (glass, 56 px, 8 px gaps) |
| Hint chips | `--radius-lg`, glass, `--text-sm`, 20 px icon, max 30 rem, enter with the overlay fade and rise (12.2). The first-use "Drag to walk" and "Drag here to look around" chips keep their wording and timing (6.1) |

#### 12.6.3 Welcome (FR-80 spirit, 7.2)

| Part | Spec |
|---|---|
| Background | `--gradient-page` (a warm glow behind the card) |
| Card | `.welcome__card` keeps its structure, `--radius-xl`, `--shadow-raised`, the brass hairline inset 8 px, padding `--space-8` `--space-6`. A 40 px frame mark above the eyebrow |
| Type | Eyebrow `--text-xs`; title `--text-display` with `--tracking-display`; "For {name}" `--text-2xl` in accent; guide line `--text-md` muted |
| Start | Primary, 56 px, min width 12 rem, focused on load as now. Waiting state unchanged |
| Entrance | Card fades and rises by `--rise-distance` in `--duration-overlay`; lines inside stagger by `--duration-stagger`. Under reduced motion it simply appears. Leaving still cross-fades in `--duration-slow` (2.2) |
| Phone landscape | A two-column card: title block on the left, Start and Privacy on the right; padding `--space-4` `--space-6`; the frame mark is hidden. The whole card fits 390 px tall without scrolling for a title up to 40 characters |
| Worst case | A 60-character title and 24-character names at 360 by 640 scroll inside the screen (`overflow: auto`), with Start reachable by scrolling and never clipped |

#### 12.6.4 Caption card: visual finish only

Allowed (they change no measured box): surface and shadow tokens (`--color-surface`, `--shadow-panel`, brass hairline); the badge gets a brass ring drawn with `box-shadow` (`0 0 0 2px var(--color-surface), 0 0 0 3.5px var(--color-brass)`, which takes no layout space); the divider under the header becomes a 1 px gradient hairline (transparent, `--color-border`, transparent) of the same height; thin scroll shadows at the clipped edge of the Full and Fitted bodies (8 px, `--radius-sm` fade, not on a strip); tint on hover of Look closer, Read more and Close; `text-wrap: pretty` on the caption.

**Not allowed:** any change to padding, gaps, heights, min-widths, header height, container-query breakpoints, header or strip font sizes, the strip heights and line count, the placement order, the upgrade rule, data attributes (`data-dock`, `data-card-size`, `data-expanded`), or the DOM element. One check to run: the header gaps between Look closer or Read more and Close must be at least 8 px (FR-81). The CSS already uses `--space-2` (8) in strips; the 4 px in the 5.6 width sum was a spec figure only. QA re-runs S4 at 256 px.

#### 12.6.5 Finale card

Same shell as 5.7 with: a 40 px brass seal (radial brass gradient, heart icon in `--color-text`), the heading `--text-xl` Fraunces, a hairline brass rule with a small diamond ornament under the header, the message in `--caption-size` Fraunces, and footer buttons **Keep exploring** (primary, 56 px) and **Replay from the start** (secondary, 48 px, 8 px gap), stacked and full width under 480 px, side by side from 480 px. Placement, focus on Keep exploring, Escape and the reading sheet are unchanged.

*Decision, 02/11/2026 (tech lead): in the 136 px finale strip (`FINALE_STRIP_HEIGHT`) the footer stays on one row at every width.* **Superseded 10/11/2026 by the as-built note below (BUG-14).**

**As built, v2.0.2 (tech-lead decision after QA round 6, BUG-14): the footer and the closing message never clip.**
- **The card may grow.** It may be taller than its placement height (the strip or fitted height from 3.5), up to **90% of the screen height**; past that its body scrolls inside the card, and the header and footer stay visible. The placement function in 3.5 is unchanged: only the finale card's height is allowed to exceed it.
- **Growth direction.** Bottom-docked cards (`bottom`, `bottom-centre`) are anchored by their bottom edge and grow upwards. Others keep their top edge and grow downwards.
- **Width.** The card's minimum width is capped at its placement width, so the 16 rem floor cannot push a card past the screen edge at 200% text.
- **Footer.** Buttons are at least 48 px tall with an 8 px gap, and labels do not wrap while side by side. **Under a 22 rem card width** (320 px, or 360 px at 200% text) the buttons stack full width, and a label may wrap there. At 360x640 and 390x844 at normal text the footer keeps the **side-by-side row**. This replaces the "stacked under 480 px, side by side from 480 px" rule in the first paragraph above: the switch is now by card width (22 rem), not viewport width.
- **Trade-off.** A grown card covers more of the scene than the 136 px strip. This is accepted so the closing message and both buttons are always readable; the finale has no picture to protect and the Visitor can press Keep exploring to dismiss it. The 3.5 rule that a card must not cover the Visitor or the picture is not enforced for the finale's extra height.

#### 12.6.6 Overlays and sheets

Pictures, Settings and Help sheets: radius `--radius-lg`, `--shadow-panel`, brass hairline, scrim `--color-scrim`. Phone portrait max height `--sheet-max-height-phone` (60 dvh, was 70), so the sheet's Close sits at or below 40% of the screen. Enter in `--duration-overlay` (slide up), leave in `--duration-fast`. Rows keep 56 px and 8 px gaps. The photo viewer is unchanged in layout (its Close is at the top, and a tap on the dark background closes it when not zoomed, which is the reachable path).

#### 12.6.7 Notices

| Notice | Finish |
|---|---|
| Hint chip | 12.6.2 |
| Retry chip ("Photo 3 did not load. Retry") | Glass chip, text left and Retry (night-primary, 44 px) right from 400 px; stacked under 400 px with Retry full width |
| Offline bar | `--color-warning-tint`, warning icon, `--text-sm` 600, sticky at the top, 8 px padding, accent bar not needed |
| In-app browser, restored-draft and builder alerts | The alert pattern (12.1): tint, icon, **4 px state bar**, `--radius-md`. The restored-draft notice keeps its 5.17 text, placement and rules, and gains an info bar in `--color-accent` |
| Toasts, dialogs | As 5.14, with the overlay motion in 12.2 |

#### 12.6.8 Name labels on narrow screens (QA N-10)

A 24-character Guide name on a 360 px portrait screen is clipped at the left edge and the two labels overlap. Labels may not be truncated (FR-17), so the fix is placement. Add rule 7 to 5.5, applied **last**, after the BUG-10 rule:

1. **Clamp into the viewport.** The label's left and right edges stay at least 8 px inside the viewport (after safe areas). A label never sits half off the screen while its character's head anchor is on screen.
2. **De-overlap sideways.** If the clamped labels still overlap, push them apart horizontally by half the overlap each (then re-clamp). The maximum label width is `min(11rem, 44vw)` (158 px at 360), so two labels plus an 8 px gap need 324 px: they always fit at 360 px and this always resolves. Never scale, never truncate, never move up (the BUG-10 strip rule forbids it).
3. **Hidden only when the head is off-screen.** If the head anchor projects outside the viewport horizontally, the label is hidden as in 5.5 (the character is off-screen). A partly visible body keeps its label.
4. **Precedence if rules conflict:** never over the picture, then inside the viewport, then no overlap between labels, then centred on the head. If the picture rule and the viewport rule cannot both hold, keep the picture clear and allow up to 40% of the label width to go past the edge (rare).
5. **Solver input.** In the presentation framing (6.12.4) a label's horizontal extent counts as `min(label width, body width + 32 px)` around the head, because rules 1 and 2 move it sideways anyway. Today the full 158 px width makes the solver drop the Guide from the fit set, which is the cause of the off-screen Guide in N-10. Owner: scene-developer. QA: 360 by 640 and 390 by 844 with 24-character names for both characters: both labels fully inside the viewport, no overlap, the picture still clear.

**As built, v2.0.2 (BUG-15, scene-developer).** These override the figures above where they differ.
- **Width.** In the scene the label's maximum width is `min(var(--label-max-width), 36vw)` (was 44vw), about 130 px at 360. It only differs under about 489 px wide, so landscape and desktop are unchanged. The narrower label leaves room beside the picture, so the 40% edge overhang in rule 4 no longer triggers for two 24-character names. The `.name-label` CSS cap in the visit stylesheet matches.
- **Stack when still overlapping.** After rules 1 to 4, if the two visible labels still overlap, the lower one drops **4 px below** the upper one. Labels never move up, so the caption-strip rule (5.5) holds. This is a last step and does not change the picture rule. It replaces "this always resolves" in rule 2 as the fallback.
- **Result.** The 360x640 picture 1 residual (the accepted case) no longer occurs.
- **Builder.** In the preview fallback and the Words step sample the label keeps the **full row width** (`min(var(--label-max-width), 100%)`), so long names look as before there. The 36vw cap is for the scene only.

### 12.7 Mobile: guard rails, not a redesign (FR-81 to FR-84)

The user reports that phones are not hard to use. FR-81 and FR-83 (Must) stay as guard rails; FR-82 is now Could and FR-84 Should (requirements v0.5), and existing behaviour must not regress. The layout, the caption dock and the controls keep their places. Only the small, additive changes below were made, and each can be dropped without affecting anything else (the Done and Carry on buttons first, then the phone Preview button).

| Item | Rule |
|---|---|
| Reach (FR-82), builder | **Preview** joins the phone action bar (12.4.4); Back and Next were already there; Publish is at the bottom of its page |
| Reach (FR-82), caption card | A small **Done** button, bottom-right, 48 px tall, glass pill, check icon and "Done" (accessible name "Done with this photo"), shown only on phone portrait while a caption card is open **and** its dock is the top. It runs the same action as Close, takes no focus, adds no announcement, and sits on the side opposite the joystick or arrow pad. It is part of the dock's `keepOut` so no placement lands under it. It does not change a single 3.5 behaviour: placement order, strips, upgrade rule and sizes are untouched. Its name differs from "Close", so tests that look for the card's Close are unaffected |
| Reach (FR-82), finale | The same bottom-right button reads **Carry on** (accessible name "Carry on exploring") and runs Keep exploring. Phone portrait only, while the finale card is open |
| Reach (FR-82), sheets | 60 dvh cap (12.6.6). Photo viewer: tap the dark background (exists) |
| Targets (FR-81) | 44 px minimum everywhere, 48 px for builder bar buttons and tiles, 56 px for calls to action; **8 px between adjacent targets** at 360 px. Fixes found in the audit: tabs gap 4 to 8; preview controls 4 to 8; photo actions row gap 4 to 8; swatch cells 52 to 48 with an 8 px gap; link lists in alerts get 8 px between items |
| Text (FR-83) | Body, input and caption text 16 px or more; helper, label and secondary 14 px or more (`--text-xs` now 14 px); nothing under 12 px (`--text-micro`, decorative only). Name labels stay 15 px |
| 200% text and reflow | Everything is `rem`-based. The bar, tiles and chips use `min-height`, never `height`. The stepper switches to a 2 by 2 grid by container query. No horizontal scrolling at 320 px; QA checks the builder, welcome and overlays at 200% |
| Safe areas (FR-84) | Unchanged: `.ui-layer` padding, the bar's bottom padding, `viewport-fit=cover`. New elements (Done, the sticky preview, the bar) add the same insets |
| Keyboard (FR-84) | 12.4.4 |
| Browser bars (FR-84) | `dvh` everywhere; sticky rather than fixed bars in the builder |

**Checks at the three phone viewports.**

| Viewport | What to look at |
|---|---|
| 360 by 640 | Landing: Create button bottom edge at or above y 560. Builder: bar 72 px plus the safe area, Back, Preview and Next in one row (each at least 48 px tall and 44 px wide, 8 px apart); sticky preview 205 px (32 dvh) with at least 360 px left for options; photo row at most 300 px tall; stepper four across with labels. HUD: trays, pill and (with Reset) no overlap. Face tab: five shape tiles in one row of about 56 px |
| 390 by 844 | Sticky preview 256 px (capped at 16 rem); lower 60% starts at y 338, which holds the bar, the Done button and the joystick; welcome card fits without scrolling for a 30-character title |
| 844 by 390 | No lower-60% rule (landscape). Builder bar compact (56 px), preview left 45% full height, options right; welcome card two columns; HUD labels shown; caption card unchanged in the right dock; compact joystick optional |

### 12.8 Art direction for the technical-artist (FR-89 to FR-93)

**Principle.** Keep the identity (linen, oak, claret, brass, designer-toy figures). Finish it: more definition where the eye looks (faces, edges, pictures), more depth in the room, nothing flashy. Everything below is a vertex colour, a parameter, a small shader patch or a decal. **No post-processing, no new library, no new texture above 128 by 128, no new geometry except the catchlights.**

**Budgets (NFR-27, NFR-28).**

| Budget | Now | CR-4 limit |
|---|---|---|
| Triangles per character | 5,878 worst | At most **60 added** (the two catchlights); hard stop 5,950. Face shape, pattern, contour, region trims and the animation add none. If something needs more, trade it against hand or shoe segments, and report |
| Draw calls per character | 3 | 3 (no new mesh) |
| Scene draw calls | 35 to 40 steady, up to 59 at a photo cross-fade | At most **4 more** (merged decals: frame contact shadows, edge shadows, dado rails, ceiling strips), still far under 120 |
| three.js chunk | 970.7 kB | Guard **985 kB**. The shader patches are about 3 kB minified; import no new three class |
| Frame rate | NFR-1: 60 FPS laptop, 30 FPS reference phone on Low | Re-measured with the performance.md method; the Low tier still holds 30 FPS (NFR-28) |
| Textures | Oak, finale floor, linen, runner (procedural) | Planks and runner border go into the existing textures; no new textures |

#### 12.8.1 What should read more clearly (the brief in one table)

| Area | Problem | Fix |
|---|---|---|
| Silhouette against the floor and walls | Flat colour blocks blur into the floor and wall at 150 to 200 px tall | Dual-band edge (12.8.2 A) |
| Regions | Hair, head, sleeves, hands, top and bottom run together when colours are close | Region trims and ambient darkening (B) |
| Face | Features are 1 to 3 px at the default camera; brows on deep skin are a faint grey line; blush looks purple on deep skin | Bigger eyes with catchlights, thicker brows, a 3:1 brow floor with warm lift, deep-skin blush (C) |
| Choice | Characters feel alike | Face shape and pattern (D, E) |
| Life | Idle looks frozen, stride is small | Animation (F) |

#### 12.8.2 Characters

**A. Dual-band edge (FR-89, the main change).** A screen-space band of constant pixel width on every silhouette, in the body and hair materials (`onBeforeCompile` patch of the existing vertex-colour Lambert; no extra pass, no extra mesh, no geometry).

- Idea: a light rim on the outermost fraction of a pixel and a dark contour just inside it. On a light backdrop (linen wall, stage) the dark contour is the edge; on a dark backdrop (runner, finale wall and floor) the light rim is the edge. One treatment holds for every backdrop and every camera direction, so nothing needs to know the room.
- Pseudocode: `ndv = clamp(dot(normal, viewDir), 0, 1)`; `d = ndv / max(fwidth(ndv), 1e-4)` (about the distance in pixels from the silhouette); `w1 = rimPx * pixelRatio`; `w2 = contourPx * pixelRatio`; `rim = (1 - smoothstep(0.6 * w1, w1, d)) * rimMax`; `con = smoothstep(0.6 * w1, w1, d) * (1 - smoothstep(0.7 * w2, w2, d)) * contourMax`; then `colour = mix(colour, contourColour, con)` and `colour = mix(colour, rimColour, rim)`. Constants are the tokens `--look-rim-px` (0.6), `--look-contour-px` (1.5), `--look-rim-max` (0.85), `--look-contour-max` (1.0), `--look-rim` and `--look-contour`. Apply before tone mapping. **As built (v2.0.3, BUG-18):** the body band is wider (rim 1.2 times, contour 2 times, so about 3 px at the outer limit), the shader applies the rim colour at 0.7 strength and the contour colour at 0.25 strength, and the two maxima above are the effective values (they were 0.6 and 0.95). The arithmetic in the next bullet is the v2.0 paper figure; the measured figures are in the technical-artist handoff.
- Because the band is measured in pixels, thin limbs get the same 1.5 px edge as the torso, and the band stays a fine line on the larger builder preview.
- Fallback without derivatives (WebGL 1): use the fresnel term alone with the same constants (the band then widens on rounder parts). Do not ship a WebGL 1 path unless the renderer needs it.
- Edges on open shells (dress hem, hair curtains, the cut edge of a collar) have no silhouette fresnel: they get the trim in B instead.
- Applies identically to the Guide and the Visitor, in the visit, the preview and the Visitor preview (FR-74).
- **Contrast arithmetic (calculated by hand; the technical-artist measures).** Contour colour `--look-contour` has relative luminance 0.012. At strength 0.95 the contour pixel's luminance is 0.05 times the region's plus 0.011: 0.054 for the lightest region (cream outfit, white hair, skin-01, about 0.86). Against oak (0.29) that is 3.3:1; against the linen wall (0.69) 5.4:1; against the stage (0.73 to 0.88) 5.8:1 or better. Rim colour `--look-rim` has luminance about 0.79; at 0.6 the rim pixel is at least 0.49 even for the darkest region, against the runner (0.065) 4.8:1, the finale wall (0.036) 6.3:1, the finale floor (0.017) 8.1:1. All pass 3:1 on paper.

**B. Region separation (FR-90), vertex colour only, zero triangles.**

| Region boundary | Treatment |
|---|---|
| Hair against head | Darken the skin 8% in a 10 mm band under the hairline and fringe; lighten the hair crown by 10% (clamped) and darken the hair under-surface and nape by 15%. Hair keeps volume; the exaggeration in 9.6 stays |
| Neck against head | Neck and the skin just under the jaw 10% darker (a soft chin shadow). Ears 4% darker (existing) |
| Hands against sleeves | The last 10 mm ring of each sleeve (cuff) is trimmed 12% darker if the sleeve is light (luminance over 0.3) and 25% lighter if dark. Hands stay skin |
| Top against bottom | At the waist, the top's hem ring is trimmed the same way. **Separation rule:** if the contrast ratio between the top colour and the fixed bottom (`--avatar-denim`, `--avatar-trousers`, `--avatar-joggers`) is under `--look-separation-threshold` (1.3), the trim is doubled and the bottom's top edge goes 10% lighter if dark. Charcoal on trousers and navy on denim are the cases to check |
| Collar, placket, hood | A trim ring at the collar and a centre placket line on shirt, suit and hoodie (the same trim colour rule) |
| Shoes | Soles stay cream. Add a 10 mm 15%-darker band where the shoe meets the trouser |
| Armpit, crotch, behind knees | Ambient darkening 10% on the existing rings, so limbs read as separate from the torso |
| Badge and sticker | Keep. Add a darker rim ring on the Guide's badge (`--scene-brass-deep`) and make the badge at least 55 mm across |

**C. Face (FR-90).**

| Feature | Change |
|---|---|
| Eyes | Radii times `--look-eye-scale` (1.1) on top of the gender eye multiplier (the ordering Woman larger than Neutral larger than Man stays). Deep skins (skin-08 to 10) keep the eye whites |
| Catchlights | One tiny highlight (`--look-catchlight`, radius about 4 mm, a 6-segment disc of 20 triangles or fewer) on the upper outer part of each eye, 40 triangles for both. Visible in the preview and presentations, harmless at 120 px |
| Brows | Half-height times `--look-brow-thickness` (1.45), so Neutral is about 19 mm tall (about 1.4 px at 120 px, was 0.9). Keep Woman 0.90 and Man 1.15 on top, so the ordering holds (17, 19, 22 mm). A slight outward lift of 0.12 rad |
| Brow colour | Minimum contrast with the skin `--look-brow-contrast` (3, was 2). Lighten **toward `--look-brow-lift`** (a warm tan) instead of toward white, so black brows on skin-10 become a warm brown (about `#8c674f`, 3.0:1) rather than a faint grey. Hair colour is kept whenever it already reaches 3:1 |
| Mouth | Smile tube radius times `--look-mouth-thickness` (1.22) and an arc of 0.7 pi; colour rule unchanged (dark rose on light skin, light rose on deep) |
| Nose | Unchanged (a bump in 8% darker skin) |
| Blush | `--avatar-skin-blush` on skin-01 to 07; **`--avatar-skin-blush-deep`** (terracotta, not purple-pink) on skin-08 to 10 |
| Facial hair | Colour moved only as needed to reach 1.6:1 against the skin (the brow rule with a lower floor), so a white beard on skin-01 does not vanish. Its silhouette also gets the edge band (hair material) |

**D. Face shape (new option, FR-90 and user feedback).** Five shapes of the same head mesh: no new geometry. One warp function applies to every part skinned to `head` (as the jaw warp does in CR-1), so the hair, ears and facial hair follow the head and cannot float or clip. Features are placed on the unwarped head and carried by the warp.

| Shape | Width | Height | Jaw (lower width) | Upper width (above the equator) | Chin length |
|---|---|---|---|---|---|
| Oval (default) | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Round | 1.05 | 0.97 | 1.04 | 1.00 | 0.94 |
| Square | 1.02 | 0.99 | 1.12 | 1.00 | 0.97 |
| Heart | 1.00 | 1.00 | 0.84 | 1.05 | 1.08 |
| Long | 0.95 | 1.06 | 0.96 | 1.00 | 1.06 |

- Oval is exactly today's head, so museums with no value look as they do after the other CR-4 changes (NFR-29).
- Multipliers combine with the gender jaw and brow multipliers (9.1) by multiplication. The combined jaw stays between 0.78 and 1.20. The technical-artist may tune each number by up to 0.03; the ordering and the Oval baseline are fixed.
- **The name label never moves between shapes.** Anchor the label at the height of the tallest shape (Long), not the current one. Head top varies by at most 10 mm beyond today's. The framing solver and the camera see no change in character height.
- Morph in the preview: the same mechanism as gender (`beginGenderMorph` generalised to a shape morph, 250 ms, `--duration-gender-morph`, instant under reduced motion). The visit builds the final shape once.
- At the default visit camera the head is about 22 px, so a 5% width change is about 1 px: face shape reads in the builder preview (Face tab zoom) and in presentations, not necessarily at 120 px. That is expected, and FR-90's feature checks do not depend on it.
- Checks: 5 shapes by 12 hair styles by 3 genders for hair fit; by 5 facial hair styles for jaw attachment; Neutral, Woman and Man silhouettes still 10% or more apart; the budget (zero added triangles).

**E. Clothing pattern (new option).** Plain, Stripes, Checks, Dots on the garment that carries the outfit colour. A shader feature of the body material; no geometry, no texture.

- A per-vertex garment mask (0 for skin, shoes, badge, fixed garments; 1 for the outfit-colour garment) is written by the garment builders. One float per vertex, no new triangles.
- The pattern coordinate is the **bind-pose position** (the `position` attribute before skinning), so the pattern sticks to the cloth while the figure walks. Stripes: horizontal bands along height, 40 mm period, 50% duty. Checks: 40 mm cells. Dots: a grid 36 mm apart, 7.5 mm radius. All antialiased with `fwidth`, and the pattern amplitude fades to flat when its period falls under about 2.2 px (`amp = 1 - smoothstep(0.35, 0.6, fwidth(coord))`) so a small figure never shimmers.
- **Second colour (a tint of the outfit colour; no second picker, Q-31):** if the outfit colour's luminance is 0.3 or more, the second colour is the outfit colour at 72% brightness (a shade); otherwise it is the outfit colour lifted 45% toward cream `#efe3cc` (a tint). Adjust until the contrast ratio between the two is between 1.6 and 4 (a calm pattern, never harsh). Unit-test all 12 outfit colours.
- Uniforms per character: pattern index, pattern mix (0 to 1, cross-faded over `--duration-fast`, instant under reduced motion) and the second colour.
- Checks: all 6 outfit styles by 4 patterns by 12 colours by 3 genders by 4 body types: the mask covers only the garment (a dress's skin legs and a tee's jeans stay plain), seams across the sleeve and torso are continuous, no pattern on the badge. Plain is vertex-identical to today.

**F. Idle and walk (FR-91, Should).** Larger amplitudes, no new bones: leg swing 25 to 32 degrees, arm counter-swing 20 to 26 degrees, hip bob 3 cm to 4 cm peak to peak, cycle frequency unchanged. Idle: a breathing scale of the spine bone between 1.000 and 1.008 at 0.3 Hz, a head yaw of plus or minus 2 degrees at 0.12 Hz, a 1.5 degree arm sway at 0.3 Hz. Check no clip between the trouser shell and the hem at the new amplitudes. Reduced motion: the existing still pose (`resetPose`), no breathing.

**G. Six new clothing styles (Q-30, FR-97, FR-99).** Provisional ids and labels; the architect confirms the contract. Each is built from the existing ring lofts and joint functions (so it follows shoulder, waist, hip, chest, height and gender like every current garment, with no gender-specific cut), uses the outfit colour for its main garment, and fits every body type, height and gender (216 combinations per style, as 9.7). The pattern (E) and the colour apply to every style; no combination is blocked.

| Id and label | Silhouette (the difference to read at 120 px, front and back) | Colour roles | Notes |
|---|---|---|---|
| `sweater` Sweater | Crew neck, long sleeves ending in a snug cuff, boxy body ending in a ribbed hem band a little wider than the waist, hip length | Sweater: outfit colour. Bottoms: fixed trousers (`--avatar-trousers`) | Hem and cuff bands are the trim (12.8.2 B). Reads as a soft, wide hip line against the tee's straight one |
| `overalls` Overalls | Straight trouser legs, a chest bib with two straps over the shoulders, a short-sleeved tee underneath | Overalls: outfit colour. Tee: the suit's fixed cream shirt colour | The straps and bib give a back-view cue (two straps crossing the shoulders). Pattern applies to the overalls only |
| `coat` Coat | Knee-length, flared from the hip, collar, a centre line down the front and the back vent, long sleeves | Coat: outfit colour. Bottoms and neck: fixed trousers | The longest top: the one style that hides the legs above the knee. Keep the flare inside the walking pose's leg swing so the hem does not clip the legs |
| `tracksuit` Tracksuit | Zip jacket with a stand collar plus tapered joggers gathered at the ankle, a side stripe | Jacket and joggers: outfit colour, joggers 8% darker; stripe in the lighter tint | The tapered ankle against the wider cuff is the cue. Pattern applies to the jacket and joggers |
| `cardigan` Cardigan | Open front showing a tee beneath, hip length, long sleeves, a button line down each front edge | Cardigan: outfit colour. Tee: the fixed cream. Bottoms: fixed trousers | The open front is a contrast panel on the chest and distinguishes it from the closed sweater |
| `tunic` Tunic | Long straight shirt to the knee with a mandarin (stand) collar and short side slits, over trousers | Tunic: outfit colour. Trousers: fixed trousers | A kurta-style tunic: straight and long without the dress's flare, so it differs from Dress and Coat. If the product manager prefers a skirt, swap `tunic` for `skirt` (an A-line knee-length skirt with a fitted top in the lighter tint); a skirt must remain a plain garment option for every gender, as Dress is |

- **Triangle rule.** No new style may exceed the triangle count of Suit (the largest garment today) for the same body type and hair, so the worst character total does not move (5,878 plus the catchlights, at most 5,950). Prefer a few clean loft rings to many small parts; trim lines are vertex colours, not meshes.
- **Distinct silhouettes.** Render all twelve styles as flat single-colour silhouettes at 120 px, front and back, on one body. Every pair must differ in at least one of: top length (hip, mid-thigh, knee), sleeve length, hem width, leg shape (straight, tapered, covered), a front opening, or a strap or hood feature. A pair that does not is redesigned. Today's six are the references: tee and jeans (short sleeve, hip), hoodie (hood, hip), shirt and trousers (long sleeve, hip), dress (knee flare, bare legs), suit (jacket line, collar), jumpsuit (one piece, straight leg).
- **Colour check.** Each style in all 12 outfit colours against the three skin extremes: the main garment is 1.3:1 or more against the skin it touches at the neck and hands, or gets the trim in B; the separation rule (B) handles top against bottom.
- **Gender neutrality.** No style is hidden, ordered, pre-selected or renamed by gender. Labels name the garment (FR-99): Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic.
- **Description words** (9.4 template): "{colour} sweater and trousers", "{colour} overalls and cream tee", "{colour} coat", "{colour} tracksuit", "{colour} cardigan", "{colour} tunic and trousers".

#### 12.8.3 The museum

| Element | Change (all inside the existing identity) |
|---|---|
| Walls | **Dado:** lower wall 0 to 0.95 m in `--look-dado` (vertex colour) with a slim rail (`--look-dado-rail`, 0.05 by 0.04 m, a merged strip) on top. **Contact darkening:** wall base darkens by `--look-ao-wall-base` (12%) over the lowest 0.5 m, and the top by `--look-ao-ceiling` (18%) over 0.4 m, tinted `--look-ao`. **Wall cap:** a flat 0.06 m cap in `--look-dado-rail` on every wall top, so the ceiling cutaway (6.3) looks finished |
| Floor | Oak: plank seams every 0.2 m along the route (1 px, `--scene-floor-grain`), plank-to-plank tone variation of plus or minus 4%, faint grain (existing texture, edited). **Edge shadow decal:** a 0.45 m soft dark strip along each wall at 18% alpha (merged, normal blend) so walls sit on the floor. **Runner:** a darker inner band `--look-runner-border` 0.12 m wide inside the brass line; pile noise as now |
| Ceiling | `--scene-ceiling` deeper. One recessed strip per room (`--look-ceiling-strip`, emissive, 0.06 by 1.2 m, a leading line along the route) and the rose in the entrance hall and finale. Strips and roses fade with the ceiling (6.3). **Strip position (v2.0.1):** on the room's centre line, running along the route, and offset from the rose by 0.3 of the room depth up to 2.4 m so the two never overlap. The offset is **toward the exit (-Z)**, ahead of the Visitor, so the strip reads as a line that leads to the next doorway. As built: `cz - min(0.3 x depth, 2.4 m)` (scene-developer applied this after v2.0.1) |
| Frames | Keep 0.06 m border and 0.05 m depth. Add a **brass fillet** (`--look-frame-fillet`, 3 mm, 8 triangles) between the walnut and the mount, and shade the mount's inner edge 6% darker (vertex colour, a fake bevel). **Contact shadow:** a soft decal (`--look-contact-shadow`, wider by 0.04 m, shifted 0.02 m down, behind the frame, never over the photo) |
| Picture lights and wash | Wash peak alpha `--look-wash-alpha` (0.18, was 0.10 to 0.14), 1.6 times the frame height tall, tinted `--scene-pool`. The decal is drawn **behind** the frame and never covers the mat or the photo |
| Standing pools | **At least as visible as before** (FR-92): unchanged peak alpha 0.3, proximity ramp 40% to 100%, colour `--scene-pool` |
| Plaques | The entrance title plaque: Fraunces 600 title on `--scene-plaque`, a brass edge and a 1 px inner bevel line; text drawn at 2 times for sharpness. Numbered plaques stay R2 |
| Finale | Podium: top `--scene-podium`, side `--look-plinth-side`, brass inlay ring (existing), a soft contact shadow decal under it; ring glow at least as strong as before. Cone and motes unchanged. Lectern unchanged |
| Lighting | Starting values, tuned by eye: hemisphere intensity 2.7 to **2.5**, key 1.2 to **1.15**, environment intensity 0.3 unchanged, Neutral tone mapping unchanged. The wash and ceiling changes carry the contrast. Mood stays warm (3000 K key) |
| Photos | Unlit and not tone mapped as now (FR-40). Nothing may overlay a photo: no shadow, no wash, no vignette. Check: the mean colour of a rendered photo is within 2% of the source |
| Not added | Fog, vignette, bloom, real shadows, new materials with environment reflections on Low |

**Look checks (screenshots at the four viewports):** frame, mat and wall are distinct at a glance; the wall near a picture light is at least 1.25 times as bright as the wall 1.5 m away; no more than 1% of non-photo pixels clip to white; the dado, rail and cap read as trim and not as seams; no new moire or banding on the planks at 360 px (check the mip levels).

#### 12.8.4 Builder preview stage and plinth

Stage: a CSS radial gradient behind a transparent canvas, `radial-gradient(70% 70% at 50% 40%, var(--look-stage-centre), var(--look-stage-edge))`. If a transparent canvas is not practical, keep the flat `PREVIEW_BACKGROUND`. The plinth under the two characters matches the finale podium (cream top, `--look-plinth-side` side, brass ring; the active character's ring glows), with a contact shadow decal. Lighting stays neutral and slightly cool so skin and hair colours read true while they are chosen; the dual-band edge is lighting independent, so the preview shows what the visit shows. The Face tab zoom is in 12.5.3.

#### 12.8.5 Auto against Low quality (FR-93)

| Feature | Auto | Low |
|---|---|---|
| Dual-band edge, region trims, face changes, catchlights, face shape, pattern | On | On (all are a few shader operations or vertex colours) |
| Contact shadow decals under frames, plinths | On | Off; the baked edge darkening and mat shading carry it |
| Floor and wall edge darkening | Decal and vertex colour | Vertex colour only |
| Dado, rail, cap, fillet, ceiling strips | On | On |
| Environment reflections on floors and brass, dust motes, light cone | On (as now) | Off (as now) |
| Ceiling fade (6.3) | On | On |
| Idle breathing and the larger stride | On | On |

#### 12.8.6 Acceptance, measurement and recording (FR-89)

- **Edge contrast.** Render each character at the default follow camera at 360 by 640 and in the builder preview, **at pixel ratio 1.5 with the phone Low tier (coarse pointer, no multisampling), the render a phone visitor gets (tech-lead decision, 11/11/2026; supersampled runs no longer count as acceptance).** Pin the ratio (`gl.setPixelRatio`) or record `data-render-dpr-cap`, and discard the first case of a run (extra samples). Pixel ratio 1.0, where the DPR governor lands on a phone that cannot hold 30 fps, is a **stretch case**: report it, but it is not the pass bar, and the governor floor is unchanged. For each **skin tone** (10), **hair colour** (11) and **outfit colour** (12), take the pixels 0.3 to 1.0 px inside the silhouette (both bands) and the backdrop pixels just outside, against each backdrop family: linen wall, oak floor, claret runner, finale wall and floor, preview stage. The edge contrast ratio is the WCAG ratio of the better of the two bands against the backdrop. Target 3:1.
- **Record every failure** in `docs/handoffs/technical-artist.md` as a table (region, option id, backdrop, ratio, cause). Likely candidates: a pale figure against a pale wall seen through a doorway at a grazing angle; the top of dark hair against the dark ceiling at a low camera pitch (under 10 degrees); the runner's edge, where the backdrop changes under one silhouette. A failure is recorded, not hidden.
- **Silhouette check:** the Woman, Neutral and Man silhouettes at 120 px (flat single colour) stay at least 10% apart in shoulder-to-hip ratio (CR-1) and the contour does not close the gap between the legs, arms and torso.
- **Feature check (FR-90):** at the presentation framing on 360 by 640 and at the Face tab zoom, a reviewer can name the eyes, brows, nose and mouth, the hair as a shape, the hands apart from the sleeves, and the top and bottom as two regions, for all ten skin tones.
- **Budgets:** the triangle test (worst case at most 5,950, expected 5,918), the draw-call test, `npm run build` three.js chunk under 985 kB, and the performance.md runs on Low and High.
- **Test changes:** the Neutral fingerprint test is re-baselined once for the CR-4 face and edge changes (NFR-29: older museums show the improved look); keep two invariants: a character with no gender, no face shape and no pattern equals Neutral, Oval and Plain, and Plain with Oval and no edge band equals the pre-CR-4 vertices for body and hair apart from the documented face changes.

### 12.9 Tokens added in v2.0, and contrast

All in `src/styles/tokens.css`. No name was removed or renamed.

| Group | Tokens |
|---|---|
| Type | `--text-micro`, `--text-hero`, `--text-lead`, `--leading-snug`, `--tracking-display`; **value change** `--text-xs` 13 to 14 px |
| Space | `--space-7`, `--space-14`, `--space-20`, `--target-gap`, `--page-gutter`, `--section-gap` |
| Size | `--touch-target-md`, `--sheet-max-height-phone`, `--bar-min-height`, `--bar-min-height-compact`, `--progress-bar-height`, `--photo-thumb-size`, `--tile-height`, `--option-thumb-size`, `--option-tile-tall`, `--accent-bar-width`, `--preview-sticky-height`, `--joystick-size-compact`, `-knob-compact`, `-hit-compact`, `-travel-compact` |
| Colour | `--color-surface-raised`, `--color-bg-glow`, `--color-accent-top`, `--color-accent-wash`, `--gradient-page`, `--gradient-accent`, `--color-divider-night`, `--color-track-night`, `--avatar-skin-blush-deep` |
| Depth | `--shadow-raised`, `--shadow-button`, `--shadow-button-pressed`, `--shadow-glass`, `--shadow-bar`, `--shadow-art`; `--z-sticky` (4) |
| Motion | `--duration-overlay` (220 ms), `--duration-stagger` (60 ms), `--rise-distance` (12 px); all three are 0 under both reduced-motion paths |
| Scene value changes | `--scene-ceiling` `#3b2c33` to `#30232b`; `--scene-light-ground` `#7a5844` to `#6a4a3c`. **`palette.ts` must change in the same commit** or the drift test in `src/scene/materials/palette.test.ts` fails |
| Look (mirrored in a new `look.ts`) | `--look-contour`, `-rim`, `-rim-px`, `-contour-px`, `-contour-max`, `-rim-max`, `-separation-threshold`, `-eye-scale`, `-catchlight`, `-brow-thickness`, `-brow-contrast`, `-brow-lift`, `-mouth-thickness`, `-dado`, `-dado-rail`, `-ao`, `-ao-wall-base`, `-ao-ceiling`, `-wash-alpha`, `-frame-fillet`, `-runner-border`, `-ceiling-strip`, `-plinth-side`, `-contact-shadow`, `-stage-centre`, `-stage-edge` |

Values that **must not change** because other code depends on them: `--hud-margin`, `--card-min-width`, `--card-width-landscape`, `--card-width-wide`, `--panel-peek-height`, `--panel-fit-min-height`, `--panel-strip-lines`, `--joystick-size`, `-knob`, `-hit`, `-travel` (portrait values), and the presentation-camera durations and easing.

**Contrast additions (calculated with the WCAG formula; QA re-verifies with a tool).**

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `--color-on-accent` | `--color-accent-top` | 6.9 | Top of the primary button gradient (the lowest point of the gradient; the bottom is 7.8) |
| `--color-text` / `--color-text-muted` | `--color-surface-raised` | 15.2 / 6.2 | Hovered and selected cards |
| `--color-text` / `--color-text-muted` | `--color-bg-glow` (and anywhere on `--gradient-page`) | 14.4 / 5.9 (the gradient never goes darker than `--color-bg`: 13.4 / 5.4) | Landing and welcome text |
| `--color-accent` | `--color-accent-tint` | 6.3 | Required tag, still-to-do chips |
| `--color-text-muted` | `--color-surface-sunken` | 5.2 | Optional tag, disclosure value text |
| `--color-on-accent` | `--color-accent` | 7.8 | Selected tab pill |
| `--color-brass` (ring fill) and `--color-track-night` (empty ring) | `--color-hud-solid` | 7.3 and 3.5 | HUD progress ring (the number carries the meaning as well) |
| `--color-on-night` | HUD glass over a white pixel | 8.7 | Done and Carry on buttons, trays |
| State bars: `--color-danger` / `--color-success` / `--color-warning-border` / `--color-accent` | `--color-bg` | 5.5 / 5.3 / 3.1 / 7.1 | 4 px alert bars (each needs 3:1; each alert also has an icon and words) |
| Placeholder `--color-text-muted` | `--color-surface` | 6.0 | Title and closing message placeholders |

Not text, so not rated: the divider rule inside a tray, the faint claret wash behind the Required card, the scroll shadows.

### 12.10 Copy added (FR-76, NFR-31)

| Where | Copy |
|---|---|
| Landing | "No account needed." Step lines: "Photos hang along the museum in the order you choose." / "Pick a look for you and for your visitor." / "They open it on their phone and wander through." |
| Step purpose lines | 1 "You can add 1 to 20 photos. JPEG, PNG, WebP or HEIC, up to 15 MB each." 2 "Two names are all you need. The rest is optional." 3 "Both characters already have a starting look. Change as much or as little as you like." 4 "Check everything, then publish. You can preview first." |
| Sections and tags | "Your photos" (Required, "at least 1 photo"); "The names" (Required); "How it will look"; "Make it yours" (Optional); "Optional: everything here has a starting look" (step 3); "Consent" (Required) |
| Still to do | Heading "Still to do"; "Ready to publish"; chips "Add a photo", "Wait for photos to finish", "Fix the photo that didn't upload", "Add the Visitor's name", "Add a Guide name", "Confirm you can share the photos" |
| Step 3 | "The Guide is you. The Visitor is who you're making this for." Disclosure button "More options" (visible text "Reset" on the Reset button under 480 px, accessible name unchanged). Group "Face shape (optional)" (Oval, Round, Square, Heart, Long), helper "Changes the shape of the face. Your other choices stay as they are." Group "More styles (optional)" (Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic). Group "Pattern (optional)" (Plain, Stripes, Checks, Dots), helper "Adds a pattern in tints of your colour. There is no second colour to pick." |
| Step 1 | "No photos yet", "Add more photos" |
| Placeholders | "A museum for {name}"; "For example: Thanks for coming. I hope it made you smile." |
| Visit | "Done" (accessible name "Done with this photo"); "Carry on" (accessible name "Carry on exploring") |
| Customiser description | Words "round face", "striped", "checked", "spotted" as in 9.4 |

FR-76 scan: none of these contains she, her, he, him, his, girlfriend or boyfriend. "Their" and "your" are used as before. The face shape words are shape words; no option label names a gender.

### 12.11 Task list by owner

**frontend-developer** (`src/ui/`, `src/ui/styles/`; in this order)
1. Tokens: use the new ones; set `--ui-bar-height` to `--progress-bar-height`; swap every raw size for a token; fix the 8 px gap audit (tabs, preview controls, photo actions, swatch cells 48 px, alert link lists).
2. Landing (12.3): DOM order (Create above steps), hero type, step cards, framed art, "No account needed.", font fallback face for CLS.
3. Builder shell (12.4): step header with purpose lines, stepper (segments with short labels, container-query 2 by 2, not sticky on phones, rail on desktop), **Still to do** list from `validateDraft(..., 'publish')` shared with the Preview dialog, action bar with progress line and phone Preview, keyboard-open fallback, blur validation.
4. Steps (12.5): sections with Required and Optional tags, compact photo row, Add more photos, Words regrouping and placeholders, review cards (all thumbnails), Published hierarchy.
5. Characters step (12.5.3): sticky preview, icon-only preview controls, character-switch line; the **More options** footer row that shares the Reset row (closed = today's controls and height, FR-102); inside it **Face shape**, **More styles** (six pictogram tiles, two columns at 360 px, bound to the same `outfitStyle` value as "Outfit style") and **Pattern** (CSS fabric swatches); `describeAvatar` words; Face-tab framing request; handle missing values (Oval, Plain, old style). Do not touch the visible tiles' DOM or sizes. Needs the contract and schema change first (architect, 12.12).
6. Visit (12.6): trays, progress ring (`--p`), welcome (including landscape), finale footer, notices, sheets at 60 dvh, **Done** and **Carry on** buttons (phone portrait only, in `keepOut`), joystick restyle (compact sizes optional), overlay motion tokens.
7. Caption card visual finish only (12.6.4); do not touch 3.5 sizes or logic.
8. Keep the selector-safety list (below); update unit tests for the new strings and the FR-76 scan.

**technical-artist** (`src/scene/materials/`, `src/scene/shaders/`, `src/scene/characters/kit/`, `public/`; in this order)
1. Update `palette.ts` for `--scene-ceiling` and `--scene-light-ground`; add `look.ts` mirroring the `--look-*` tokens with a drift test.
2. Character edge: dual-band patch on body and hair materials (12.8.2 A), with the derivative fallback.
3. Region trims, ambient darkening, separation rule (B); face changes: eyes, catchlights (at most 60 triangles added), brows and colour, mouth, deep-skin blush, facial hair floor (C).
4. **Face shape** warp and morph generalisation; label anchor at the tallest shape (D). **Pattern** mask attribute, shader and tint rule (E). **Six new clothing styles** (G: sweater, overalls, coat, tracksuit, cardigan, tunic), each at or under Suit's triangle count, with the 120 px distinct-silhouette check and 216-combination fit checks. All default to today's look. Extend `describeAvatar` and the options file with the new ids (provisional).
5. Idle and walk amplitudes and breathing (F).
6. Museum finish (12.8.3): dado, rail, caps, contact darkening, plank seams, runner border, edge shadow decal, ceiling strips, frame fillet and shadow, wash alpha, podium sides, plaque, lighting values; ceiling material that supports an opacity value (6.3).
7. Preview stage and plinth (12.8.4); Auto and Low split (12.8.5).
8. Measure and record (12.8.6): edge-contrast table with failures, triangles, draw calls, chunk size, performance runs. Re-baseline the Neutral fingerprint test.

**Also needed, outside the two named owners**
- scene-developer: ceiling opacity from camera height (6.3); label clamp and de-overlap and the solver's label width (12.6.8, N-10); Guide kept in the fit set; read face shape and pattern for every character; face shape morph in the preview; place the new decals and strips.
- architect and product-manager: final ids and counts for face shape, clothing style and pattern in the contract and schema (provisional ids in 9.2); the schema change must default missing values (NFR-29).
- qa-engineer: derive checks from 12.3 to 12.8 (target size and gaps, font audit, 200% and 320 px, fold measurements, three-Next path, Still to do, edge contrast, budgets, CLS, legacy museum load). Selectors may be updated only where visuals changed.

**Selector safety (must not change).** Class names `.btn*`, `.ui-hit`, `.ui-layer`, `.scene-root`, `.hud*`, `.caption-card*`, `.finale-card*`, `.stepper__item`, `.photo-row*`, `.radio-option*`, `.tabs__tab`; attributes `data-dock`, `data-card-size`, `data-expanded`, `data-layout`, `data-sheet`, `data-row-id`, `data-presentation-camera`; field ids from `FIELD_IDS`; accessible names "Next", "Back", "Preview", "Publish museum", "Add photos", "Earlier", "Later", "Replace", "Remove", "Close", "Look closer", "Read more", "Show less", "Start", "Pictures", "Where next?", "Settings", "Help", "Reset view", "Turn left", "Turn right", "Back view", "Keep exploring", "Replay from the start"; the stepper text "Step n of 4: Label". New controls have different names (for example "Done with this photo", "Add more photos").

### 12.12 Coverage, conflicts and open questions

| Requirement | Where |
|---|---|
| FR-77, FR-78 (scales, one style set, one primary) | 12.1 |
| FR-79 (states, 250 ms, empty and error states) | 12.2 |
| FR-80 (landing above the fold) | 12.3 |
| FR-81, FR-83 (targets, text) | 12.7, 12.1 |
| FR-82, FR-84 (reach, safe areas, keyboard) | 12.4.4, 12.7 |
| FR-85, FR-86, FR-87 (progress, grouping, defaults, validation) | 12.4, 12.5 |
| FR-88 (time hints, Could) | Not specified: no observed times (12.4.6) |
| FR-89, FR-90 (edge contrast, features) | 12.8.2, 12.8.6 |
| FR-91 (idle and walk) | 12.8.2 F |
| FR-92, FR-93 (finish, depth, Low fallback) | 12.8.3, 12.8.5 |
| FR-95 (ceiling never blocks the view) | 6.3 (ceiling fade, reduced-motion step with hysteresis), 12.8.3 (wall caps) |
| FR-96 to FR-99 (face shape, clothing style, pattern, every gender) | 9.2, 12.5.3, 12.8.2 D, E, G |
| FR-100, FR-101 (optional in the data, identical rendering everywhere, validation) | 9.2 (defaults and missing values), 12.8.2 (same kit and parameters in every view); schema validation is the architect's and backend's |
| FR-102 (More options, closed = no taller) | 12.5.3 (shared Reset row, measure) |
| FR-82 (Could), FR-84 (Should) | 12.7 (small additions only), 12.4.4 |
| FR-94 (out of scope) | Respected, except the new character choices the user asked for (face shape, clothing styles, pattern) |
| NFR-27 to NFR-31 | 12.3 (size, CLS), 12.8 (budgets), 12.9 (contrast), 12.10 (copy), NFR-29 (no flow change; two options default to today's look) |
| User feedback 02/11/2026 (more choice, phones fine, ceiling) | 12.5.3, 9.2, 12.7, 6.3 |

**Conflicts and open questions.**
1. **Ids for the new options (product-manager, architect).** Face shape: oval, round, square, heart, long. Pattern: plain, stripes, checks, dots. Clothing style: today's six plus `sweater`, `overalls`, `coat`, `cardigan`, `tracksuit`, `tunic` (a skirt is the named alternative to the tunic). All provisional; the UI needs only labels and ids from the contract, and missing values must load as Oval, Plain and the existing style.
1a. **Split of the clothing style across two groups.** To keep today's tiles, tests and the closed step height unchanged (FR-102), the new six styles sit in "More styles" inside More options while today's six stay visible. If the user would rather see all twelve together, move the whole group into More options as one pictogram grid (12.5.3) and update the tests that pick an outfit style.
1b. **Whole-step height (FR-102).** The strict measure is the options panel under the tabs; the whole-step height is expected to be no taller but is an estimate (12.5.3). QA measures it at 360 by 640 and 390 by 844.
2. **FR-80 wants a one-sentence description.** The copy deck has two sentences. Kept as one paragraph to protect copy and tests (12.3). Product-manager: confirm or shorten.
3. **FR-79's 250 ms against `--duration-normal` (300 ms).** Overlays use the new `--duration-overlay` (220 ms). `--duration-normal` stays for progress fills and photo fades, which are not overlays.
4. **Edge contrast against every backdrop cannot be guaranteed.** The arithmetic in 12.8.2 A passes on paper, but a few combinations (a pale figure through a doorway at a grazing angle, dark hair against the ceiling at low pitch, the runner's edge) may fall short in a real render. They are to be recorded (FR-89), not hidden.
5. **Deep-skin brows.** Brows get a 3:1 floor with a warm lift; if black hair on skin-10 still looks faint, raise `--look-brow-thickness` to 1.6 before touching colour.
6. **Time hints (FR-88).** Left for after a usability test.
7. **Ceiling fade or pitch clamp (user preference: fade).** 6.3 specifies the fade, keeps the existing pitch range, and adds a hard step under reduced motion.`
