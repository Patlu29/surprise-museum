import { Color } from 'three';
import { LOOK } from '../../materials/look';

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

/** Minimum brow-to-skin contrast ratio (design spec 12.8.2 C, `--look-brow-contrast`; was 2). */
export const BROW_MIN_CONTRAST: number = LOOK.browContrast;

/** Minimum facial-hair-to-skin contrast ratio (the brow rule with a lower floor, spec 12.8.2 C). */
export const FACIAL_HAIR_MIN_CONTRAST = 1.6;

const WHITE = new Color(1, 1, 1);
const BROW_LIFT = new Color(LOOK.browLift);

/**
 * Hair-derived colour for a feature that must read against the skin (brows, facial hair): the
 * hair colour, moved only as far as needed to reach `minContrast`. Darker-than-skin hair is
 * darkened first. If that cannot reach the floor (deep skin leaves no room to go darker), the
 * colour is lightened along black, then the warm tan `--look-brow-lift`, then white, so black
 * brows on `skin-10` become a warm brown (about `#8c674f`, 3.0:1) and not a faint grey. Lighter
 * hair is lightened first and darkened as a last resort (white brows on the palest skin become a
 * soft brown). A hair colour that already reaches the floor is returned unchanged.
 */
export function browColour(hair: Color, skin: Color, minContrast = BROW_MIN_CONTRAST): Color {
  if (contrastRatio(hair, skin) >= minContrast) return hair.clone();
  const darken = (t: number) => hair.clone().multiplyScalar(1 - t);
  // Lightening path: hair to the warm tan (when the hair is darker than it), then on to white.
  const viaLift = luminance(hair) < luminance(BROW_LIFT);
  const lighten = (t: number) =>
    viaLift
      ? t <= 0.5
        ? hair.clone().lerp(BROW_LIFT, t * 2)
        : BROW_LIFT.clone().lerp(WHITE, (t - 0.5) * 2)
      : hair.clone().lerp(WHITE, t);
  const search = (make: (t: number) => Color): Color | null => {
    if (contrastRatio(make(1), skin) < minContrast) return null;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(make(mid), skin) >= minContrast) hi = mid;
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

/** Facial hair colour: the hair colour kept visible against the skin (1.6:1 floor). */
export function facialHairColour(hair: Color, skin: Color): Color {
  return browColour(hair, skin, FACIAL_HAIR_MIN_CONTRAST);
}

/** Mixes toward white by `f` (0 to 1): "lighter" for trims. A new colour. */
export function lighter(a: Color, f: number): Color {
  return a.clone().lerp(WHITE, f);
}

/** Scales brightness by `1 - f`: "darker" for trims. A new colour. */
export function darker(a: Color, f: number): Color {
  return a.clone().multiplyScalar(1 - f);
}

/**
 * Trim colour for a seam (cuff, hem, collar; design spec 12.8.2 B): 12% darker when the region is
 * light (luminance over 0.3), lighter when it is dark. `strength` 2 is the doubled trim of the
 * separation rule. The dark case mixes 10% toward white in linear light, which is about the
 * "25% lighter" of the spec as seen (a straight 25% multiply of a navy is invisible).
 */
export function trimColour(a: Color, strength = 1): Color {
  return luminance(a) > 0.3 ? darker(a, 0.12 * strength) : lighter(a, 0.1 * strength);
}
