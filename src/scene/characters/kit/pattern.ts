/**
 * The pattern ink (design spec 12.8.2 E, ADR 0021 Q-31): a tint of the outfit colour, never a
 * second picker. The shader draws `mix(vertexColour, target, amount)` where the pattern shows.
 *
 *   - outfit luminance 0.3 or more: a shade, the colour at 72% brightness (target black);
 *   - otherwise a tint, lifted 45% toward cream `#efe3cc` (target cream).
 * The amount is then adjusted until the contrast ratio between the colour and its ink is between
 * 1.6 and 4, so a pattern is calm, never harsh and never invisible.
 */
import { Color } from 'three';
import { contrastRatio, luminance } from './colour';

export const PATTERN_CREAM = '#efe3cc';
export const PATTERN_MIN_CONTRAST = 1.6;
export const PATTERN_MAX_CONTRAST = 4;
/** Luminance at or above which the ink is a shade and below which it is a tint. */
export const PATTERN_SHADE_LUMINANCE = 0.3;

export interface PatternInk {
  /** Linear colour the ink moves toward (black for a shade, cream for a tint). */
  target: Color;
  /** 0 to 1 amount of the move. */
  amount: number;
  /** The resulting ink colour for a base colour (what the shader draws on a pure outfit pixel). */
  ink: Color;
}

/** Ink for an outfit colour. Pure and deterministic, so unit tests can cover all 12 colours. */
export function patternInk(outfit: Color): PatternInk {
  const shade = luminance(outfit) >= PATTERN_SHADE_LUMINANCE;
  const target = shade ? new Color(0, 0, 0) : new Color(PATTERN_CREAM);
  let amount = shade ? 0.28 : 0.45;
  const inkAt = (a: number) => outfit.clone().lerp(target, a);
  // The contrast grows with the amount: nudge it into range, keeping the starting value if it fits.
  for (let i = 0; i < 200; i++) {
    const c = contrastRatio(outfit, inkAt(amount));
    if (c < PATTERN_MIN_CONTRAST && amount < 0.95) amount += 0.01;
    else if (c > PATTERN_MAX_CONTRAST && amount > 0.02) amount -= 0.01;
    else break;
  }
  return { target, amount, ink: inkAt(amount) };
}
