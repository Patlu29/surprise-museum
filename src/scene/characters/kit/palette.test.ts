/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { AVATAR_OPTIONS } from '@contract';
import { describe, expect, it } from 'vitest';
import { AVATAR_FIXED, HAIR_COLORS, OUTFIT_COLORS, SKIN_BLUSH, SKIN_TONES } from './palette';

/** Vitest blanks CSS imports, so read the token file directly. */
const tokensCss = readFileSync(new URL('../../../styles/tokens.css', import.meta.url), 'utf8');

function tokenMap(prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`--avatar-${prefix}-([a-z0-9-]+):\\s*(#[0-9a-fA-F]{6})\\s*;`, 'g');
  for (const m of tokensCss.matchAll(re)) {
    const [, id, hex] = m;
    if (id && hex) out.set(id, hex.toLowerCase());
  }
  return out;
}

describe('avatar palette', () => {
  it('has a colour for every skin tone id, matching tokens.css', () => {
    const tokens = tokenMap('skin');
    expect(Object.keys(SKIN_TONES).sort()).toEqual([...AVATAR_OPTIONS.skinTone].sort());
    for (const id of AVATAR_OPTIONS.skinTone) {
      expect(SKIN_TONES[id], id).toBe(tokens.get(id.replace('skin-', '')));
    }
  });

  it('has a colour for every hair colour id, matching tokens.css', () => {
    const tokens = tokenMap('hair');
    expect(Object.keys(HAIR_COLORS).sort()).toEqual([...AVATAR_OPTIONS.hairColor].sort());
    for (const id of AVATAR_OPTIONS.hairColor) expect(HAIR_COLORS[id], id).toBe(tokens.get(id));
  });

  it('has a colour for every outfit colour id, matching tokens.css', () => {
    const tokens = tokenMap('outfit');
    expect(Object.keys(OUTFIT_COLORS).sort()).toEqual([...AVATAR_OPTIONS.outfitColor].sort());
    for (const id of AVATAR_OPTIONS.outfitColor) expect(OUTFIT_COLORS[id], id).toBe(tokens.get(id));
  });

  it('mirrors the fixed garment and badge tokens', () => {
    const expected: Array<[keyof typeof AVATAR_FIXED, string]> = [
      ['denim', 'denim'],
      ['trousers', 'trousers'],
      ['joggers', 'joggers'],
      ['shoes', 'shoes'],
      ['sole', 'sole'],
      ['eye', 'eye'],
      ['badgeGuide', 'badge-guide'],
      ['badgeVisitor', 'badge-visitor'],
      ['badgeHeart', 'badge-heart'],
    ];
    for (const [key, token] of expected) {
      const m = new RegExp(`--avatar-${token}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss);
      expect(AVATAR_FIXED[key], key).toBe(m?.[1]?.toLowerCase());
    }
  });

  it('mirrors the blush token', () => {
    const m = /--avatar-skin-blush:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(tokensCss);
    expect([Number(m?.[1]), Number(m?.[2]), Number(m?.[3])]).toEqual([...SKIN_BLUSH.rgb]);
    expect(Number(m?.[4])).toBeCloseTo(SKIN_BLUSH.alpha, 5);
  });
});
