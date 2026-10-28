/**
 * Decal geometry for `GlowDecalMaterial`: wall washes, standing-spot pools, blob shadows and the
 * hint glow. Every quad has UVs 0 to 1 and a per-vertex `aIntensity` attribute.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { FRAME } from './frames';

/** A unit quad with UVs and intensity. `plane` picks the orientation. */
function decalQuad(
  width: number,
  depth: number,
  plane: 'floor' | 'wall',
  offset: readonly [number, number, number],
  rotationY: number,
): { positions: number[]; normals: number[] } {
  const hw = width / 2;
  const hd = depth / 2;
  const local: Array<[number, number, number]> =
    plane === 'floor'
      ? [
          [-hw, 0, hd],
          [hw, 0, hd],
          [hw, 0, -hd],
          [-hw, 0, -hd],
        ]
      : [
          [-hw, -hd, 0],
          [hw, -hd, 0],
          [hw, hd, 0],
          [-hw, hd, 0],
        ];
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const positions: number[] = [];
  for (const [x, y, z] of local) {
    positions.push(offset[0] + x * c + z * s, offset[1] + y, offset[2] - x * s + z * c);
  }
  const n = plane === 'floor' ? [0, 1, 0] : [s, 0, c];
  return { positions, normals: [...n, ...n, ...n, ...n] };
}

export interface DecalPlacement {
  /** For floor decals, the centre on the floor. For wall decals, the point on the wall face. */
  position: readonly [number, number, number];
  /** Rotation about +Y. For wall decals this is the wall's facing (0 faces +Z). */
  rotationY?: number;
  /** Width and depth (floor) or width and height (wall) in metres. */
  width: number;
  depth: number;
  /** Starting intensity, 0 to 1. */
  intensity?: number;
}

/**
 * A batch of decals merged into one mesh and one draw call, each with its own intensity.
 * Use it for the standing-spot pools: `batch.setIntensity(i, 0.4 + 0.6 * proximity)` per frame.
 * Writing intensities is four floats per decal and one attribute upload, so it is cheap.
 */
export class DecalBatch {
  readonly geometry: BufferGeometry;
  private readonly intensity: Float32Array;
  private readonly attribute: BufferAttribute;
  private dirty = false;

  constructor(placements: readonly DecalPlacement[], plane: 'floor' | 'wall') {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    placements.forEach((p, i) => {
      const q = decalQuad(p.width, p.depth, plane, p.position, p.rotationY ?? 0);
      positions.push(...q.positions);
      normals.push(...q.normals);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      const b = i * 4;
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    this.intensity = new Float32Array(placements.length * 4);
    placements.forEach((p, i) => this.intensity.fill(p.intensity ?? 1, i * 4, i * 4 + 4));
    this.attribute = new BufferAttribute(this.intensity, 1);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    this.geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    this.geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    this.geometry.setAttribute('aIntensity', this.attribute);
    this.geometry.setIndex(indices);
    this.count = placements.length;
  }

  readonly count: number;

  setIntensity(index: number, value: number): void {
    const v = Math.min(1, Math.max(0, value));
    const o = index * 4;
    if (this.intensity[o] === v) return;
    this.intensity.fill(v, o, o + 4);
    this.dirty = true;
  }

  /** Call once per frame after the `setIntensity` calls. */
  commit(): void {
    if (!this.dirty) return;
    this.attribute.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

export const POOL = {
  /** Standing-spot pool: about 1.6 m wide, 1.2 m deep, centred 1.6 m from the wall. */
  width: 1.6,
  depth: 1.2,
  distanceFromWall: 1.6,
  /** Height above the floor, so it never z-fights the boards. */
  lift: 0.006,
} as const;

/** One floor pool (a single-decal batch is fine for the finale pool or a preview). */
export function createFloorPoolGeometry(
  width: number = POOL.width,
  depth: number = POOL.depth,
): BufferGeometry {
  return new DecalBatch([{ position: [0, POOL.lift, 0], width, depth }], 'floor').geometry;
}

/**
 * The soft warm wash around a frame from its picture light: a rectangle larger than the frame,
 * brightest at the top (use `topBias` on the material). Origin at the photo centre.
 */
export function createWallWashGeometry(photoWidth: number, photoHeight: number): BufferGeometry {
  const w = photoWidth + 1.3;
  const h = photoHeight + 1.5;
  // Offset upwards a little: the light is above the frame.
  return new DecalBatch([{ position: [0, 0.18, FRAME.depth + 0.004], width: w, depth: h }], 'wall')
    .geometry;
}

/** The soft elliptical blob shadow under a character (0.62 by 0.5 m at height scale 1). */
export function createBlobShadowGeometry(width = 0.62, depth = 0.5): BufferGeometry {
  return new DecalBatch([{ position: [0, 0.01, 0], width, depth }], 'floor').geometry;
}

/** A flat ring on the floor (the brass ring under a presenting Guide, 0.55 m radius). */
export function createFloorRingGeometry(radius = 0.55, thickness = 0.035): BufferGeometry {
  const segments = 48;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * (radius - thickness), 0.012, Math.sin(a) * (radius - thickness));
    positions.push(Math.cos(a) * radius, 0.012, Math.sin(a) * radius);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = ((i + 1) % segments) * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}
