/**
 * Floor boards, the claret runner and its brass edge lines (design spec 1.4 and 1.5).
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { SCENE_PALETTE } from '../palette';
import {
  applyMetreUv,
  mergeParts,
  normaliseAttributes,
  setConstantAttribute,
  setVertexColour,
} from './builders';
import type { ColorRepresentation } from 'three';

export const FLOOR = {
  /** Oak tile: 4 boards of 0.2 m across by 1.6 m along the route. */
  tileAcross: 0.8,
  tileAlong: 1.6,
} as const;

export const RUNNER = {
  width: 1.6,
  /** Brass line: distance in from the outer edge to the line's near side. */
  edgeInset: 0.07,
  edgeWidth: 0.028,
  /** Sits just above the floor; the material also uses a polygon offset. */
  height: 0.004,
  /** One pile-texture tile covers this many metres. */
  tileMetres: 0.8,
} as const;

/**
 * A floor plane centred on x = 0, z = 0 at y = 0, facing up. UVs are in metres divided by the
 * oak tile, so boards run along Z (the route) at the same scale in every room.
 */
export function createFloorGeometry(width: number, depth: number): BufferGeometry {
  const g = new BufferGeometry();
  const hx = width / 2;
  const hz = depth / 2;
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-hx, 0, hz, hx, 0, hz, hx, 0, -hz, -hx, 0, -hz]), 3),
  );
  g.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  applyMetreUv(g, FLOOR.tileAcross, FLOOR.tileAlong);
  setVertexColour(g, '#ffffff');
  setConstantAttribute(g, 'aGlow', 0);
  return g;
}

interface StripSpec {
  x0: number;
  x1: number;
  colour: ColorRepresentation;
}

/** An upward-facing quad spanning x0..x1 and z0..z1 at height y. */
function quad(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  colour: ColorRepresentation,
) {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0]), 3),
  );
  g.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  setVertexColour(g, colour);
  setConstantAttribute(g, 'aGlow', 0);
  return g;
}

/** A flat annular sector facing up, from radius r0 to r1 over the half circle behind -Z. */
function halfRing(
  r0: number,
  r1: number,
  y: number,
  colour: ColorRepresentation,
  segments: number,
  zOffset: number,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = r0 <= 1e-6 ? 1 : 2;
  // Angles run from +X round through -Z to -X (a semicircle ahead of the runner's end).
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI;
    const cx = Math.cos(a);
    const cz = -Math.sin(a);
    if (rings === 2) positions.push(cx * r0, y, zOffset + cz * r0);
    positions.push(cx * r1, y, zOffset + cz * r1);
  }
  const stride = rings;
  for (let i = 0; i < segments; i++) {
    if (rings === 2) {
      const a = i * stride;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // Winding chosen so the face normal points up (+Y).
      indices.push(a, b, c, b, d, c);
    }
  }
  if (rings === 1) {
    // Fan from the centre.
    const centre = positions.length / 3;
    positions.push(0, y, zOffset);
    for (let i = 0; i < segments; i++) indices.push(centre, i, i + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(indices);
  setVertexColour(g, colour);
  setConstantAttribute(g, 'aGlow', 0);
  return g;
}

export interface RunnerOptions {
  /** Length from the entrance (z = 0) to the end, metres. */
  length: number;
  width?: number;
  /** `semicircle` finishes with the brass-edged half circle at the podium (design spec 1.5). */
  end?: 'square' | 'semicircle';
  /** Distance the runner starts from z = 0, for a runner that begins past the entrance wall. */
  start?: number;
}

/**
 * The claret carpet runner with thin brass edge lines. It runs from z = -start towards
 * z = -(start + length) along x = 0, so it passes through every doorway on the centre line.
 * One geometry, one material: claret and brass come from vertex colours and the pile texture
 * (`createRunnerPileTexture`) adds the weave.
 *
 * With `end: 'semicircle'` the runner finishes in a half disc of radius width/2 that is part of
 * `length` (so the total length stays `length`), with the brass line following the arc.
 */
export function createRunnerGeometry(options: RunnerOptions): BufferGeometry {
  const width = options.width ?? RUNNER.width;
  const half = width / 2;
  const start = options.start ?? 0;
  const y = RUNNER.height;
  const end = options.end ?? 'square';
  const radius = half;
  const straightLength =
    end === 'semicircle' ? Math.max(0, options.length - radius) : options.length;
  const zFar = -(start + straightLength);
  const zNear = -start;

  const claret = SCENE_PALETTE.runner;
  const brass = SCENE_PALETTE.runnerEdge;
  const eo = half - RUNNER.edgeInset; // outer radius of the brass line
  const ei = eo - RUNNER.edgeWidth; // inner radius

  const strips: StripSpec[] = [
    { x0: -half, x1: -eo, colour: claret },
    { x0: -eo, x1: -ei, colour: brass },
    { x0: -ei, x1: ei, colour: claret },
    { x0: ei, x1: eo, colour: brass },
    { x0: eo, x1: half, colour: claret },
  ];
  const parts: BufferGeometry[] = strips.map((s) => quad(s.x0, s.x1, zFar, zNear, y, s.colour));

  if (end === 'semicircle') {
    const segments = 28;
    parts.push(
      halfRing(0, ei, y, claret, segments, zFar),
      halfRing(ei, eo, y, brass, segments, zFar),
      halfRing(eo, half, y, claret, segments, zFar),
    );
  }

  const merged = mergeParts(parts);
  applyMetreUv(merged, RUNNER.tileMetres);
  return normaliseAttributes(merged);
}

/** A dark floor for the finale room. Same layout and UV rules as `createFloorGeometry`. */
export function createFinaleFloorGeometry(width: number, depth: number): BufferGeometry {
  return createFloorGeometry(width, depth);
}

export const FLOOR_COLOURS = {
  oak: SCENE_PALETTE.floor,
  oakGrain: SCENE_PALETTE.floorGrain,
  finale: SCENE_PALETTE.finaleFloor,
} as const;
