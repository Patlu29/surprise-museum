/**
 * Test helper: a bit-exact fingerprint of the kit's Neutral output, so a later change to the
 * kit can prove that a character with no gender (or `neutral`) still has the v1.0 vertices
 * (design spec 9.6, FR-75). Imported by tests only.
 */
import { AVATAR_OPTIONS } from '@contract';
import type { AvatarConfig } from '@contract';
import type { BufferGeometry } from 'three';
import { DEFAULT_GUIDE_APPEARANCE } from './options';
import { buildBodyGeometry } from './parts/body';
import { buildHairGeometry } from './parts/hair';

/** FNV-1a over the raw bytes of the position array and the index. */
export function hashGeometry(g: BufferGeometry | null, seed = 0x811c9dc5): number {
  let h = seed;
  if (!g) return h;
  const mix = (buf: ArrayBufferView) => {
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i] as number;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  mix(g.getAttribute('position').array as Float32Array);
  const normal = g.getAttribute('normal');
  mix(normal.array as Float32Array);
  if (g.index) mix(g.index.array as Uint16Array);
  return h >>> 0;
}

/**
 * Explicit timeout for the kit budget tests. They loop over 12 outfit styles, 5 face shapes, 12 hair
 * styles and every gender and body type, and timed out at the 5 s default when the machine was busy.
 */
export const KIT_TEST_TIMEOUT = 120_000;

/**
 * Bones whose vertices the CR-4 face and edge changes touch on purpose: the head (bigger eyes,
 * catchlights, brows, mouth, face shape, hairline shading) and the arm, forearm (hands) and shin
 * (shoes) tubes, which went from 10 to 8 sides so the screen-space edge band finds a silhouette
 * vertex (design spec 12.8.2 A). Indices into BONE_NAMES: head 3, armL 5, forearmL 6, armR 7,
 * forearmR 8, shinL 10, shinR 12.
 */
const CR4_CHANGED_BONES = new Set([3, 5, 6, 7, 8, 10, 12]);

/**
 * Hash of the body's position and normal for every vertex not on a bone CR-4 changed on purpose,
 * in order. The full body hash is re-baselined once for those changes; this one proves the torso,
 * pelvis, thighs, garments, extras, badge and neck of the six v1.0 styles are still the v1.0
 * vertices.
 */
export function hashBodyWithoutHead(g: BufferGeometry, seed = 0x811c9dc5): number {
  let h = seed;
  const skin = g.getAttribute('skinIndex');
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const scratch = new Float32Array(6);
  const bytes = new Uint8Array(scratch.buffer);
  for (let i = 0; i < pos.count; i++) {
    if (CR4_CHANGED_BONES.has(skin.getX(i))) continue;
    scratch[0] = pos.getX(i);
    scratch[1] = pos.getY(i);
    scratch[2] = pos.getZ(i);
    scratch[3] = nrm.getX(i);
    scratch[4] = nrm.getY(i);
    scratch[5] = nrm.getZ(i);
    for (let k = 0; k < bytes.length; k++) {
      h ^= bytes[k] as number;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

const SKINS = ['skin-04', 'skin-10'] as const;
/**
 * The golden hashes cover the six v1.0 outfit styles. Styles added later (ADR 0021) are not part
 * of the v1.0 fingerprint, so the list is pinned rather than read from AVATAR_OPTIONS.
 */
const V1_OUTFIT_STYLES = [
  'tee-jeans',
  'hoodie',
  'shirt-trousers',
  'dress',
  'suit',
  'jumpsuit',
] as const satisfies ReadonlyArray<AvatarConfig['outfitStyle']>;
const FACIAL = ['none', 'goatee', 'full-beard'] as const;

function base(patch: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_GUIDE_APPEARANCE, ...patch };
}

/** One hash per body type for the vertices that are not on the head (see `hashBodyWithoutHead`). */
export function v1BodyWithoutHeadSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const bodyType of AVATAR_OPTIONS.bodyType) {
    let h = 0x811c9dc5;
    for (const outfitStyle of V1_OUTFIT_STYLES) {
      for (const role of ['guide', 'visitor'] as const) {
        for (const skinTone of SKINS) {
          h = hashBodyWithoutHead(
            buildBodyGeometry(base({ bodyType, outfitStyle, skinTone }), role),
            h,
          );
        }
      }
    }
    out[`body-no-head:${bodyType}`] = h.toString(16);
  }
  return out;
}

/** One hash per body type (body mesh) and per hair style (hair mesh). */
export function neutralSnapshot(gender?: AvatarConfig['gender']): Record<string, string> {
  const out: Record<string, string> = {};
  const extra = gender === undefined ? {} : { gender };
  for (const bodyType of AVATAR_OPTIONS.bodyType) {
    let h = 0x811c9dc5;
    for (const outfitStyle of V1_OUTFIT_STYLES) {
      for (const role of ['guide', 'visitor'] as const) {
        for (const skinTone of SKINS) {
          for (const facialHair of FACIAL) {
            h = hashGeometry(
              buildBodyGeometry(
                base({ bodyType, outfitStyle, skinTone, facialHair, ...extra }),
                role,
              ),
              h,
            );
          }
        }
      }
    }
    out[`body:${bodyType}`] = h.toString(16);
  }
  for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
    let h = 0x811c9dc5;
    for (const hairColor of ['dark-brown', 'white'] as const) {
      for (const skinTone of SKINS) {
        for (const facialHair of AVATAR_OPTIONS.facialHair) {
          h = hashGeometry(
            buildHairGeometry(base({ hairStyle, hairColor, skinTone, facialHair, ...extra })),
            h,
          );
        }
      }
    }
    out[`hair:${hairStyle}`] = h.toString(16);
  }
  return out;
}
