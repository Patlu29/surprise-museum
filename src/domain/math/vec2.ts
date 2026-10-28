/**
 * Tiny 2D helpers for the floor plane (ADR 0006: the domain has its own vector maths instead of
 * three.js). A Vec2 is a point or direction in plan: x is right, z runs towards the viewer, so the
 * museum route goes towards -z. Heading follows three.js: forward = (sin h, cos h).
 */

export interface Vec2 {
  x: number;
  z: number;
}

export const TAU = Math.PI * 2;

export function vec2(x = 0, z = 0): Vec2 {
  return { x, z };
}

export function copy2(a: Vec2): Vec2 {
  return { x: a.x, z: a.z };
}

export function dist2(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function distSq2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function len2(a: Vec2): number {
  return Math.hypot(a.x, a.z);
}

export function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function scale2(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, z: a.z * s };
}

/** a + b * s without allocating an intermediate. */
export function addScaled2(a: Vec2, b: Vec2, s: number): Vec2 {
  return { x: a.x + b.x * s, z: a.z + b.z * s };
}

export function normalize2(a: Vec2, fallback: Vec2 = { x: 0, z: 1 }): Vec2 {
  const l = Math.hypot(a.x, a.z);
  return l > 1e-9 ? { x: a.x / l, z: a.z / l } : { x: fallback.x, z: fallback.z };
}

/** Unit forward vector for a heading. */
export function forwardOf(heading: number): Vec2 {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** Unit right-hand vector for a heading (the Visitor's right when facing that way). */
export function rightOf(heading: number): Vec2 {
  return { x: -Math.cos(heading), z: Math.sin(heading) };
}

/** Right-hand perpendicular of a direction (right of forward, seen from above with +y up). */
export function perpRight(a: Vec2): Vec2 {
  return { x: -a.z, z: a.x };
}

export function headingOf(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smallest signed difference b - a in radians, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Turn a towards b by at most maxStep radians. */
export function turnTowards(a: number, b: number, maxStep: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

/** Frame-rate independent exponential smoothing factor for a time constant (seconds). */
export function smoothingFactor(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
}

/** Distance from point p to the segment a-b, and the parameter t (0..1) of the closest point. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): { dist: number; t: number } {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 1e-12 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  return { dist: Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t)), t };
}

/** Deterministic small PRNG (mulberry32) so tests and soak runs are reproducible. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
