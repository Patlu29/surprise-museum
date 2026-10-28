# Handoff: scene-developer

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
