import { distToSegment, type Vec2 } from '../math/vec2';

/** Axis-aligned box in plan (all museum solids are full height, so 2D is enough). */
export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Characters are circles of this radius against static boxes (ADR 0007). */
export const CHARACTER_RADIUS = 0.3;

/** Keeps "touching" boxes from counting as blocked when a node sits exactly on an inflated edge. */
const TOUCH_EPSILON = 1e-3;

export function inflateAabb(b: Aabb, margin: number): Aabb {
  return {
    minX: b.minX - margin,
    maxX: b.maxX + margin,
    minZ: b.minZ - margin,
    maxZ: b.maxZ + margin,
  };
}

export function pointInAabb(p: Vec2, b: Aabb): boolean {
  return p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
}

/**
 * Entry parameter t (0..1) where segment a-b first enters the box, or -1 if it never does.
 * Slab method. A segment that starts inside the box returns 0.
 */
export function segmentEntry(a: Vec2, b: Vec2, box: Aabb): number {
  let tMin = 0;
  let tMax = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;

  if (Math.abs(dx) < 1e-12) {
    if (a.x <= box.minX || a.x >= box.maxX) return -1;
  } else {
    let t1 = (box.minX - a.x) / dx;
    let t2 = (box.maxX - a.x) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }

  if (Math.abs(dz) < 1e-12) {
    if (a.z <= box.minZ || a.z >= box.maxZ) return -1;
  } else {
    let t1 = (box.minZ - a.z) / dz;
    let t2 = (box.maxZ - a.z) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }
  return tMin;
}

/** Distance from a point to a box (0 if inside). */
function pointBoxDistance(p: Vec2, b: Aabb): number {
  const cx = p.x < b.minX ? b.minX : p.x > b.maxX ? b.maxX : p.x;
  const cz = p.z < b.minZ ? b.minZ : p.z > b.maxZ ? b.maxZ : p.z;
  return Math.hypot(p.x - cx, p.z - cz);
}

/**
 * Shortest distance between segment a-b and a box (0 when they touch or cross). For disjoint
 * convex shapes the minimum is reached at a vertex of one of them.
 */
export function segmentBoxDistance(a: Vec2, b: Vec2, box: Aabb): number {
  if (segmentEntry(a, b, box) >= 0) return 0;
  let best = Math.min(pointBoxDistance(a, box), pointBoxDistance(b, box));
  const corners: Vec2[] = [
    { x: box.minX, z: box.minZ },
    { x: box.maxX, z: box.minZ },
    { x: box.minX, z: box.maxZ },
    { x: box.maxX, z: box.maxZ },
  ];
  for (const c of corners) best = Math.min(best, distToSegment(c, a, b).dist);
  return best;
}

/**
 * True if a disc of radius `margin` swept along the segment a-b touches no box. The swept disc
 * has rounded corners, which matches the circle-versus-box collision exactly, so a character
 * hugging a doorway corner is not wrongly treated as blocked.
 */
export function segmentClear(a: Vec2, b: Vec2, boxes: readonly Aabb[], margin = 0): boolean {
  const m = margin - TOUCH_EPSILON;
  for (const box of boxes) {
    if (m <= 0) {
      if (segmentEntry(a, b, box) >= 0) return false;
      continue;
    }
    // Cheap reject with the square-inflated box first.
    if (segmentEntry(a, b, inflateAabb(box, m)) < 0) continue;
    if (segmentBoxDistance(a, b, box) < m) return false;
  }
  return true;
}

/**
 * Distance along a ray (origin plus unit direction) to the first box inflated by margin, or
 * maxDist if nothing is hit. Used by the camera boom.
 */
export function firstHitDistance(
  origin: Vec2,
  dir: Vec2,
  maxDist: number,
  boxes: readonly Aabb[],
  margin = 0,
): number {
  const end = { x: origin.x + dir.x * maxDist, z: origin.z + dir.z * maxDist };
  let best = maxDist;
  const m = margin - TOUCH_EPSILON;
  for (const box of boxes) {
    const test = m > 0 ? inflateAabb(box, m) : box;
    const t = segmentEntry(origin, end, test);
    if (t >= 0) best = Math.min(best, t * maxDist);
  }
  return best;
}

/** True when a circle of the given radius centred at p overlaps none of the boxes. */
export function circleIsFree(p: Vec2, radius: number, boxes: readonly Aabb[]): boolean {
  for (const b of boxes) {
    const cx = p.x < b.minX ? b.minX : p.x > b.maxX ? b.maxX : p.x;
    const cz = p.z < b.minZ ? b.minZ : p.z > b.maxZ ? b.maxZ : p.z;
    const dx = p.x - cx;
    const dz = p.z - cz;
    if (dx * dx + dz * dz < (radius - TOUCH_EPSILON) * (radius - TOUCH_EPSILON)) return false;
  }
  return true;
}
