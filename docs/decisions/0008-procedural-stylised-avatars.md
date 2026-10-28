# 0008: Procedural stylised avatars with procedural animation

## Status
Accepted (27/10/2026)

## Context
FR-13 and FR-14 need two customisable stylised characters (10 skin tones, 12 hair styles, 11 hair colours, 6 outfits with 12 colours, 4 body types, 3 heights, facial hair), with a live preview that updates within 1 s (FR-15), idle and walk animations (FR-18), and a presenting gesture (Should). Options:
1. A modular glTF kit: skinned base bodies on a shared skeleton, hair and outfit meshes, and animation clips. Best looks, but needs licensed or authored art (A-11), an asset pipeline, 1 to 3 MB of downloads, and skinning cost.
2. A procedural rig built from primitives in code, animated procedurally.

## Decision
- Option 2 for the MVP. A hierarchy of bone groups built from shared primitive geometries, with part definitions (hair, facial hair, outfits, palette) in `src/scene/characters/kit/` and the rig and animation in `Avatar.tsx`.
- Walk, idle and present are driven by `locomotion`, `speed` and `gesture` from `CharacterState`; no `AnimationMixer`.
- Keep `<Avatar config state>` as the stable interface so a glTF kit can replace the internals later.

## Consequences
- No art assets, licences or downloads; customisation is instant.
- The look is simpler ("designer toy" style). Quality depends on careful proportions, the palette and hair shapes.
- Procedural animation is less natural than motion-captured clips, but cheap and fully controllable (reduced motion included).
