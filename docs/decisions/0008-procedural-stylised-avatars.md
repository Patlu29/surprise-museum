# 0008: Procedural stylised avatars with procedural animation

## Status
Accepted (27/10/2026). Amended 28/10/2026 (integration round 1, accepted by the tech lead): the rig is a skinned mesh with rigid weights built by the technical-artist's kit, and the kit turns animation timing into poses. See "Amendment" below.

## Context
FR-13 and FR-14 need two customisable stylised characters (10 skin tones, 12 hair styles, 11 hair colours, 6 outfits with 12 colours, 4 body types, 3 heights, facial hair), with a live preview that updates within 1 s (FR-15), idle and walk animations (FR-18), and a presenting gesture (Should). Options:
1. A modular glTF kit: skinned base bodies on a shared skeleton, hair and outfit meshes, and animation clips. Best looks, but needs licensed or authored art (A-11), an asset pipeline, 1 to 3 MB of downloads, and skinning cost.
2. A procedural rig built from primitives in code, animated procedurally.

## Decision
- Option 2 for the MVP: avatars are generated in code from primitive geometry, with no downloaded art.
- Walk, idle and present are driven by `locomotion`, `speed` and `gesture` from `CharacterState`; no `AnimationMixer` and no clips.
- Keep a stable rig interface so a glTF kit can replace the internals later without touching sources, labels or UI.

## Amendment (28/10/2026)
| Item | Was | Now |
|---|---|---|
| Construction | A hierarchy of groups, one mesh per part (about 10 draw calls) | One skinned body mesh and one skinned hair mesh with **rigid weights** on 13 bones (hips, spine, neck, head, hairBack, both arms and forearms, both legs and shins), plus an optional blob shadow: at most 3 draw calls and 5,750 triangles per character. Built by `src/scene/characters/kit/` (technical-artist) |
| Animation | Bones animated by the scene in `Avatar.tsx` | Split in two. `src/domain/characters/animation.ts` (pure, scene-developer) produces **timing only**: walk phase, walk blend, idle clock and present level. The kit's `applyPose` (technical-artist) turns that timing into joint rotations. The scene never drives bones itself |
| Stable interface | `<Avatar config state>` | `AvatarRig` (`src/scene/characters/avatarRig.ts`): `root`, `height`, `labelHeight`, `scale`, `applyPose(pose)`, `setOpacity(opacity)`, `dispose()`. The kit builds it through `src/scene/seams.ts`; `CharacterView` and the builder preview are the only consumers |
| Option labels | Kit | `src/domain/characters/avatarOptions.ts` (labels, defaults, `describeAvatar`), re-exported by the kit and by `src/lib/avatars.ts`, so there is one source of truth |

Left and right are anatomical: the presenting arm is the character's right arm (-X in rig space).

## Consequences
- No art assets, licences or downloads; customisation is instant.
- The look is simpler ("designer toy" style). Quality depends on careful proportions, the palette and hair shapes.
- Procedural animation is less natural than motion-captured clips, but cheap and fully controllable (reduced motion included).
- Rigid skinning fits the whole figure in two draw calls at almost no vertex cost, well inside the budget of 10.
- The pose maths sits with the person who owns the proportions, so a new hair style or outfit cannot fall out of step with the animation. The domain timing stays testable without three.js.
- Little triangle headroom remains (5,750 of 6,000) if outfits grow.
