/**
 * CR-4 look values: a typed mirror of the `--look-*` design tokens (design spec 12.8, 12.9).
 *
 * Source of truth: src/styles/tokens.css (owner: ux-ui-designer). three.js cannot read CSS custom
 * properties, so the values are copied here. `look.test.ts` parses every `--look-*` token and
 * fails on drift, on a missing mirror and on an extra key, so a token change needs only a
 * matching edit in this file.
 *
 * Colours are sRGB hex. Numbers are shader or geometry parameters. `rgba` tokens are kept as parts
 * because the alpha is applied by the shader or the decal, not baked into the colour.
 */

export const LOOK = {
  // Character edge: a dual-band screen-space edge (12.8.2 A).
  /** Dark contour colour, ink-aubergine. */
  contour: '#2a1620',
  /** Light rim colour, warm cream. */
  rim: '#ffe3bd',
  /** Rim band width in CSS pixels (times the pixel ratio in the shader). */
  rimPx: 0.6,
  /** Outer limit of the contour band, CSS pixels from the silhouette. */
  contourPx: 1.5,
  contourMax: 0.95,
  rimMax: 0.6,
  /** Adjacent regions below this contrast ratio get a seam trim (12.8.2 B). */
  separationThreshold: 1.3,
  // Face definition (12.8.2 C).
  eyeScale: 1.1,
  catchlight: '#fffaf0',
  browThickness: 1.45,
  /** Minimum brow-to-skin contrast ratio (was 2). */
  browContrast: 3,
  /** Warm tan the brow is lightened toward on deep skin, instead of white. */
  browLift: '#b88a6a',
  mouthThickness: 1.22,
  // Museum finish (12.8.3).
  dado: '#d9c3a6',
  dadoRail: '#f3eadc',
  ao: '#2a1620',
  aoWallBase: 0.12,
  aoCeiling: 0.18,
  washAlpha: 0.18,
  frameFillet: '#c9a15b',
  runnerBorder: '#5e2234',
  ceilingStrip: '#ffe2b0',
  plinthSide: '#d8ccb8',
  /** `--look-contact-shadow: rgba(30, 20, 25, 0.28)`. */
  contactShadow: { hex: '#1e1419', rgb: [30, 20, 25], alpha: 0.28 },
  stageCentre: '#f7f0e4',
  stageEdge: '#e8dcc9',
} as const;

export type LookKey = keyof typeof LOOK;
