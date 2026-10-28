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
