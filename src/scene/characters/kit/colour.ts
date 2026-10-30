import { Color } from 'three';

const cache = new Map<string, Color>();

/** A cached read-only colour from an sRGB hex string. Never mutate the result. */
export function hex(value: string): Color {
  let c = cache.get(value);
  if (!c) {
    c = new Color(value);
    cache.set(value, c);
  }
  return c;
}

/** Linear-space mix of two colours (new Color). */
export function mixColour(a: Color, b: Color, t: number): Color {
  return a.clone().lerp(b, t);
}

/** Multiplies brightness (k < 1 darkens, k > 1 lightens, clamped to 1). */
export function shade(a: Color, k: number): Color {
  const c = a.clone().multiplyScalar(k);
  c.r = Math.min(1, c.r);
  c.g = Math.min(1, c.g);
  c.b = Math.min(1, c.b);
  return c;
}

/** Relative luminance of a colour in linear space. */
export function luminance(c: Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** WCAG-style contrast ratio (1 to 21) between two colours' linear luminances. */
export function contrastRatio(a: Color, b: Color): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Minimum brow-to-skin contrast ratio (design spec 9.7: brows read at the preview's size). */
export const BROW_MIN_CONTRAST = 2;

/**
 * Brow colour: the hair colour, moved only as far as needed to reach `BROW_MIN_CONTRAST` against
 * the skin. A brow darker than the skin is darkened (scaled toward black), a lighter one is
 * lightened (mixed toward white); if that cannot reach the target (a very deep skin leaves no room
 * to go darker, a very pale one none to go lighter) the other direction is used, so black brows on
 * deep skin become a lighter warm brown and white brows on pale skin become a soft grey-brown. A hair
 * colour that already has enough contrast is returned unchanged.
 */
export function browColour(hair: Color, skin: Color): Color {
  if (contrastRatio(hair, skin) >= BROW_MIN_CONTRAST) return hair.clone();
  const lighten = (t: number) => hair.clone().lerp(WHITE, t);
  const darken = (t: number) => hair.clone().multiplyScalar(1 - t);
  const search = (make: (t: number) => Color): Color | null => {
    if (contrastRatio(make(1), skin) < BROW_MIN_CONTRAST) return null;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(make(mid), skin) >= BROW_MIN_CONTRAST) hi = mid;
      else lo = mid;
    }
    return make(hi);
  };
  const order = luminance(hair) > luminance(skin) ? [lighten, darken] : [darken, lighten];
  for (const make of order) {
    const found = search(make);
    if (found) return found;
  }
  return hair.clone();
}

const WHITE = new Color(1, 1, 1);
