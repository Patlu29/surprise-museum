# Handoff: technical-artist

## Summary
I built the museum look and the avatar kit entirely from code: no downloaded art, no GLB files and no HDR, so the look adds nothing to the first-view download. There are palette mirrors with token-drift tests, procedural textures, vertex-coloured geometry builders, three mobile-safe shaders, a materials factory, lighting, and a skinned "designer toy" avatar rig (three draw calls and at most 5,750 triangles per character). I also supplied two adapters (`buildAvatar` and `createSceneMaterials`) that match the scene-developer's `src/scene/seams.ts` shapes, plus the home and not-found SVG illustrations. My folders pass typecheck, lint and 38 unit tests, and `npm run build` succeeds. I checked renders in headless Chromium (software GL) only. Details are under Checks.

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
- `proportions.ts`, `pose.ts`, `rig.ts`, `useAvatarRig.ts`, `sceneAvatar.ts`, `index.ts`.
- `geometry/surface.ts`, `geometry/partBuilder.ts`, `colour.ts`.
- `parts/torso.ts`, `parts/outfits.ts`, `parts/body.ts`, `parts/face.ts`, `parts/hair.ts`.
- Tests: `kit.test.ts`, `sceneAvatar.test.ts`.

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
rig.setAppearance(next);                                  // rebuilds only what changed
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
  - The avatar triangle ceiling is 5,750 against a 6,000 budget, so there is little headroom if outfits grow.
