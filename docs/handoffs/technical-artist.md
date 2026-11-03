# Handoff: technical-artist

The newest rounds (CR-4 hair contrast, 03/11/2026, then CR-4, 02/11/2026) are the first sections. Earlier sections below describe the v1.0 and CR-1 kit; where they quote 5,878 triangles per character or 970.7 kB, the CR-4 figures replace them.

## CR-4 hair contrast update (03/11/2026)

Tech lead approved raising the hair tessellation for the light-hair edge failures (FR-89). The numbers in the CR-4 section below are superseded where this section says so.

**What I found.** Raising the cap rows alone did nothing: with the cap at 10 rows the light-hair medians on oak stayed at 1.9 to 2.2. The cause was not the row count. On a coarse faceted shell `ndv / fwidth(ndv)` overestimates the pixel distance by about half a facet width, so the 1.5 px dark contour was pushed outside the silhouette and only a thin line showed. Hair facets are bigger than the head's, so the hair needed its own edge tuning as well as finer shells.

**What changed (shader and hair builder only; no new draw call, mesh or material):**
- `hair.ts`: caps went from 5 rows by 20 segments to 8 by 24. The bob curtain went from 16 to 24 segments, long straight from 16 to 28 and long wavy from 20 to 25. Those counts put a vertex at the left and right of the figure (`segments * (half - PI/2) / (2 * half)` is whole), the same alignment that fixed the limbs. The afro is unchanged.
- `AvatarSurfaceMaterial.ts` and `avatarEdge.glsl`: the edge now has per-material `EDGE_K`, `EDGE_W1` and `EDGE_W2` defines. Body stays 0.7, 1, 1. **Hair is 0.7, 1.2, 2.0:** a 1.2 times wider rim and a 2 times wider contour (3 px instead of 1.5). I tried 0.7/1/1.4, 1.6, 0.5, 0.35, 0.7/1.5/1.6 and 0.7/1.2/2.0 over 12 styles, 4 colours (blonde, platinum, pink, black) and 5 backdrops (240 renders per setting); 0.7/1.2/2.0 was the best.

**Hair edge contrast, median under 3:1 (all 12 styles, 4 colours, 5 backdrops = 240 cases):** before **51** cases, after **7**. Remaining failures:

| Region | Option | Backdrop | Median | Cause |
|---|---|---|---|---|
| Hair, curly-short | blonde | Claret runner | 2.19 | The curls are 6-sided blobs; their silhouette facets are too small for the band to find, and the worst-case hair (1,660 triangles) leaves no triangles to re-tessellate them |
| Hair, curly-short | blonde | Finale wall | 2.92 | Same |
| Hair, curly-short | pink | Claret runner | 2.07 | Same |
| Hair, curly-short | pink | Finale wall | 2.42 | Same |
| Hair, curly-short | black | Claret runner | 2.22 | Dark hair on a dark backdrop needs the rim, which small blobs do not give |
| Hair, curly-short | black | Finale wall | 1.67 | Same |
| Hair, bob | black | Claret runner | 2.57 | Black curtain on claret: the rim on the curtain's open edges |

**Full table re-measured** (same method as before, default Guide, 33 characters, 6 backdrops; the hair column is the 11 hair colours on short crop):

| Backdrop | Hair | Head | Torso and arms | Legs |
|---|---|---|---|---|
| Linen wall | 10.56 (platinum), typical 13.7 | 11.30 (skin-01), 12.2 | 7.24 (green), 9.1 | 13.79, 13.8 |
| Oak floor | 4.84 (platinum), typical 6.3 | 5.48 (skin-01), 5.8 | **2.29** (cream outfit), 4.2 | 6.34, 6.3 |
| Claret runner | 3.50 (black), 3.5 | 3.08 (skin-09), 3.2 | 4.33, 4.3 | 4.28, 4.3 |
| Finale wall | 4.81 (black), 4.9 | 3.90 (skin-09), 4.3 | 5.79, 5.8 | 5.74, 5.7 |
| Finale floor | 5.86 (charcoal), 5.9 | 5.12 (skin-09), 5.3 | 7.22, 7.2 | 7.15, 7.2 |
| Preview stage | 12.97 (white), 17.1 | 13.91 (skin-01), 15.1 | 5.69 (cream outfit), 11.2 | 17.11, 17.1 |

The nine hair failures of the first table (blonde, pink, grey, platinum, white and ginger hair on oak, platinum on the wall and stage) all pass now. **The one remaining failure on the default character is the cream outfit on oak: torso and arms median 2.29, p10 1.8, 54% of samples under 3:1.** I tried the cheap material-side fix on the body band (no geometry): a 1.3 times wider contour gave 2.33, a 2.0 times wider contour with a 1.2 times wider rim made torso and arms worse (oak 1.47, stage 1.81), and a 1.6 times wider contour with a narrower rim moved the failure to the head on the runner (2.07). The limbs are thin, so a wider band trades one backdrop for another. No cheap fix exists; it stays recorded as a failure. A real fix would be a darker cream sleeve trim or a thicker arm (geometry).

**Budgets after the change:**
- Worst character (curly-short, full beard, suit, slim, Guide, skin-10): **5,862** (was 5,682; the hair grew by 180). Hard stop 5,950, NFR-27 6,000. Pass, 88 triangles under the hard stop.
- Worst hair per style: shaved 796, buzz 796, short-crop 996, side-part 996, curly-short **1,660**, bob 1,040, long-straight 1,120, long-wavy 1,146, ponytail 1,176, bun 1,040, afro 856, braids 1,568. Body counts are unchanged (suit 4,200 is the worst body).
- Worst character per style (body worst plus 1,660 hair plus the 2-triangle shadow): tee-jeans 5,558, hoodie 5,658, shirt-trousers 5,702, dress 5,602, **suit 5,862**, jumpsuit 5,630, sweater 5,670, overalls 5,718, coat 5,582, tracksuit 5,750, cardigan 5,638, tunic 5,614. Draw calls per character: 3.
- **Neutral fingerprint re-baselined a second time, hair only.** Eleven of the 12 hair hashes changed because the cap and curtain tessellation changed; the afro and all four body hashes are unchanged. New hair values are in `gender.test.ts` (`CR4_GOLDEN`). The v1.0 proof for the torso, pelvis, thighs, garments, extras, badge and neck still passes.
- **three.js chunk: 988.70 kB, over the 985 kB guard.** This is not the hair work: at HEAD `0cf9877` (the scene developer's CR-4 integration) a clean build is already **988.47 kB** (the chunk is now `finale-*.js`; the Experience chunk shrank by 8.4 kB, so code moved into it). My change adds 0.23 kB. At my commit `08a5359` the chunk was 976.55 kB. Cutting enough to get back under 985 kB (about 3.7 kB) needs the cuts the tech lead ruled out (finale dado variant, strip builder, garment duplication), so I left them. Decision needed.
- Tests: `KIT_TEST_TIMEOUT` (120 s) now sits on every `describe` in `cr4.test.ts`, `gender.test.ts` and `kit.test.ts`, so a parallel full run cannot hit the 5 s default. typecheck, lint, 1,047 tests and `npm run build` pass.

## CR-4 update (02/11/2026): face, edge, shape, pattern, twelve styles, museum finish

Everything is code, vertex colour or a small shader patch. No new texture, library, post-processing pass or draw call. Not rendered on a real phone: all renders are headless Chromium on SwiftShader (software GL) through a throw-away harness, and the contrast figures are from flat token backdrops, not the lit museum.

### Result in numbers

| Budget | Before | Now | Limit | Status |
|---|---|---|---|---|
| Worst character (curly-short, full beard, suit, slim, Guide, skin-10) | 5,878 | **5,682** | 5,950 hard stop, 6,000 NFR-27 | Pass. ADR 0021's provisional 6,500 is not needed (7.3a step 5) |
| Draw calls per character | 3 | 3 (body, hair, shadow) | 10 | Pass |
| Scene draw calls from the shell finish | n/a | 0 added (dado, rail, cap colour, contact darkening, edge shadow, runner border are shader changes on existing materials) | 4 more | Pass. The placement requests below would add at most 4 merged meshes |
| three.js chunk (`NameLabel-*.js`) | 961,853 B | **976,550 B** (+14.7 kB; gzip +4.7 kB) | guard 985 kB; target at most +10 kB | **Guard passes with 8.5 kB spare; the +10 kB target is missed by 4.7 kB** (see "Chunk size") |
| Shader programs | 2 (body, hair Lambert) | 2 (patched, constant cache keys) | n + 1 | Pass |
| Pattern memory | n/a | +4 B per body vertex (`outfitMask`), about 10 kB per character | | Pass |

**Triangles per style** (worst body over 4 body types, 2 roles, skin-01 and skin-10; worst hair 1,480 plus the 2-triangle shadow). The kit tests loop over all 12 and have an explicit 120 s timeout (`KIT_TEST_TIMEOUT`).

| Style | Body | Character | | Style | Body | Character |
|---|---|---|---|---|---|---|
| tee-jeans | 3,896 | 5,378 | | sweater | 4,008 | 5,490 |
| hoodie | 3,996 | 5,478 | | overalls | 4,056 | 5,538 |
| shirt-trousers | 4,040 | 5,522 | | coat | 3,920 | 5,402 |
| dress | 3,940 | 5,422 | | tracksuit | 4,088 | 5,570 |
| suit | **4,200** | **5,682** | | cardigan | 3,976 | 5,458 |
| jumpsuit | 3,968 | 5,450 | | tunic | 3,952 | 5,434 |

Every new style is at or under the suit (art target met). The default Guide rig is 4,422 triangles. Face shape and pattern add 0 triangles (tested for every hair style, outfit and shape). Catchlights add 36 (2 discs of 18, limit 60). **Why the total fell by 196 against the old 5,878:** arms, forearms and shins went from 10 to 8 sides (-232), see Decisions.

### Edge contrast (FR-89), measured

Method: 360 by 640 at the follow-camera framing (figure 329 px tall), supersampled 3 times (pixel ratio 3), default Guide in shirt and trousers, one option varied at a time (10 skins, 11 hair colours, 12 outfit colours = 33 characters) against six flat backdrops in token colours (linen wall, oak, claret runner, finale wall, finale floor, preview stage; the stage with the preview lighting). The contrast of a silhouette sample is the WCAG ratio of the better of the pixel 0.3 px inside (rim band) and the pixel 1.0 px inside (contour band) against the backdrop pixel 0.5 px outside. Edge samples are the left and right silhouette of every row and the top of every column, grouped as hair (hair mesh pixels), head, torso and arms, legs. Each cell is the **median** over the zone's samples. The worst option's median is shown, then the typical (median over the 33 characters). Target 3:1.

| Backdrop | Hair | Head | Torso and arms | Legs |
|---|---|---|---|---|
| Linen wall | **2.66** (platinum), typical 12.4 | 11.30 (skin-01), 12.2 | 7.24 (green), 9.1 | 13.79, 13.8 |
| Oak floor | **1.93** (blonde), 5.8 | 5.48 (skin-01), 5.8 | **2.29** (cream outfit), 4.2 | 6.34, 6.3 |
| Claret runner | 4.23 (black), 4.3 | 3.08 (skin-09), 3.2 | 4.33, 4.3 | 4.28, 4.3 |
| Finale wall | 5.72 (black), 5.8 | 3.90 (skin-09), 4.3 | 5.79, 5.8 | 5.74, 5.7 |
| Finale floor | 6.99 (black), 7.2 | 5.12 (skin-09), 5.3 | 7.22, 7.2 | 7.15, 7.2 |
| Preview stage | **2.54** (platinum), 15.3 | 13.91 (skin-01), 15.1 | 5.69 (cream outfit), 11.2 | 17.11, 17.1 |

**Failures (median under 3:1), recorded, not hidden:**

| Region | Option id | Backdrop | Median | p10 | Samples under 3:1 | Cause |
|---|---|---|---|---|---|---|
| Hair | blonde | Oak | 1.93 | 1.42 | 69% | Mid-light hair against mid-tone oak: the cream rim (about 0.5 luminance) is close to the hair and the oak (0.29), and the contour band does not reach the 1.0 px sample on the faceted hair shell (5 latitude rows, so the silhouette normals are far from square to the view) |
| Hair | pink | Oak | 1.93 | 1.55 | 62% | Same |
| Hair | grey | Oak | 2.08 | 1.60 | 59% | Same |
| Hair | platinum | Oak | 2.16 | 1.51 | 69% | Same |
| Hair | white | Oak | 2.21 | 1.58 | 69% | Same |
| Hair | ginger | Oak | 2.43 | 1.58 | 58% | Same |
| Hair | platinum | Linen wall | 2.66 | 1.08 | 54% | Pale hair against a pale wall; the contour is partial on the faceted shell (p10 1.08 means some stretches have no band) |
| Hair | platinum | Preview stage | 2.54 | 1.25 | 52% | Same |
| Torso and arms | cream outfit | Oak | 2.29 | 1.80 | 54% | Cream sleeve against mid-tone oak: rim and cream sleeve are both light, and the contour covers only part of the samples |

Passing but close: head on the runner for skin-09 (3.08) and head on the finale wall for skin-09 (3.90). Not measured: the doorway grazing-angle case, the dark hair against the ceiling at under 10 degrees pitch, the runner edge where the backdrop changes under one silhouette (spec 12.8.6), the builder preview at its larger size, WebKit and Firefox. The ceiling and the lit museum surfaces will differ from flat tokens.

**What the measurement changed.** (1) The first run found no light rim on any arm or shin: the 10-sided tubes have a flat facet, not a vertex, at the left and right of the figure, so the interpolated normal is 18 degrees off square to the view there and `ndv / fwidth` never reaches zero. Torso and arms on the dark backdrops measured 1.2 to 1.5. Going to 8 sides puts a vertex on each of the four sides; torso and arms now measure 4.3 to 7.2 on the dark backdrops. (2) The distance estimate is exact at a factor 0.5 on a smooth part and at 1.0 on a flat facet. I tried 0.5, 0.6, 0.65, 0.7, 0.75, 0.8 and 1.0 and kept **0.7**: it was the best compromise (0.5 and 0.6 leave the limbs 1.4 to 2.6 on light and mid backdrops, 0.75 and above start failing the head on the runner and the hair on every light backdrop).

### Files changed (CR-4)

Palette and look (step 1):
- `src/scene/materials/palette.ts`: `ceiling` `#30232b` and `lightGround` `#6a4a3c` (final; the drift test passes).
- `src/scene/materials/look.ts`, `look.test.ts`: typed mirror of every `--look-*` token, with a drift test (parses `tokens.css`, fails on a missing, extra or changed token). `index.ts` exports `LOOK`.
- `src/scene/characters/kit/palette.ts`, `palette.test.ts`: `SKIN_BLUSH_DEEP` and its drift test.

Edge and pattern (steps 2 and 4):
- `src/scene/shaders/avatarSurface/AvatarSurfaceMaterial.ts`, `avatarEdge.glsl`, `avatarPattern.vert.glsl`, `avatarPattern.frag.glsl`: the patched body and hair Lambert materials (edge, pattern, mask).
- `src/scene/characters/kit/pattern.ts`: the pattern ink rule (`patternInk`).

Kit:
- `rig.ts`: new materials, pattern uniforms, face-shape morph, `beginFaceShapeMorph`, `setMorphProgress`, `patternMix`, rebuild on face shape or hair style change, skirt leg scale.
- `proportions.ts`: `FACE_SHAPES`, `faceWarp`, `chinBottomY`, `blendFace`, `AvatarShape.face`, `shapeFor` reads `avatarFaceShape`.
- `geometry/partBuilder.ts` (head warp, `outfitMask`), `geometry/surface.ts` (cells, tube end shading and end colour).
- `colour.ts` (brow floor 3:1 with the warm lift, facial hair floor 1.6:1, trim helpers), `pose.ts` (amplitudes, breathing).
- `parts/face.ts` (eyes, catchlights, mouth, deep blush), `parts/hair.ts` (brows, hairlines table, crown and nape shading, facial hair colour), `parts/body.ts` (hairline and chin shading, neck shade, region trims, pattern cells, new styles), `parts/outfits.ts` (twelve garments, trims, collar clamp, `legScaleFor`).
- Tests: `cr4.test.ts` (new, 34 tests), `gender.test.ts`, `kit.test.ts`, `neutralSnapshot.testutil.ts` (re-baselined once, explicit timeouts).

Museum finish (step 6) and stage (step 7):
- `materials/worldMapping.ts`: wall dado, painted rail, contact darkening (12% base, 18% ceiling), wall-top cap colour; floor edge shadow; runner border band. `materials/geometry/walls.ts`: rose and oculus now face down, 0.06 by 1.2 m ceiling strip, wall cap builder. `geometry/frames.ts`: 8-triangle brass fillet, mount bevel shade. `geometry/decals.ts`: wash 1.6 times the frame height and behind the frame, frame and plinth contact shadows. `geometry/finale.ts`: podium side `--look-plinth-side`, scalable plinth. `museumMaterials.ts`: `ceilingDressing` with `setCeilingDressingOpacity`, `contactShadow`, wash alpha 0.18. `proceduralTextures.ts`: planks. `lighting.ts`: 2.5 and 1.15, `PREVIEW_STAGE_CSS`. `quality.ts`: `contactShadows` flag. `finish.test.ts` (new, 15 tests). `index.ts`: exports.
- `src/lib/avatars.ts`: the one list. **Note: it is `OUTFIT_STYLES_PENDING_KIT` in `src/lib/avatars.ts`, not in `avatarOptions.ts`; it is now empty.**
- `src/api/__tests__/avatarOptionalFields.test.ts`: one test asserted the gate ("hides the new styles"); I changed it to expect all 12. This is outside my folders; it is the minimum edit to keep `npm test` green, so the architect or QA may rewrite it.

### Decisions

- **Face and hairline changes are on all 12 styles; trims are colour only, except the new styles.** The six v1.0 styles have no added geometry: cuffs on short sleeves are a colour grade on the sleeve's last ring (`endColour`), hem trims are the lowest ring only (grading into the body over 18 mm), shoe and knee darkening are tube-end ring colours. A proof test shows every vertex outside the head and the limb tubes of the six v1.0 styles is bit-identical to the committed pre-CR-4 kit.
- **One re-baseline of the Neutral fingerprint** (NFR-29), for the deliberate face changes (eyes, catchlights, brows, mouth, hairline shading, face warp path) and the 8-sided limbs. Old golden: body `5af56628 1b2931b0 85a3a108 aa5bbd48`; new: `a3663f0e 3725789a d1d8b486 1e040752`, plus 12 new hair hashes (each hair mesh carries the brows). Two invariants kept: Neutral with no gender, no face shape and no pattern equals Neutral, Oval, Plain (tested for body and hair); and the vertices outside the head and limbs are the v1.0 vertices (`V1_NO_HEAD_GOLDEN`).
- **Arms, forearms and shins: 10 to 8 sides** (the measured fix above). Costs nothing visible at 360 px; saves 232 triangles.
- **Small face features and the badge get no edge** (`outfitMask` -1): without it every eye, nose, blush and brow was outlined.
- **Edge factor 0.7** (see above). Rim and contour widths follow the tokens (0.6 and 1.5 px times the pixel ratio).
- **Pattern period 40 mm for all three patterns** (the spec's dots were 36 mm): a single cell size keeps the angle round each part an exact even number of cells (torso 18, skirt 22, arm 8, leg 10), so checks and dots close seamlessly. Dots are staggered. Stripes run on height so they are continuous across sleeve and torso; checks and dots start afresh on each limb tube. The amplitude fades to flat under about 2.2 px (spec formula).
- **Pattern cross-fade is not animated by the kit.** `rig.patternMix` (0 to 1) is exposed; the scene can animate it over `--duration-fast`. Plain/other switches are instant by default. Reason: a kit-side clock needs a frame loop that an on-demand preview may not have.
- **Face shape values** (spec table, tuned inside 0.03): Long height 1.06 to 1.05 and chin 1.06 to 1.04, Heart chin 1.08 to 1.06 (the chin must clear the collar). The head top moves at most 10 mm (Long +8 mm, Round -5 mm). Neck collar rings are lowered under a longer chin (`clampCollars`), Oval unchanged. The label anchor is a constant above 1.70 m, higher than the tallest shape, so it never moves.
- **Brows:** floor 3:1 for every skin and hair pair (tested), warm lift toward `#b88a6a` then white if needed; lift angle 0.12 rad. Facial hair floor 1.6:1. Deep blush for luminance under 0.1 (skin-08 to 10).
- **Skirted styles swing the legs 10% less** (`legScaleFor`: dress, coat, tunic): at the full 28 degrees the thighs came through the dress hem by about 1 cm (measured), and would have come through the original straight tunic by several centimetres (estimated). Tested over the whole walk for 4 body types. Tunic is slightly A-line (hem 0.8, depth 1.0) for the same reason.
- **Walk and idle:** leg 28 degrees, arm 23, hip bob 3.7 cm, breathing 1.000 to 1.008 at 0.3 Hz on the spine (uniform, so the head swells 0.8%), head yaw 2 degrees at 0.12 Hz, arm sway 1.5 degrees at 0.3 Hz. `resetPose` is exactly 1, no breathing.
- **Museum finish in the shell shader, not geometry:** the scene builds walls, floors and the runner from plain boxes, so the dado, the painted rail, contact darkening and the wall-top cap colour are in `worldMapping.ts`. The floor edge shadow is baked there too, so it works on every tier with no decal (the spec had decal on Auto and vertex colour on Low). The finale walls get a deeper claret dado.
- **Wash:** the old decal sat 4 mm in front of the frame (z 0.054) and so covered the mount and the photo. It is now 4 mm off the wall, behind the frame, 1.6 times the frame height tall (FR-40, spec 12.8.3).

### Chunk size

976,550 B against 961,853 B (+14.7 kB). The ADR's 10 kB covered face shape, pattern and garments; the museum finish (shell shader, frame, decal and ceiling builders; roughly 4 kB, estimated) was not in that budget. Already trimmed: GLSL comments and indentation are stripped (saved 1.5 kB). Easy cuts if the target must hold: drop the finale dado variant and the ceiling strip builder (about 1 kB), or factor the six garment configs (about 1 kB, estimated).

### Open items and not done

- Armpit ambient darkening (the torso ring at the arm joint would band the chest) and the centre placket, zip and coat vent (need geometry, and would break the v1.0 vertex proof): not done.
- Region trim and separation rule: done as colours. The dark-sleeve trim uses 10% toward white in linear light (a straight 25% multiply of navy is invisible).
- Real phone, Safari and Firefox are unchecked; WebGL 1 fallback not shipped.
- Performance walk on Low and High with the worst pair: not run (performance optimiser).

### Requests for other agents (CR-4)

- **scene-developer:**
  1. Face shape and pattern: pass the whole avatar config to `rig.setAppearance` (it reads `faceShape` and `outfitPattern` through the accessors). In the builder preview, for a face-shape or gender change call `rig.beginFaceShapeMorph(to)` (or `beginGenderMorph`) before `setAppearance`, then drive `rig.setMorphProgress(t)` each frame for `--duration-gender-morph` (250 ms), before `applyPose`. One morph blends both. Skip under reduced motion. Optional: animate `rig.patternMix` 0 to 1 over `--duration-fast`.
  2. Ceiling roses and the finale oculus: `createCeilingRoseGeometry({ radius })` now faces down (origin at the ceiling surface, place at y = ceiling height; oculus: a larger radius). Draw with `materials.ceilingDressing` (from `createLookMaterials`) and each frame call `materials.setCeilingDressingOpacity(runtime.ceilingOpacity)`, the same value as the ceiling. It sets opacity, transparency, depth write and hides it under 0.02.
  3. Ceiling strips: `createCeilingStripGeometry()` (0.06 by 1.2 m, along local Z, faces down, origin at the ceiling), one per room along the route, with `ceilingDressing`. The lit part is `--look-ceiling-strip` and glows.
  4. Wall cap: the shell material already colours flat wall tops in the rail colour. For the real 0.06 m cap, merge `createWallCapGeometry(length, thickness)` (box 0.06 m tall, 1 cm proud each side, origin at the middle of the underside, length along X; rotate 90 degrees for a wall along Z) at y = wall height (3.2 m) along every wall top, one merged mesh with `materials.decor` (vertex colours). It sits above the ceiling plane, so it needs no fade.
  5. Dado rail: the painted rail is in the wall shader. For the real rail, merge a 0.05 m tall, 0.04 m deep strip (`DADO.railHeight`, `DADO.railDepth`) at y = 0.95 along the walls in `LOOK.dadoRail`, with `decor`: one merged mesh.
  6. Frames: `createFrameGeometry` now includes the fillet and the mount bevel (96 to 104 triangles); nothing to do. Contact shadow: for each frame place `createFrameContactShadowGeometry(photoW, photoH)` at the photo centre with `materials.contactShadow`, merged into one mesh (skip when `contactShadow` is null: Low). Wash: use `LOOK.washAlpha` (the `wallWash` material already does) and `createWallWashGeometry` as before; the geometry changed (taller, behind the frame).
  7. Finale: the podium side is now `--look-plinth-side`. Add a contact shadow under it with `createPlinthContactShadowGeometry(PODIUM.radius)` and `contactShadow` (not on Low). The builder plinth is `createPodiumGeometry({ radius })` with the `podium` material (ring glow through `uGlow`, active character brighter), and the stage backdrop is `PREVIEW_STAGE_CSS` on the canvas wrapper with a transparent canvas, or the flat `PREVIEW_BACKGROUND`.
  8. Lighting is already 2.5 and 1.15 in `MUSEUM_LIGHTING`. Walls, floor edge shadow, runner border and planks need nothing.
- **frontend-developer:** the list is empty, so the "Outfit style" group now shows 12 tiles in `optionIds('outfitStyle')`. The "More styles" split in design spec 12.5.3 needs your layout decision (the ids are in contract order). Face shape and pattern controls, labels and `describeAvatar` words are yours. I edited one architect test (above).
- **performance-optimiser:** sign off the worst character pair (5,682, not 6,500) on Low and High; the ADR 7.3a provisional ceiling lapses (step 5). Record the per-style table above in `docs/performance.md`.
- **product-manager and architect:** NFR-27 stays at 6,000 (worst measured 5,682, hard stop 5,950). Record the amendment to ADR 0021 7.3a: the 6,500 ceiling lapsed; A-29's `coat` is the cheapest new style, not the dearest.
- **qa-engineer:** visual diffs are expected (list in Checks). Re-run edge contrast with the lit museum, doorways, low pitch hair against the ceiling and the runner edge; the failures table is the starting list. The token comment for `--look-rim-px` may want a note that the shader scales the distance by 0.7.
- **ux-ui-designer:** `--look-*` tokens are mirrored unchanged. The shader factor 0.7 is a tuning, not a token.

### Checks (02/11/2026)

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass: 69 files, 1,043 tests (kit budget tests have `KIT_TEST_TIMEOUT` 120 s) |
| `npm run build` | Pass. `NameLabel-*.js` 976.55 kB |
| `VITE_API_MODE=mock npm run build -- --mode test`, then `PW_REUSE_SERVER=1 npx playwright test gender visual --project=desktop-chromium --workers=2` | 30 passed, 9 failed. Baselines were not re-recorded. Port 4173 untouched |

**Playwright failures, for QA.** None is a rendering error.
- Flaky, not a regression: `gender.spec.ts` "US-48 AC-1 and AC-3" failed once under load (the card said "Sam, photo 1 of 1: A day at the beach." where the baseline text was "Gallery 1 of 1") and passed when re-run alone.
- Baselines that changed by design or by other agents' work (CR-4 UI, not the kit): `visual: home screen` (92,984 px, 11%), `welcome screen` (image 512 x 464 to 512 x 520), `the finale card` (21%).
- Builder preview baselines: `preview-woman-man`, `preview-man-woman`, `preview-woman-man-back`, the restored-draft comparison (the same file) and `brows-woman-deep-skin`. The captured size changed (438 x 449 to 408 x 449) from the CR-4 builder layout, so they fail on size before the character pixels count. The characters also differ by design: bigger eyes with catchlights, thicker brows, a light and dark edge band, hairline and hem trims, deep-skin blush.
- Passed with the CR-4 kit: the entrance, the Guide presenting, the full-screen viewer, both Woman and Man entrance shots and the pre-v0.3 museum (their character pixels are small and stayed under the screenshot threshold).

## Summary
I built the museum look and the avatar kit entirely from code: no downloaded art, no GLB files and no HDR, so the look adds nothing to the first-view download. There are palette mirrors with token-drift tests, procedural textures, vertex-coloured geometry builders, three mobile-safe shaders, a materials factory, lighting, and a skinned "designer toy" avatar rig (three draw calls and at most 5,878 triangles per character). I also supplied two adapters (`buildAvatar` and `createSceneMaterials`) that match the scene-developer's `src/scene/seams.ts` shapes, plus the home and not-found SVG illustrations. My folders pass typecheck, lint and 38 unit tests, and `npm run build` succeeds. I checked renders in headless Chromium (software GL) only. Details are under Checks.

## QA round 3 update (30/10/2026): brows readable on every skin and hair colour

| Item | Detail |
|---|---|
| Cause | Brows were the hair colour (only very light hair was shaded 0.78). Black or dark-brown brows on `skin-09` and `skin-10` have a contrast ratio near 1.1 to 1.5, so they vanish at preview size. Man and Neutral looked alike because the brow sizes differ by under a millimetre and the colour hid them |
| Fix | New `browColour(hair, skin)` in `kit/colour.ts`, used by `addBrows` in `parts/hair.ts`. It keeps the hair colour when the WCAG-style contrast ratio against the skin (linear luminance, +0.05) is already at least 2.0 (`BROW_MIN_CONTRAST`). Otherwise it moves the colour just far enough: darker-than-skin hair is darkened, lighter hair is lightened. If that direction cannot reach 2.0 it uses the other one, so black brows on deep skin become a lighter warm brown and white brows on pale skin a soft grey-brown |
| Geometry | None changed. No mesh, part, segment or vertex added or moved, so triangles stay 5,878 of 6,000 (122 headroom) and Neutral's geometry is bit-identical. Only brow vertex colours change |
| Woman brow | Left at 0.90. Setting it to 1.00 (spec 9.7 fallback) would equal Neutral and break the spec 9.1 ordering test (Woman < Neutral < Man) and the 0.03 tuning test, so I held it back until the colour fix is judged by eye. If it is still too faint in the QA baseline, the next step is 0.95, then 1.00 with those two tests updated |
| Test | `kit/colour.test.ts`: all 10 skins by 11 hair colours must reach the minimum contrast, unchanged colour when contrast is already enough, hue and direction cases, inputs not mutated |
| Checks | `typecheck`, `test` (859 passed) and `build` pass. `lint` has 2 errors in `src/ui/builder/AvatarPreviewSlot.tsx` (not my folder, in the scene-developer's or frontend's in-progress work); kit lint is clean |
| Not verified | I could not run Playwright (port 4173 was already in use by another process), so I have not seen the new pixels |

Baselines expected to change (colour only; not regenerated by me, since `tests/` is QA's):
- `brows-woman-deep-skin` (intended).
- Any baseline showing a face where hair-to-skin contrast is under 2.0: white, platinum, grey or blonde hair on pale skin (`skin-01` to `skin-03`), and black, dark-brown, brown or auburn hair on `skin-07` to `skin-10`. Brow pixels are a few per face, so small diffs may sit inside the screenshot threshold, but entrance, builder and any closer shot with such a pairing could trip it. Baselines with a mid skin and mid hair are unaffected. QA should run the visual suite and regenerate those that fail after checking by eye.
- The Neutral fingerprint test covers geometry and still passes.

### BUG-6 fix in `kit/rig.ts` (applied on the coordinator's request)
Root cause (traced by the scene-developer): `refreshBones` called `root.updateMatrixWorld(true)` then `skeleton.calculateInverses()`, and `updateMatrixWorld` uses the parent's `matrixWorld`, so the bone inverses (and `SkinnedMesh.bind`'s bind matrix) baked in the parent's offset and turn. A rebuild under a parent then drew the body displaced. My earlier reading below missed that the inverses, not `root.position`, were the problem.
Fix: a local `withoutParent` helper detaches `root.parent` (restored in `finally`) around the matrix update plus `calculateInverses` in `refreshBones`, and around `mesh.bind(skeleton)` in `makeSkinned`. Bind matrices no longer depend on placement. `previewAvatar.ts` is untouched; its own detach is now redundant but harmless. Geometry, budgets and Neutral output are unchanged.
Test: `gender.test.ts`, "bind pose does not depend on the parent transform": a rig under an offset, rotated, scaled parent; after a gender plus body-type `setAppearance`, and after a morph frame, bone inverses and the bind matrix equal those of a fresh rig built unparented. It fails on the old `rig.ts` and passes now (862 tests).
Woman brow stays at 0.90 until QA reviews the new pixels.

### Earlier analysis for BUG-6 (superseded by the fix above; does `setAppearance` reset the rig root position?)
Reading `kit/rig.ts`, `setAppearance` never writes `root.position` or `root.rotation`. It does three things that can look like a placement change:
1. On a gender, morph or body-type change it calls `root.scale.setScalar(1)`, then `refreshBones()`, and ends with `refreshScale()`, which sets the height scale again and calls `root.updateMatrixWorld(true)`. In between, scale is 1, so anything that reads the root or a bone world position during that window sees the wrong height (feet stay put; the head does not).
2. `refreshBones()` rewrites the hips bone `position` as an absolute joint position in root space (parent is `[0,0,0]`), so hip height changes with gender and body type. Any code that holds or copies the hips bone position, or measures the avatar by the hips bone, will see it jump.
3. `updateMatrixWorld(true)` uses the parent's world matrix. `previewAvatar.ts` already works around this with `withoutParent`; a caller that sets `setAppearance` while the root is parented under a moving or offset group will see the world matrix recompute, not a reset.
So if the preview slot's avatar lands at the origin or at the wrong spot after a change, check the caller (a re-created rig, or re-parenting in `withoutParent`) before `rig.ts`. I have not run it to confirm.

## CR-1 update (30/10/2026): gender in the avatar kit

Woman, Man and Neutral (`feminine`, `masculine`, `neutral`) are in the kit. Neutral is exactly 1.00 everywhere and is vertex-identical to the v1.0 output (bit-exact fingerprint test). The three genders share one topology: the worst character is still 5,878 of 6,000 triangles, with 3 draw calls, so the 122-triangle headroom is untouched. The kit grew the three.js chunk (`NameLabel-*.js`) from 968,836 to 970,705 bytes (+1.9 kB minified, +0.8 kB gzip) against the 8 kB limit, and 970.70 kB is still under the 1,000 kB warning. No new three.js classes are imported.

### How the shape is built
| Piece | Where | What it does |
|---|---|---|
| `GENDER_SHAPES` | `proportions.ts` | Multipliers from design spec 9.1: shoulder, waist, hip, chest depth, neck, limb thickness, torso length, jaw, brow, eye |
| `shapeFor(config)`, `composeShape` | `proportions.ts` | Reads gender with `avatarGender(config)` (missing or unknown is Neutral), multiplies body type on top. Every builder takes the resulting `AvatarShape` (a new optional last argument, so old calls still work) |
| Torso and limbs | `parts/torso.ts`, `parts/body.ts`, `proportions.ts` | Rings, arm pivots, hip joints, neck radius and mitten hands read the composed multipliers. Chest depth scales `rz` only, so the width never changes. Outfits, sleeves, the dress skirt and the badge follow because they are built from the same rings |
| Torso and leg length | `heightWarp` in `proportions.ts`, applied in `PartBuilder.add` and `jointsFor` | A vertical remap of existing vertices and joints. The leg multiplier is derived (`legs = (0.78 + 0.55 (1 - torso)) / 0.78`), so total height is identical for all three. Everything from the neck base up (head, hair, label anchor) does not move |
| Jaw | `jawScale` in `proportions.ts`, applied in `PartBuilder.add` to every part skinned to `head` | Displaces the x of existing vertices below the head equator, easing from 1.00 at the equator to the jaw value at the chin. Hair caps, facial hair, ears and features are warped by the same function, so beards follow the jaw and cannot float or clip |
| Eyes and brows | `parts/face.ts` (`eyeSize`), `parts/hair.ts` (`addBrows`) | Eye and eye-white radii by the eye multiplier, brow thickness by the brow multiplier. The mouth, nose and blush are the same on all three |

Neutral skips every warp (`jaw === 1`, `torso === 1`), so its vertices are untouched.

### Values tuned from the spec (all inside the 0.03 allowance)
| Value | Spec | Built | Why |
|---|---|---|---|
| Woman shoulder | 0.95 | **0.945** | The spec limit for Slim Woman shoulders is 0.34 m, which allows no lower. On the real mesh (shoulder row of the whole silhouette over the hip row of the torso) Woman to Neutral was 8.7% apart, short of the 10% rule |
| Woman hip | 1.06 | **1.07** | Same reason. Woman with Wider hips is 0.3595 m, under the 0.36 m limit |
| Man shoulder | 1.07 | **1.08** | Keeps Neutral to Man above 10% on the real mesh. Man with Wider shoulders is 0.497 m, under 0.50 m |

Result: neighbouring shapes are 10.1% to 12.2% apart on the real mesh for all four body types (spec numbers: 11.6% and 11.3%). Nothing is tuned beyond 0.03.

### Preview morph API (for the scene-developer)
Preview only. The visit calls `setAppearance` with the final gender and builds the final shape once. Reduced motion does the same.

```ts
rig.beginGenderMorph(to: AvatarGender, from?: AvatarGender): void;
rig.setGenderMorphProgress(t: number): boolean;   // returns true while still morphing
rig.morphing: boolean;                            // read-only
```

Flow in the builder preview, when only the active character's gender changed:
1. `rig.beginGenderMorph(nextGender)`. This rebuilds nothing. It records the shape on screen now as the start (if a morph is running, that is the blended shape, which is how retargeting works, with no queue).
2. `rig.setAppearance(nextConfig)` with the new gender in it, as usual. A `setAppearance` whose gender equals the morph target keeps the morph running. The shape stays at the start until step 3. Every other field in `nextConfig` applies at once, including mid-morph changes to hair, outfit or skin.
3. Each frame, before `rig.applyPose(...)`: `rig.setGenderMorphProgress(elapsedMs / 250)` (with reduced motion, skip steps 1 and 3 and call only `setAppearance`). It clamps `t` to 0 to 1, blends every gender parameter linearly, and rebuilds the bind pose, body and hair meshes in place. The rig, meshes, bones, skeleton and materials are the same objects, and the body never shows an unclothed, hairless or empty frame. At `t >= 1` it ends on the exact table values: the result is vertex-identical to `setAppearance` with that gender (tested by hash), `morphing` becomes false and the call returns false.

Rules:
- Call `setGenderMorphProgress` **before** `applyPose` in the frame. A rebuild resets the bones to rest and applyPose then poses them. The rig also now uses a gender-specific hip rest height inside `applyPose`, so do not hard-code 0.78 (the old `HIP_REST_Y` export is no longer used by the rig).
- If you called `setAppearance` first by mistake, pass the old gender as `from`: `beginGenderMorph(to, from)`.
- A `setAppearance` with a gender other than the running target cancels the morph and jumps to that gender.
- `useAvatarRig` is unchanged: it calls `setAppearance` on every config change, which jumps. For the animated preview call `beginGenderMorph` just before that effect (for example in the same effect, ahead of `rig.setAppearance`), or use `createAvatarRig` directly.
- Cost: one frame is a body plus hair rebuild of the active character, about 1 to 2 ms in Node on the heaviest character (15 frames took about 17 ms). The 250 ms morph is about 15 frames. Measure on a phone: not done. Do not run it on both characters.
- `rig.config.gender` is the target as soon as step 2 has run. `rig.height` and `labelAnchor` never change with gender, so label placement is stable during the morph.

### Tests added (`gender.test.ts`, `neutralSnapshot.testutil.ts`)
- Neutral equality: bit-exact hashes of position, normal and index for 16 groups (4 body types across all outfits, both roles, two skins, three facial hair styles; 12 hair styles across two hair colours, two skins, all facial hair), taken from the kit before CR-1. Run with no gender and with `neutral`; an unknown stored gender also equals Neutral.
- Budget: every gender x body type x outfit x role x skin (`skin-01`, `skin-10`) x facial hair for the body mesh, and every gender x hair style x skin x facial hair for the hair mesh. The character total is body plus hair plus the 2-triangle shadow, so checking the two lists is exhaustive. Asserts at most 6,000 triangles (worst is exactly 5,878), identical counts across the three genders for every combination, 3 draw calls, and `rig.stats` equal to the sum.
- Width limits for the 12 gender x body type combinations (shoulders 0.34 to 0.50 m, hips 0.26 to 0.36 m), the table ordering, the 0.03 tuning cap, identical total height, and the 10% silhouette separation (spec numbers, real mesh, and a 120 px snapped version).
- Clipping and fit: hair against the back of the torso for all 12 hair styles x 12 shapes (never buried, and within 6 mm of Neutral's gap); beard, stubble, goatee and moustache against the displaced jaw for all genders x 12 hair styles; arms attached and neck inside the collar for all 12 shapes; the badge on the chest for all 6 outfits x 12 shapes; finite, bounded vertices for every gender x outfit x height with curvy and braids.
- Rig: a gender change rebuilds the bind pose, body and hair (and a non-gender change leaves the hair alone); any path of `setAppearance` calls ends vertex-identical to a fresh rig; the hip rest height follows the gender.
- Morph: nothing before `begin`; no new meshes, bones or materials; start, middle and end; monotonic vertices; retarget from the blend; other changes mid-morph; a different gender cancels; reduced motion path; explicit `from`; per-frame cost bound.
- `kit.test.ts`: the `describeAvatar` expectation now matches the scene-developer's 9.4 template (facial hair before the outfit).

### Not verified (CR-1)
- **No render this round.** I did not look at the new faces or silhouettes. The 120 px silhouette check is geometric (a measured silhouette width, snapped to a 120 px figure), not an image comparison. Someone should look at all three genders from the front and back in the builder preview.
- Design spec 9.7: Woman brows in black or dark brown on `skin-09` and `skin-10`. The brow is 0.90 of Neutral (about 11.7 mm tall), which is about 0.8 px at 120 px, against 0.9 px for Neutral. Judge it by eye at the preview's default size. If it does not read, set `GENDER_SHAPES.feminine.brow` to 1.00 (one number, no other change).
- Outfit fit (216 combinations) is verified by construction (garments, sleeves, the dress skirt and the badge are built from the same ring and joint functions as the body) plus the badge, arm and hair tests above, not by a mesh-to-mesh intersection test. The hair curtains (`long-straight`, `long-wavy`, `braids`) already sink into the sides of the shoulders in v1.0 and still do, by the same amount.
- Pose and walk cycle with the Man and Woman shapes were not run in a browser.

## Assets (file size and triangle count)

No models or textures are shipped as files. The textures are generated at runtime into `DataTexture`s, so nothing is downloaded for them.

| Asset | Where | Size | Triangles |
|---|---|---|---|
| Home illustration | `public/textures/illustrations/home.svg` | 5.8 kB (limit 20 kB) | n/a |
| Not-found illustration | `public/textures/illustrations/not-found.svg` | 3.7 kB (limit 20 kB) | n/a |
| Avatar, default Guide | code (`createAvatarRig`) | n/a | 4,618 |
| Avatar, default Visitor | code | n/a | 4,404 |
| Avatar, all 1,440 hair, outfit, facial hair and body combinations | code | n/a | 4,274 to 5,750 (worst: curly-short, suit, full-beard, slim) |
| Wall run, 10 m, no doorway | `createWallRunGeometry` | n/a | 24 |
| Wall run, 8 m with one doorway, lintel and architrave | `createWallRunGeometry` | n/a | 96 |
| Floor plane, ceiling plane | `createFloorGeometry`, `createCeilingGeometry` | n/a | 2, 12 |
| Runner, 64 m with semicircle end | `createRunnerGeometry` | n/a | 150 |
| Frame (walnut rim and cream mount) | `createFrameGeometry` | n/a | 96 |
| Picture light | `createPictureLightGeometry` | n/a | 84 |
| Ceiling rose / oculus | `createCeilingRoseGeometry` | n/a | 160 |
| Podium, lectern, light cone | `createPodiumGeometry`, `createLecternGeometry`, `createLightConeGeometry` | n/a | 392, 84, 56 |

Procedural textures (GPU memory, RGBA8, mipmaps add about a third):

| Texture | Size (high / low quality) | Tile |
|---|---|---|
| Oak boards | 256 x 512 / 128 x 256 | 0.8 m across by 1.6 m along |
| Finale dark floor | 256 x 512 / 128 x 256 | same |
| Linen weave | 256 x 256 / 128 x 128 | 1.2 m |
| Runner pile | 128 x 128 / 128 x 128 | 0.8 m |

A 20-picture museum built as recommended is about 40,000 triangles or fewer (the test asserts this), against the 150,000 budget. The draw call estimate, with merging, is under 40.

No source files existed in `assets/source/` (the folder does not exist), so there was nothing to convert. `public/models/` and `public/env/` are empty (`.gitkeep` only).

## Files changed

All paths are under `/Users/prakashrajan/Documents/boringTask/surprise`.

**Scene palette and materials (`src/scene/materials/`)**
- `palette.ts`, `palette.test.ts`: typed `SCENE_PALETTE` and `BLOB_SHADOW`, with a test that parses `tokens.css` and fails on drift.
- `quality.ts`: `GraphicsQuality` (`'low' | 'high'`) and what each tier switches off.
- `lighting.ts`, `environment.ts`, `MuseumLighting.tsx`: lighting values, tone mapping, a generated warm environment map, and the `MuseumLighting`, `PreviewLighting` and `SceneLights` components.
- `proceduralTextures.ts`: oak, finale floor, linen and runner pile.
- `glowMaterial.ts`: vertex-glow patch for Lambert and Standard (lit strips, lamp discs, podium ring).
- `worldMapping.ts`: world-space mapping and baked-looking shading for flat meshes.
- `museumMaterials.ts`: `createMuseumMaterials(quality)`, the full-look materials factory.
- `sceneMaterials.ts`: `createSceneMaterials(quality)`, drop-in for the scene's role-based `MuseumMaterials` shape.
- `MuseumMaterialsContext.ts`, `MuseumMaterialsProvider.tsx`: optional React wiring.
- `plaqueTexture.ts`: canvas textures for the title plaque and numbered plaques, plus `wrapLines`.
- `geometry/*.ts`: builders for walls, ceiling, floor, runner, frames, picture lights, plaques, podium, lectern, cone, motes, and decals.
- `index.ts`: barrel export.
- Tests: `materials.test.ts`, `sceneMaterials.test.ts`.

**Shaders (`src/scene/shaders/`)**
- `glowDecal/`, `lightCone/`, `dustMotes/` (each with `.vert.glsl`, `.frag.glsl` and a material class), and `index.ts`.

**Avatar kit (`src/scene/characters/kit/`)**
- `palette.ts`, `palette.test.ts`: typed `--avatar-*` mirror, keyed by the contract's option ids, with a drift test.
- `options.ts`: labels, defaults (design spec 9.3) and `describeAvatar`. Pure TypeScript.
- `proportions.ts` (gender table, `shapeFor`, `heightWarp`, `jawScale`), `pose.ts`, `rig.ts` (gender rebuild and morph API), `useAvatarRig.ts`, `sceneAvatar.ts`, `index.ts`.
- CR-1 edits: `geometry/partBuilder.ts` (jaw and height warps), `parts/torso.ts`, `parts/body.ts`, `parts/face.ts`, `parts/hair.ts`.
- `geometry/surface.ts`, `geometry/partBuilder.ts`, `colour.ts`.
- `parts/torso.ts`, `parts/outfits.ts`, `parts/body.ts`, `parts/face.ts`, `parts/hair.ts`.
- Tests: `kit.test.ts`, `sceneAvatar.test.ts`, `gender.test.ts`, `neutralSnapshot.testutil.ts` (CR-1).

**Illustrations and docs**
- `public/textures/illustrations/home.svg`, `public/textures/illustrations/not-found.svg`.
- `docs/handoffs/technical-artist.md`: this note.
- I removed the `.gitkeep` files in `src/scene/materials`, `src/scene/shaders`, `src/scene/characters/kit` and `public/textures`.

## How to use it

### 1. Fastest path: swap the seams (three lines)

`src/scene/seams.ts` is the scene-developer's file, so this is a request (see below). It changes to:

```ts
export { createSceneMaterials as createMuseumMaterials, type SceneMuseumMaterials as MuseumMaterials }
  from './materials/sceneMaterials';
export { SceneLights } from './materials/MuseumLighting';
export { buildAvatar } from './characters/kit/sceneAvatar';
```

- `createSceneMaterials` works on the existing flat boxes and planes. Textures tile in metres, walls shade towards the ceiling with a painted skirting, and the runner gets brass edge lines, all in the shader (`worldMapping.ts`).
- `pool` becomes a `GlowDecalMaterial` that works with the existing instanced pools (intensity is `instanceColor.r`, and the scene's 0 to 0.45 maps to 0 to 1). The `MuseumMaterials.pool` type must be widened from `MeshBasicMaterial` to `Material`.
- `buildAvatar` returns the scene's `AvatarRig` shape. `torso` and `chest` both map to the spine bone, `kneeL` and `kneeR` to the shin bones, and `hipHeight` is 0.78 in rig space. Left and right are anatomical (left is +X), so the presenting arm is the character's right arm (-X). I verified this in a real GL context with plain box geometry.

### 2. Full look: geometry builders and `createMuseumMaterials`

```tsx
const materials = useMemo(() => createMuseumMaterials('high'), []);   // or <MuseumMaterialsProvider>
useFrame((s) => materials.update(s.clock.elapsedTime));

// One wall run per wall, doorways cut and architraved. One material, one draw call when merged.
const wall = createWallRunGeometry({ length: 10, doorways: [{ centre: 0 }] });
<mesh geometry={wall} material={materials.wall} position={[-4, 0, -5]} rotation-y={Math.PI / 2} />

// Frames: z = 0 is the wall surface, +Z faces the room, origin at the photo centre.
const frames = mergePlaced(createFrameGeometry(pw, ph), placements);        // all frames, one draw call
const lights = mergePlaced(createPictureLightGeometry(pw, ph), placements);
<mesh geometry={frames} material={materials.decor} />

// Photos: unlit, never tone mapped (FR-40).
<mesh geometry={createPhotoGeometry(pw, ph)} material={materials.createPhotoMaterial(texture)} />

// Standing-spot pools: one mesh, per-pool intensity.
const batch = new DecalBatch(slots.map((s) => ({ position: [s.x, POOL.lift, s.z], width: 1.6, depth: 1.2 })), 'floor');
batch.setIntensity(i, 0.4 + 0.6 * proximity); batch.commit();            // once per frame
<mesh geometry={batch.geometry} material={materials.floorPool} />

// Finale (skip cone and motes when materials.cone / materials.motes are null, i.e. low quality).
<mesh geometry={createPodiumGeometry()} material={materials.podium} />
materials.podium.uGlow.value = 1 + 0.8 * enterLevel;                      // ring brightens over 300 ms
```

Mount `<MuseumLighting quality="high" />` (or `<SceneLights />`) once inside the Canvas. It sets Neutral tone mapping, a warm hemisphere light, one warm key light, and at high quality a generated environment map. There are no shadow maps. The builder preview uses `<PreviewLighting />` on a `PREVIEW_BACKGROUND` backdrop (neutral, slightly cool).

Title plaque (browser only): `createTitlePlaqueTexture({ eyebrow: 'A private view', title, forLine: 'For Sophie', curatedLine: 'Curated by Tom' })` with `createPlaqueGeometry(1.1, 0.8)`. It redraws once `document.fonts.ready` resolves.

### 3. Avatars

```ts
import { createAvatarRig, DEFAULT_GUIDE_APPEARANCE, describeAvatar } from '@/scene/characters/kit';

const rig = createAvatarRig(config, { role: 'guide' });   // AvatarConfig comes from @contract
scene.add(rig.root);                                      // feet at root.position, faces +Z at heading 0
rig.applyPose({ walkPhase, walkAmount, idleTime, present, lookYaw });
rig.resetPose();                                          // still pose (reduced motion)
rig.setAppearance(next);                                  // rebuilds only what changed; a gender change shows the final shape at once
rig.beginGenderMorph('feminine'); rig.setGenderMorphProgress(t); // preview-only morph, see CR-1 update
rig.setOpacity(0.35);                                     // yield and relocate fades
rig.labelAnchor;                                          // Object3D 0.35 m above the head, scaled with height
rig.stats;                                                // { triangles, drawCalls }
rig.dispose();
```

React: `const rig = useAvatarRig(config, { role })` creates once, syncs `config` and disposes on unmount.

Rig facts:
- Skinned, with 13 rigid bones (hips, spine, neck, head, hairBack, armL, forearmL, armR, forearmR, legL, shinL, legR, shinR). The `hairBack` bone lets ponytails, braids and long hair swing.
- Bones are exposed as `rig.bones`, so the scene can drive them directly, as the existing `CharacterView` does.
- Positive X rotation swings a hanging limb backwards (right-handed rotation). The raised presenting arm uses a negative X rotation.
- `applyPose` follows architecture 6.7: legs swing about 25 degrees, arms counter-swing about 20, hips bob 3 cm peak to peak.
- Body: one skinned mesh (head, face, garments, limbs, hands, shoes, badge). Hair: one skinned mesh (hair, brows, facial hair). Plus an optional blob-shadow mesh. That is at most 3 draw calls.

Hair styles are designed back-first. All ten skin tones, 12 hair styles, 11 hair colours, 6 outfits in 12 colours, 4 body types, 3 heights and 5 facial hair options are implemented. Eye whites appear only on the three deepest skin tones, so the eyes stay visible there. The Guide has the brass badge and the Visitor the cream heart sticker, both on the left chest.

### 4. Illustrations
Both are decorative and use no text. Reference them as plain images with an empty `alt`:

```tsx
<img src={`${import.meta.env.BASE_URL}textures/illustrations/home.svg`} alt="" width={480} height={360} />
<img src={`${import.meta.env.BASE_URL}textures/illustrations/not-found.svg`} alt="" width={480} height={360} />
```

They are served from the app's own origin (CSP `img-src 'self'` is satisfied). The viewBox is 480 x 360. They are not in `src/ui`, because the UI may not import from `src/scene`, and `public/textures/` is one of my folders.

## Shader uniforms and ranges

| Material | Uniform | Range (default) | Notes |
|---|---|---|---|
| `GlowDecalMaterial` | `uColor` | colour (`#ffd9a0`) | additive for light, normal blend for shadows |
| | `uOpacity` | 0 to 1 (0.3) | peak alpha; wash 0.17, pool 0.3, blob 0.35 |
| | `uPower` | 0.5 to 6 (2) | falloff sharpness |
| | `uSquare` | 0 to 1 (0) | ellipse to rounded rectangle |
| | `uTopBias` | 0 to 1 (0) | wall wash fades down from the picture light |
| | `uInstanceGain` | 0.5 to 4 (2.2) | instanced use only |
| `LightConeMaterial` | `uOpacity` | 0 to 0.2 (0.09) | design spec 8 to 10% |
| | `uGlow` | 1 to 2 (1) | R2 "all viewed" highlight; `setGlow()` |
| `DustMotesMaterial` | `uTime` | seconds | `materials.update(t)` drives it |
| | `uMotion` | 0 or 1 (1) | `setReducedMotion(true)` sets 0; also hide the mesh |
| | `uSize` | metres (0.03), `uOpacity` 0 to 0.6 (0.35) | at most 40 points |
| Vertex glow (`applyVertexGlow`) | `uGlow` | 0 to 2 (1) | `materials.podium.uGlow.value` |

All fragment shaders use `mediump`, no loops and no texture reads. Additive output skips tone mapping and uses interleaved-gradient dither to avoid banding. Reduced motion: only the dust motes animate, and there is a static fallback (hide them). No `leva` controls were added, because `leva` is not a dependency.

## Decisions
- **Procedural, not GLB:** ADR 0008 forbids downloaded art, and the surfaces are low-contrast and tiling. A generated texture costs no bytes on the wire, is deterministic (preview equals published) and also runs in Node tests.
- **Neutral tone mapping, not ACES:** ACES shifts warm creams and skin tones. Neutral keeps mid-tones close to the token colours, which matters for the ten skin tones. Photos are `toneMapped: false`.
- **Vertex colours plus a few materials:** the wall gradient, skirting, frame colours and runner brass come from vertex colours, so a handful of materials covers the museum and each can be merged to one draw call.
- **Skinned rig with rigid weights, not a Group hierarchy:** it fits the whole figure in two meshes (1 draw call each), against about 10 for a hierarchy of parts. Rigid weights suit the toy look and cost almost nothing in the vertex shader.
- **Lambert for most surfaces:** Standard is used only for floors and brass at high quality. Low quality is Lambert only, with half-size textures, no environment map, no cone and no motes (design spec 1.5).
- **Spine and hips twist kept to about 2 degrees:** a larger counter-twist pushed the trouser shell through the shirt hem at the waist when walking.
- **Pure `options.ts`:** labels, defaults and `describeAvatar` have no three.js or React, so they can move to `src/domain/` unchanged.

## Assumptions
- A graphics-quality setting (`'low' | 'high'`) will exist in the settings store. I defined the type, and the scene-developer or frontend-developer supplies the value.
- The runner is centred on x = 0 and runs along -Z (architecture 6.1), which `worldMapping.ts` relies on for the brass edge lines.
- The character's right arm presents (architecture 6.7). The scene's placeholder labelled sides by screen position, so its "R" arm was on the character's left.
- Glasses and hats (Release 2) are accepted in the config but not drawn.
- The Guide's badge slot for a face photo (FR-21, Could) is not built.
- 1.55 m, 1.70 m and 1.85 m are the height targets, so the 0.91, 1.00 and 1.09 scales apply to a 1.70 m figure with hair.

## Checks
- `npm run typecheck`: passes.
- `npm run build`: passes (the illustrations are copied to `dist/textures/illustrations/`).
- `npm run lint`: **my folders are clean.** The full run reports 3 errors in other agents' files: `src/scene/objects/Museum.tsx:3` (type-only import style), `src/scene/controllers/SceneDriver.tsx:60` (`react-hooks/refs`, a ref written during render) and a repeat of the `SceneDriver.tsx` error. Earlier in my session `src/ui/components/RadioGroup.tsx` and `Tabs.tsx` also failed lint, but they no longer appear.
- `npx vitest run`: 38 tests across 6 files pass in my folders, including the token drift tests, the 6,000-triangle and 10-draw-call budget across all hair, outfit and facial hair combinations, face winding, doorway dimensions, frame dimensions (0.06 m border, 0.05 m depth), runner width and length, and decal intensity.
- **Visual verification:** headless Chromium with software GL (SwiftShader). I rendered all hair styles front and back, all outfits and body types, all ten skin tones, a walking and presenting pose, the gallery room, the finale room (cone, motes, podium, lectern, runner end) and the adapter path on flat boxes. No shader compile errors were logged.

**Not verified:**
- Safari, Firefox and a real mobile GPU. Mobile cost is reasoned from the shader design (mediump, no loops) and has not been measured.
- The React components `MuseumLighting`, `PreviewLighting`, `SceneLights`, `MuseumMaterialsProvider` and `useAvatarRig` are type-checked and linted but not mounted in a running R3F canvas. The underlying lighting values and factories were rendered through plain three.js.
- `plaqueTexture.ts` canvas drawing was not rendered. Only the text-wrapping function is unit-tested.
- The 120 px "reads at a glance" test for hair styles was done by eye on full-size renders.
- 30 FPS on a mid-range phone (NFR-1). That needs the performance-optimiser's reference device.

## Open questions
- Should "lower graphics" be a Visitor setting, an automatic device-tier decision, or both? (scene-developer and ux-ui-designer)
- Eye whites appear only on the three deepest skin tones, and the blush token (`rgba(229, 143, 176, 0.32)`) reads purple-pink on the deepest tones. Is that acceptable, or should the designer supply a deep-skin blush and eye treatment? (ux-ui-designer)
- Hat and glasses are Release 2. Should the kit build them now, so the contract fields are not silently ignored? (product-manager)

## Requests for other agents
- **scene-developer**
  - Apply the three-line seam swap above, and widen `MuseumMaterials.pool` to `Material` (it is a shader material now).
  - Call `materials.update(elapsed)` once per frame (or mount `MuseumMaterialsProvider`) if you use `createMuseumMaterials`, and call `setReducedMotion(isReducedMotion())`.
  - Pass photo materials through `materials.createPhotoMaterial(texture)`, or set `toneMapped: false` on your own, so photos are never tone mapped.
  - To get the full look, replace `buildMuseumShell` with `createWallRunGeometry` (one per wall, doorways cut and architraved), `createFloorGeometry`, `createCeilingGeometry` and `createRunnerGeometry({ end: 'semicircle' })`. Add frames with `createFrameGeometry` and `createPictureLightGeometry` merged via `mergePlaced`, wall washes via `createWallWashGeometry`, ceiling roses, the finale podium, lectern, cone and motes, the title plaque texture, and the presentation ring (`createFloorRingGeometry` with `materials.presentationRing`).
  - Host `describeAvatar`, `DEFAULT_*_APPEARANCE` and the option labels where the UI can reach them (see the frontend-developer request). I wrote them in `src/scene/characters/kit/options.ts` as pure TypeScript. You own `src/domain/`, so the simplest move is to copy that file to `src/domain/characters/avatarOptions.ts` and re-export from the kit.
  - Minor, in your placeholder: `hipHeight` is `0.92 * scale` while `hips` sits inside the scaled group, so the bob is applied in the wrong units. My adapter returns the unscaled rig-space height (0.78). Also the comment in `animation.ts` says a positive angle swings a limb forward; with right-handed rotation about +X it swings it backward. The motion is symmetric, so nothing breaks.
  - Fix the two lint errors in `Museum.tsx` and `SceneDriver.tsx`.
- **frontend-developer**
  - Use the illustrations via `<img src={`${import.meta.env.BASE_URL}textures/illustrations/home.svg`} alt="" />`, and the same for `not-found.svg`.
  - The builder preview needs `describeAvatar`, defaults and labels. The UI cannot import `@/scene`, so use the pure copy in `src/domain/characters/` once the scene-developer adds it, or import it by relative path if the lint rule is relaxed.
  - Supply a graphics quality value (`'low' | 'high'`) from `settingsStore` to the scene.
  - Builder preview canvas: use `<PreviewLighting />`, `PREVIEW_BACKGROUND`, and `useAvatarRig` or `createAvatarRig` for the two characters.
- **ux-ui-designer**
  - A change to any `--scene-*` or `--avatar-*` token will fail the drift tests until `palette.ts` in `src/scene/materials/` and `src/scene/characters/kit/` is updated to match. Please tell me (or the next technical-artist) when a token changes.
  - See the deep-skin open question above.
- **architect**
  - `tsconfig.app.json` sets `types: ["vite/client"]`, and Vitest blanks CSS `?raw` imports, so my drift tests read `tokens.css` with `node:fs` via a `/// <reference types="node" />` directive. If you prefer, add `node` to the test types. No action needed otherwise.
- **qa-engineer**
  - Please run the preview and Visit screens in Safari, Firefox and a real phone, and confirm no shader warnings. Check the finale light cone and dust motes at low quality (they should be absent).
  - Check the brass badge and heart sticker are visible on the default Guide and Visitor at 120 px tall.
- **performance-optimiser**
  - The tuning knobs are `GraphicsQuality` (`QUALITY_FEATURES`), texture scale, dropping the environment map, and merging frames, picture lights and washes with `mergePlaced`.
  - The avatar triangle ceiling is 5,878 against a 6,000 budget (122 spare, ADR 0020 section 7), so there is little headroom if outfits grow. The three.js chunk is 970.70 kB against the 1,000 kB warning.
  - The gender preview morph rebuilds the active character's body and hair meshes each frame for 250 ms (about 1 to 2 ms in Node). Please measure it on the reference phone.
- **scene-developer (CR-1)**
  - Use the preview morph API under "CR-1 update" for the 250 ms gender change in the builder preview (reduced motion: `setAppearance` alone). Call `setGenderMorphProgress` before `applyPose`, and do not hard-code the hip rest height 0.78. The visit and the Visitor preview build the final shape with `createAvatarRig(config)` or `setAppearance`, so they never morph.
  - `useAvatarRig` always jumps on a gender change. Either call `rig.beginGenderMorph(next.gender)` before its `setAppearance` effect runs, or move the preview to `createAvatarRig` and drive it yourself. I did not touch the hook's call order because `src/scene/` views are yours.
- **qa-engineer (CR-1)**
  - Visual regression: Neutral must match the existing baselines. All three genders, front and back, with at least `long-wavy`, `braids`, `afro`, a full beard, `dress` and `suit`, and the deepest skin tone with black hair.

