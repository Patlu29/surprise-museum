import type { Vec2 } from '../math/vec2';
import { CHARACTER_RADIUS, type Aabb } from './geometry';

/** Largest distance moved in one collision sub-step; stays below the 0.2 m wall thickness. */
const MAX_SUBSTEP = 0.1;
const PASSES = 3;

/**
 * Push a circle (centre p, mutated) out of one box. Uses the closest point on the box, so corners
 * behave like a round post, and falls back to the shortest axis if the centre is inside.
 * Returns true if the circle was moved.
 */
export function pushOutOfBox(p: Vec2, radius: number, b: Aabb): boolean {
  const cx = p.x < b.minX ? b.minX : p.x > b.maxX ? b.maxX : p.x;
  const cz = p.z < b.minZ ? b.minZ : p.z > b.maxZ ? b.maxZ : p.z;
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return false;

  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    p.x += (dx / d) * push;
    p.z += (dz / d) * push;
    return true;
  }

  // Centre is inside the box: leave by the nearest face.
  const toMinX = p.x - b.minX;
  const toMaxX = b.maxX - p.x;
  const toMinZ = p.z - b.minZ;
  const toMaxZ = b.maxZ - p.z;
  const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  if (m === toMinX) p.x = b.minX - radius;
  else if (m === toMaxX) p.x = b.maxX + radius;
  else if (m === toMinZ) p.z = b.minZ - radius;
  else p.z = b.maxZ + radius;
  return true;
}

/** Resolve a circle against every box, a few passes so two walls at a corner both hold. */
export function resolveCircle(
  p: Vec2,
  radius: number,
  boxes: readonly Aabb[],
  bounds?: Aabb,
): void {
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const b of boxes) {
      if (pushOutOfBox(p, radius, b)) moved = true;
    }
    if (bounds) {
      // The museum has no exits (FR-34): a final clamp to the outer bounds.
      const nx = Math.min(Math.max(p.x, bounds.minX + radius), bounds.maxX - radius);
      const nz = Math.min(Math.max(p.z, bounds.minZ + radius), bounds.maxZ - radius);
      if (nx !== p.x || nz !== p.z) {
        p.x = nx;
        p.z = nz;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * Move a circle by (dx, dz), sliding along boxes. Sub-steps long moves so a fast character or a
 * long frame cannot tunnel through a thin wall. Mutates and returns p.
 */
export function moveCircle(
  p: Vec2,
  dx: number,
  dz: number,
  boxes: readonly Aabb[],
  bounds?: Aabb,
  radius: number = CHARACTER_RADIUS,
): Vec2 {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    p.x += sx;
    p.z += sz;
    resolveCircle(p, radius, boxes, bounds);
  }
  return p;
}
