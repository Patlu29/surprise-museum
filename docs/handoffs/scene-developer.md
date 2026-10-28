# Handoff: scene-developer

## Summary
I built the pure domain layer (layout, collision, navigation, presentation director, Guide AI, character sources and registry, camera maths, animation maths, photo load queue) with unit tests, including the NFR-26 30-minute soak, and the R3F scene on top of it: museum, frames, characters with name labels, follow camera, nearest-first photo loading, screen-rectangle output, replay, jump, hint and Playwright test hooks. I checked it end to end in headless Chromium and WebKit (iPhone) through the real `VisitExperience`: welcome, Start, presentation, finale, jump, replay, dismiss, reduced motion, a full route walk, React StrictMode, no console errors. Look and feel is placeholder behind one seam file, ready for the technical-artist.

Verification at the time of writing: `npm test` 427 tests pass, `npm run lint` clean, `npm run build` passes (3D chunk 270 kB gzipped, budget 350 kB). `npm run typecheck` is clean for everything I own. At the last run it reported one error in `src/ui/overlays/Hud.tsx` (the frontend's file, still being edited in parallel), so please re-run it once that settles.

## Files changed
Domain (`src/domain`, all pure TypeScript):
- `layout/{constants,types,generateLayout}.ts`: deterministic layout for 0 to 20 photos, colliders, picture slots, doorways, finale, spawn, waypoint graph. Tests: `generateLayout.test.ts`
- `navigation/{geometry,collision,navGraph}.ts`: circle versus box collision with sub-stepping, rounded-corner line of sight, A* with string pulling. Tests: `navigation.test.ts`
- `presentation/PresentationDirector.ts`: dwell, switch, dismiss and finale state machine. Tests alongside
- `guide/AutonomousGuideSource.ts`: follow, approach, present, relocate and yield. `guide/simulation.ts` is the headless world used by tests. Tests: `AutonomousGuideSource.test.ts`, `guideSoak.test.ts` (NFR-26)
- `characters/{LocalVisitorController,ScriptedCharacterSource,CharacterRegistryImpl,createCharacterState,animation}.ts`: the three source kinds, the registry, and procedural idle, walk and present maths. Tests: `characters.test.ts`, `animation.test.ts`
- `camera/composition.ts`: composition targets from design spec 3.4, camera pose, boom occlusion. Tests alongside
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
- `placeholders/{materials,SceneLights,avatarBuilder}.ts(x)`

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
- **Entrance hall is 7.5 m deep and the Visitor spawns at (0, -4.9)**, not the architecture's 6 m and (0, -2): the design spec 3.4 camera needs 4.3 to 5.1 m of room behind the Visitor on a phone. With the old spawn the back wall shortened the boom on arrival and she filled the screen. The Guide spawns at (1.0, -4.5). A 20-photo museum is now 65.5 m (about 41 s), not 64 m. The architect should update section 6.2 and ADR 0009.
- **Camera composition** (`domain/camera/composition.ts`), replacing architecture 6.9: phone portrait 30% height, feet at 72%, FOV 60; phone landscape 46%, 80%, FOV 52; wide 40%, 82%, FOV 52. Boom is derived (about 4.8, 3.7 and 4.2 m), default pitch 14 degrees, pivot 0.9 m above the feet, and a constant `setViewOffset`. Unit tests project the Visitor through the real camera maths and assert the ranges in section 3.4. Yaw turns right with positive input, matching the frontend's `inputState` convention.
- **The UI owns keyboard, drag-to-look and wheel** (`useCanvasKeyboard`, `useLookControls`). My `CanvasInput` does the same job but is **off by default** (`<Experience canvasInput />`), because both on would apply orbit input twice. It exists for hosts without that UI.
- **No acceleration ease in the Visitor controller at runtime** (`accelerationTau: 0`): the UI already eases keyboard input and the joystick scales linearly. The domain default stays 0.15 s and is tested.
- **"Same side of the wall" is measured from the wall surface, not from the zone point** (margin 0.2 m). Measured from the zone point, a Visitor standing at the picture (0.3 m off the wall, the closest she can get) would count as behind it. A clear 2D line of sight to the zone point is also required, so a picture on the far side of a partition never triggers.
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
All swap points are in `src/scene/seams.ts`. The shapes (`MuseumMaterials`, `AvatarRig`, `AvatarBuilder`) are defined by the scene, so replacing one is a one-line change.
- `createMuseumMaterials` (`placeholders/materials.ts`): flat colours from `SCENE_PALETTE`, plus a radial glow for floor pools. No oak grain, linen gradient, runner brass edges or skirting.
- `SceneLights` (`placeholders/SceneLights.tsx`): hemisphere plus one directional light, no shadow maps. Ceilings read near black.
- `buildAvatar` (`placeholders/avatarBuilder.ts`): 8 capsule and sphere meshes on the bone rig, coloured from `kit/palette.ts`. No faces, hair styles, outfits beyond colour, facial hair, badge or sticker. `rig.kneeL` and `kneeR` are optional.
- `objects/museumGeometry.ts`: plain merged boxes for the shell, frames and mounts. The technical-artist's `materials/geometry/*` builders are not used yet.
- Not built (technical-artist or Release 2): picture lights and wall wash, ceiling roses, finale light cone and dust motes, numbered plaques, the Guide off-screen pointer (design 6.8, Should).
- Built as simple versions: standing-spot pools (one instanced draw call, brighten with proximity and dwell), podium ring brightening over 300 ms, entrance title plaque (canvas texture), brass floor ring under the presenting Guide, in-frame loading and failed glyphs.

## Open questions
- Is a 7.5 m entrance hall (65.5 m total) acceptable, or would the user prefer to keep 6 m and accept a large Visitor on arrival? (architect, user)
- In narrow rooms the boom is shortened by partition walls, so the Visitor looks large near the first picture of a gallery (for example 1.9 m boom at the near row). That follows design spec 6.3, but is it acceptable on a phone, or should partition walls fade when they block the camera? (ux-ui-designer, technical-artist)

## Requests for other agents
- **frontend-developer:**
  - Add `finaleReached: boolean` to `sessionStore` (set once the Guide's presentation first becomes `finale`; clear it on `reset`). The scene has no store field to publish it to, so today it is only in `snapshot().finaleReached`. It can be derived in `setPresentation` with no scene change.
  - Do not pass `canvasInput` to `<Experience />`; keep your keyboard and look hooks as the single input path.
  - Fix the `src/ui/overlays/Hud.tsx` typecheck error (an argument count mismatch) seen at the last run.
  - The R3F canvas wrapper is positioned absolutely inside `.scene-root`; `.scene-root > canvas` in `base.css` no longer matches (the canvas is two levels down). Style the canvas wrapper if you need it.
- **technical-artist:**
  - Replace the three placeholders through `src/scene/seams.ts`. The museum geometry in `objects/museumGeometry.ts` can be swapped for your builders if you keep the `MuseumShell` shape (merged walls, floors, ceilings, runner, frames).
  - The avatar rig contract is in `characters/avatarRig.ts`: bones are pivots (limbs rotate about X, torso about Z), origin at the feet facing +Z. Please keep to the budget of 10 draw calls per character.
  - Layout dimensions are exported from `domain/layout/constants.ts` (`LAYOUT`); the entrance hall is now 7.5 m deep.
- **architect:**
  - Update architecture 6.2 and ADR 0009 for the 7.5 m entrance hall and spawn (0, -4.9), and 6.9 for the camera values above.
  - `characterState.ts` needed no change. If a network source later needs `WorldContext.camera` field of view, add it there; today the Guide gets it through its constructor (`getView`).
- **qa-engineer:**
  - Use the test hooks above. `domain/guide/simulation.ts` is a headless world you can reuse for NFR-25 and NFR-26 style tests.
  - Suggested checks: caption card against `screenRects` at the four viewports; a photo that fails then retries (use `page.route`); the Guide never walking under reduced motion.
- **performance-optimiser:** headless Chromium on a software GPU showed 20 to 34 draw calls and 3,000 to 5,300 triangles for a 20-photo museum, with 18 to 45 textures. Real-device timing is not measured. The 3D chunk is 270 kB gzipped. Textures are not evicted; if NFR-6 shows memory pressure, `PhotoTextures` is the place.
