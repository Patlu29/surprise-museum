import { AVATAR_OPTIONS } from '@contract';
import { describe, expect, it } from 'vitest';
import { BROW_MIN_CONTRAST, browColour, contrastRatio, hex, luminance } from './colour';
import { HAIR_COLORS, SKIN_TONES } from './palette';

describe('browColour (design spec 9.7)', () => {
  for (const skinId of AVATAR_OPTIONS.skinTone) {
    for (const hairId of AVATAR_OPTIONS.hairColor) {
      it(`reads against the skin: ${skinId} x ${hairId}`, () => {
        const skin = hex(SKIN_TONES[skinId]);
        const hair = hex(HAIR_COLORS[hairId]);
        const brow = browColour(hair, skin);
        expect(contrastRatio(brow, skin)).toBeGreaterThanOrEqual(BROW_MIN_CONTRAST - 1e-3);
        if (contrastRatio(hair, skin) >= BROW_MIN_CONTRAST) expect(brow.equals(hair)).toBe(true);
      });
    }
  }

  it('lightens black hair on the deepest skin and keeps a warm hue', () => {
    const hair = hex(HAIR_COLORS.black);
    const brow = browColour(hair, hex(SKIN_TONES['skin-10']));
    expect(luminance(brow)).toBeGreaterThan(luminance(hair));
    expect(brow.r).toBeGreaterThanOrEqual(brow.g);
  });

  it('darkens white hair on the palest skin', () => {
    const hair = hex(HAIR_COLORS.white);
    expect(luminance(browColour(hair, hex(SKIN_TONES['skin-01'])))).toBeLessThan(luminance(hair));
  });

  it('does not mutate its inputs', () => {
    const hair = hex(HAIR_COLORS.black);
    const before = hair.getHex();
    browColour(hair, hex(SKIN_TONES['skin-10']));
    expect(hair.getHex()).toBe(before);
  });
});
