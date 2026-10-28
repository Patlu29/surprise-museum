/**
 * Scene palette: a typed mirror of the `--scene-*` design tokens.
 *
 * Source of truth: src/styles/tokens.css (owner: ux-ui-designer) and docs/design-spec.md,
 * sections 1.4 and 1.5. three.js cannot read CSS custom properties, so the values are copied
 * here. `palette.test.ts` parses tokens.css and fails if any value drifts, so a token change
 * needs only a matching edit in this file.
 *
 * Hex strings are sRGB. `new Color(hex)` converts them to the linear working space, so pass
 * these straight to three.js and never convert by hand.
 */

export const SCENE_PALETTE = {
  /** Warm linen plaster. */
  wall: '#e6d7c3',
  /** Vertex-colour gradient target towards the ceiling. */
  wallShade: '#cdb89e',
  skirting: '#f3eadc',
  /** Oak boards. */
  floor: '#b88a5f',
  floorGrain: '#8f6643',
  /** Dark, so each room feels lit by its pictures. */
  ceiling: '#3b2c33',
  /** Claret carpet runner. */
  runner: '#7a2e43',
  runnerEdge: '#c9a15b',
  /** Walnut. */
  frame: '#4a3226',
  /** Cream mount. */
  mat: '#f3ebdd',
  brass: '#c9a15b',
  brassDeep: '#9c7637',
  plaque: '#f6eee2',
  plaqueInk: '#2a1f26',
  /** Key light colour, about 3000 K. */
  lightWarm: '#ffe9c9',
  lightSky: '#fff2de',
  lightGround: '#7a5844',
  /** Floor and wall light pools (additive, low alpha). */
  pool: '#ffd9a0',
  /** Deep claret. */
  finaleWall: '#5a2236',
  finaleFloor: '#2e2229',
  podium: '#f1e8da',
  /** Finale light cone. */
  spot: '#ffe2b0',
  hintGlow: '#ffd166',
} as const;

export type SceneColourKey = keyof typeof SCENE_PALETTE;

/**
 * `--scene-blob-shadow: rgba(30, 20, 25, 0.35)`. Kept as parts because the alpha is applied by
 * the shader, not baked into the colour.
 */
export const BLOB_SHADOW = {
  hex: '#1e1419',
  rgb: [30, 20, 25],
  alpha: 0.35,
} as const;

/** Looks up a palette colour by key. Exists so call sites read `scene('wall')`. */
export function scene(key: SceneColourKey): string {
  return SCENE_PALETTE[key];
}
