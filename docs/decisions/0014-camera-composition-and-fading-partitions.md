# 0014: Camera composition from screen-space targets, and partition walls that fade

## Status
Accepted (28/10/2026, integration round 1, accepted by the tech lead). Replaces the camera numbers in architecture section 6.9 v1.0 (boom 3.5 m, height 2.2 m) and the rule that every wall shortens the boom.

## Context
Architecture v1.0 gave a fixed boom of 3.5 m at 2.2 m height, shortened whenever a wall blocked the line to the Visitor. In practice:
- On a phone in portrait the Visitor filled about half the screen and hid the picture she was looking at. Design spec 3.4 sets screen-space targets per viewport instead.
- Gallery rooms are 8 m wide and the near picture row is 2.5 m from the doorway wall, so when she stands at a picture the camera is often behind the partition she just walked through. Shortening the boom there made her fill the screen again in exactly the moment that matters (a presentation).

## Decision
**Composition** (`src/domain/camera/composition.ts`, pure and unit-tested by projecting the Visitor through the real camera maths):

| Viewport class | Rule | Visitor height on screen | Feet from top | Vertical FOV | Derived boom |
|---|---|---|---|---|---|
| Phone portrait | portrait and narrower than 640 px | 30% | 72% | 60 degrees | about 4.8 m |
| Phone landscape | landscape and 500 px tall or less | 46% | 80% | 52 degrees | about 3.7 m |
| Wide (tablet, desktop) | everything else | 40% | 82% | 52 degrees | about 4.2 m |

- Default pitch 14 degrees, pivot 0.9 m above the feet. The boom is derived from the targets, clamped to 2.5 to 6 m; the desktop wheel adjusts it within that range.
- The vertical placement uses a constant `camera.setViewOffset`, set once per viewport size. It is composition, not camera motion (FR-62 still holds: the camera never moves on its own).
- Yaw turns right with positive input, matching `inputState`.

**Occlusion:**
- **Outer walls are hard**: they shorten the boom to a minimum of 1.2 m, as before.
- **Partition walls (internal walls between rooms) are soft**: the boom ignores them, and a partition that stands between the camera and the Visitor fades to **0.25 opacity** (eased; instant under reduced motion). The boom still keeps the camera out of a partition's thickness.
- **Collision is unchanged.** A faded wall still blocks characters, navigation and line of sight for presentations. Name labels show through a faded wall.
- Each partition is its own mesh and material, transparent only while fading, so the common case stays opaque and sorts normally.

## Consequences
- The Visitor keeps the same on-screen size everywhere, including in a presentation with the camera in the previous room, and the caption card has its free area (design spec 3.5).
- The entrance hall had to grow to 7.5 m so the full boom fits behind the spawn (ADR 0009 amendment).
- A fading wall can briefly show the next room through it. This is a deliberate trade for keeping her visible.
- Partitions are separate meshes so each can fade on its own, which means they cannot be merged into one draw call. A 20-photo museum still draws in 18 to 21 calls at the shell and dressing level in headless Chromium, against a budget of 120.
- The QA hook `snapshot().partitionOpacity` (below 1 means a wall is fading) lets end-to-end tests check the behaviour.
- Name-label occlusion (ADR 0011) still uses the 2D line of sight against all walls, but labels are drawn when the blocking wall is a faded partition.
