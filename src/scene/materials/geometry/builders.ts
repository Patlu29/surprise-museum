/**
 * Small geometry helpers shared by the museum builders.
 *
 * Conventions (docs/architecture.md, 6.1): metres, +Y up, the route runs towards -Z, a surface's
 * front faces +Z in local space. Every builder returns a geometry with the same attribute set
 * (`position`, `normal`, `uv`, `color`, `aGlow`) so that geometries can be merged freely and so
 * the vertex-glow material never reads a missing attribute.
 */
import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const scratchColour = new Color();

/** Writes a constant linear vertex colour. `hex` is sRGB; three converts it. */
export function setVertexColour(
  geometry: BufferGeometry,
  colour: ColorRepresentation,
): BufferGeometry {
  scratchColour.set(colour);
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = scratchColour.r;
    data[i * 3 + 1] = scratchColour.g;
    data[i * 3 + 2] = scratchColour.b;
  }
  geometry.setAttribute('color', new BufferAttribute(data, 3));
  return geometry;
}

/** Writes a constant value into a one-component attribute (aGlow, aIntensity). */
export function setConstantAttribute(
  geometry: BufferGeometry,
  name: string,
  value: number,
): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count).fill(value);
  geometry.setAttribute(name, new BufferAttribute(data, 1));
  return geometry;
}

/** Keeps only the attributes the museum materials use, so merging never fails on a mismatch. */
export function normaliseAttributes(
  geometry: BufferGeometry,
  keep: readonly string[] = ['position', 'normal', 'uv', 'color', 'aGlow'],
): BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    if (!keep.includes(name)) geometry.deleteAttribute(name);
  }
  const count = geometry.getAttribute('position').count;
  if (keep.includes('uv') && !geometry.hasAttribute('uv')) {
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (keep.includes('color') && !geometry.hasAttribute('color')) {
    setVertexColour(geometry, '#ffffff');
  }
  if (keep.includes('aGlow') && !geometry.hasAttribute('aGlow')) {
    setConstantAttribute(geometry, 'aGlow', 0);
  }
  return geometry;
}

export interface BoxPartOptions {
  /** Centre of the box. */
  x?: number;
  y?: number;
  z?: number;
  colour: ColorRepresentation;
  /** 0 to 1: how much of the surface colour is emitted (see glowMaterial.ts). */
  glow?: number;
}

/** A coloured box with the standard museum attribute set. */
export function boxPart(width: number, height: number, depth: number, o: BoxPartOptions) {
  const g = new BoxGeometry(width, height, depth);
  g.translate(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  setVertexColour(g, o.colour);
  setConstantAttribute(g, 'aGlow', o.glow ?? 0);
  return g;
}

/**
 * Rewrites UVs so one texture tile covers `tileX` by `tileY` metres, projecting each face along
 * its dominant normal axis. Lets a single tiling texture work on every wall length.
 */
export function applyMetreUv(
  geometry: BufferGeometry,
  tileX: number,
  tileY = tileX,
): BufferGeometry {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / tileX;
    uv[i * 2 + 1] = v / tileY;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  return geometry;
}

/** Merges geometries that share an attribute set. Disposes the inputs. */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  for (const p of parts) {
    if (p.index === null) throw new Error('mergeParts expects indexed geometry');
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

export interface Placement {
  /** World position of the geometry's origin. */
  position: readonly [number, number, number];
  /** Rotation about +Y in radians. 0 keeps the local +Z facing +Z. */
  rotationY?: number;
  /** Uniform scale. */
  scale?: number;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const one = new Vector3(1, 1, 1);

/**
 * Bakes one geometry at many placements into a single geometry (one draw call). Use it to merge
 * every frame, every picture light or every wall wash in the museum. The source is not modified.
 */
export function mergePlaced(
  source: BufferGeometry,
  placements: readonly Placement[],
): BufferGeometry {
  const parts = placements.map((p) => {
    const g = source.clone();
    euler.set(0, p.rotationY ?? 0, 0);
    quaternion.setFromEuler(euler);
    const s = p.scale ?? 1;
    matrix.compose(new Vector3(...p.position), quaternion, one.clone().multiplyScalar(s));
    g.applyMatrix4(matrix);
    return g;
  });
  return mergeParts(parts);
}

/** Triangle count of an indexed or non-indexed geometry. */
export function triangleCount(geometry: BufferGeometry): number {
  const count = geometry.index ? geometry.index.count : geometry.getAttribute('position').count;
  return Math.floor(count / 3);
}
