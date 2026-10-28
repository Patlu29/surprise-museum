# 0009: Linear procedural museum layout

## Status
Accepted (27/10/2026). Amended 28/10/2026 (integration round 1, accepted by the tech lead): entrance hall depth, spawn points and the "same side of the wall" test. See "Amendment" below.

## Context
FR-39 requires an automatic layout for 1 to 20 photos: an entrance, a walkable route that hangs pictures in the Creator's order, and a finale at the end, with photos at their original aspect ratio. Presentation zones (3 m) must not overlap confusingly, preview and published must be identical, and the Guide must navigate it cheaply.

## Decision
- A pure, deterministic `generateLayout(photos)` in `src/domain/layout`. All dimensions live in `src/domain/layout/constants.ts` (`LAYOUT`); nothing else may duplicate them.
- An entrance hall (8 m wide by **7.5 m** deep), then `ceil(n / 4)` gallery rooms 8 m wide (10 m deep, or 6 m when the room holds 1 or 2 photos), then a finale room (8 x 8 m) with the podium. Rooms connect through centred 2.4 m doorways along -Z.
- The Visitor spawns at **(0, -4.9)** facing -Z; the Guide spawns at **(1.0, -4.5)**.
- In each room, photos alternate left and right, near then far, in Creator order. Left and right walls are 8 m apart, so the centre line is outside both zones.
- Each photo fits a 1.6 x 1.4 m box at its own aspect ratio.
- A Visitor is on the **same side** of a picture's wall when `dot(wallNormal, visitor - picturePosition) > 0.2 m`, measured from the wall surface, and the 2D line of sight from her to the zone point is clear.

## Amendment (28/10/2026)
| Item | Was | Now | Why |
|---|---|---|---|
| Entrance hall depth | 6 m | 7.5 m | The camera composition in design spec 3.4 (ADR 0014) puts the camera 4.3 to 5.1 m behind the Visitor on a phone. From the old spawn the back wall shortened the boom on arrival and she filled the screen |
| Visitor spawn | (0, -2) | (0, -4.9) | As above: room behind her for the full boom |
| Guide spawn | (1.0, -1.6) | (1.0, -4.5) | Stays just behind and beside the Visitor |
| Museum length, 20 photos | 64 m (about 40 s) | 65.5 m (about 41 s) | 7.5 + 5 x 10 + 8 |
| Same-side test | Measured from the zone point (0.3 m off the wall) | Measured from the wall surface, 0.2 m margin, plus a clear line of sight to the zone point | Characters stop 0.3 m from a wall, so measuring from the zone point made a Visitor standing at the picture count as behind it. The line-of-sight check stops a picture on the far side of a partition from triggering |

## Consequences
- Simple, predictable and easy to test for every count from 1 to 20.
- A straight line is less architecturally interesting; themes (Release 2) can vary materials, ceiling and lighting, and doorway offsets can be added later without changing the contract.
- The deeper entrance adds 1.5 m (about 1 s of walking) to every museum. The welcome view is better framed, and the title plaque has more wall.
- Layout is not part of the API contract or stored data, so the change needs no migration; preview and published still match because both call the same function.
