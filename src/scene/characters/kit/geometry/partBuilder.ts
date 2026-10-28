import type { BufferGeometry, Matrix4 } from 'three';
import { BufferAttribute, Color, Uint16BufferAttribute, type ColorRepresentation } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bone names, in skeleton order. The index is the skin index. */
export const BONE_NAMES = [
  'hips',
  'spine',
  'neck',
  'head',
  'hairBack',
  'armL',
  'forearmL',
  'armR',
  'forearmR',
  'legL',
  'shinL',
  'legR',
  'shinR',
] as const;

export type BoneName = (typeof BONE_NAMES)[number];

/**
 * Collects parts, each tagged with the bone that moves it, and merges them into one skinned
 * geometry: one draw call per builder. Skinning is rigid (weight 1 on one bone), which suits the
 * stiff toy look and keeps the vertex shader cheap.
 */
export class PartBuilder {
  private readonly parts: BufferGeometry[] = [];

  /**
   * Adds a geometry. If it has no `color` attribute, `colour` is required. Vertex colours already
   * on the geometry (lofts) win. The geometry is consumed.
   */
  add(
    geometry: BufferGeometry,
    bone: BoneName,
    colour?: ColorRepresentation,
    matrix?: Matrix4,
  ): this {
    if (matrix) geometry.applyMatrix4(matrix);
    const count = geometry.getAttribute('position').count;

    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
    if (!geometry.hasAttribute('color')) {
      const c = new Color(colour ?? '#ffffff');
      const data = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        data[i * 3] = c.r;
        data[i * 3 + 1] = c.g;
        data[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new BufferAttribute(data, 3));
    }
    if (!geometry.index) {
      const idx = Array.from({ length: count }, (_, i) => i);
      geometry.setIndex(idx);
    }
    geometry.deleteAttribute('uv');

    const index = BONE_NAMES.indexOf(bone);
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = index;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(skinWeight, 4));
    for (const name of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(name)) {
        geometry.deleteAttribute(name);
      }
    }
    this.parts.push(geometry);
    return this;
  }

  get isEmpty(): boolean {
    return this.parts.length === 0;
  }

  /** Merges everything. Returns null when nothing was added. */
  build(): BufferGeometry | null {
    if (this.parts.length === 0) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    return merged;
  }
}
