# 0009: Linear procedural museum layout

## Status
Accepted (27/10/2026)

## Context
FR-39 requires an automatic layout for 1 to 20 photos: an entrance, a walkable route that hangs pictures in the Creator's order, and a finale at the end, with photos at their original aspect ratio. Presentation zones (3 m) must not overlap confusingly, preview and published must be identical, and the Guide must navigate it cheaply.

## Decision
- A pure, deterministic `generateLayout(photos)` in `src/domain/layout`.
- An entrance hall (8 x 6 m), then `ceil(n / 4)` gallery rooms 8 m wide (10 m deep, or 6 m when the room holds 1 or 2 photos), then a finale room (8 x 8 m) with the podium. Rooms connect through centred 2.4 m doorways along -Z.
- In each room, photos alternate left and right, near then far, in Creator order. Left and right walls are 8 m apart, so the centre line is outside both zones.
- Each photo fits a 1.6 x 1.4 m box at its own aspect ratio.

## Consequences
- Simple, predictable and easy to test for every count from 1 to 20.
- A straight line is less architecturally interesting; themes (Release 2) can vary materials, ceiling and lighting, and doorway offsets can be added later without changing the contract.
