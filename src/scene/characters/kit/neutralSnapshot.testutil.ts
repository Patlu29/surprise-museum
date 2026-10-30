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

const SKINS = ['skin-04', 'skin-10'] as const;
const FACIAL = ['none', 'goatee', 'full-beard'] as const;

function base(patch: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_GUIDE_APPEARANCE, ...patch };
}

/** One hash per body type (body mesh) and per hair style (hair mesh). */
export function neutralSnapshot(gender?: AvatarConfig['gender']): Record<string, string> {
  const out: Record<string, string> = {};
  const extra = gender === undefined ? {} : { gender };
  for (const bodyType of AVATAR_OPTIONS.bodyType) {
    let h = 0x811c9dc5;
    for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
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
