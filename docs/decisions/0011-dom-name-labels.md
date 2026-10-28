# 0011: DOM name labels hidden by a 2D line-of-sight test

## Status
Accepted (27/10/2026)

## Context
FR-17 and US-10: names float above both characters at all times, face the camera, are hidden behind walls, have 4.5:1 contrast at 360 px, and must show accents and emoji exactly as typed. Options: SDF text in WebGL (drei `Text`, troika), which handles depth naturally but needs a font download and cannot render colour emoji; or DOM labels (drei `Html`), which render any text the platform can but need occlusion handling.

## Decision
- DOM labels via drei `<Html>`, styled with a solid backing by the design system.
- Hide a label when the 2D line of sight from the camera to the character's head crosses a wall collider (the same test the navigation uses). No per-frame raycasting against meshes.

## Consequences
- Emoji and any script render correctly, crisp at any pixel ratio, with contrast controlled in CSS.
- Two DOM transforms per frame is negligible.
- Labels sit above the canvas, so they can overlap other DOM overlays; the design spec must layer them below panels.
