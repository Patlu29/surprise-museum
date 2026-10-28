/**
 * Procedural, deterministic tiling textures, generated into `DataTexture`s in plain JavaScript.
 *
 * Why not image files: the museum's surfaces (oak, linen, pile) are low-contrast and tile, so a
 * small generated texture beats a download, costs no bytes on the wire (NFR-4) and works in
 * Node for tests. The same seed always produces the same pixels, so preview and published
 * museums match. Sizes are powers of two. Colour maps are tagged sRGB; the `quality` option
 * halves the resolution for low-end phones.
 *
 * Generation cost: about 10 to 30 ms for the largest on a desktop, a little more on a phone.
 * Create them once and cache (the museum materials factory does).
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { SCENE_PALETTE } from './palette';
import type { GraphicsQuality } from './quality';

// ---------------------------------------------------------------------------------------------
// Maths helpers
// ---------------------------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Integer hash to a float in [0, 1). */
function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise on a lattice that repeats every `px` by `py` cells, so the texture tiles. */
function tileNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const wrap = (v: number, p: number) => ((v % p) + p) % p;
  const a = hash2(wrap(x0, px), wrap(y0, py), seed);
  const b = hash2(wrap(x0 + 1, px), wrap(y0, py), seed);
  const c = hash2(wrap(x0, px), wrap(y0 + 1, py), seed);
  const d = hash2(wrap(x0 + 1, px), wrap(y0 + 1, py), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function finish(data: Uint8Array, width: number, height: number): DataTexture {
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const scaleFor = (quality: GraphicsQuality) => (quality === 'low' ? 0.5 : 1);

// ---------------------------------------------------------------------------------------------
// Wood
// ---------------------------------------------------------------------------------------------

export interface WoodTextureOptions {
  /** Board colour (sRGB hex). */
  base: string;
  /** Grain and gap colour (sRGB hex). */
  grain: string;
  seed?: number;
  /** 0 to 1.5; scales the grain and tint variation. */
  contrast?: number;
  quality?: GraphicsQuality;
}

/**
 * Wide boards running along the texture's V axis. One tile is 4 boards across (0.8 m) by two
 * board lengths (1.6 m). UVs from `createFloorGeometry` already use that scale.
 */
export function createWoodTexture(options: WoodTextureOptions): DataTexture {
  const scale = scaleFor(options.quality ?? 'high');
  const width = Math.round(256 * scale);
  const height = Math.round(512 * scale);
  const seed = options.seed ?? 7;
  const contrast = options.contrast ?? 1;
  const boards = 4;
  const [br, bg, bb] = hexToRgb(options.base);
  const [gr, gg, gb] = hexToRgb(options.grain);
  const data = new Uint8Array(width * height * 4);

  // Joint positions: each column has two boards per tile, offset so seams never line up.
  const joint = Array.from({ length: boards }, (_, c) => hash2(c, 11, seed));
  const tileAlongMetres = 1.6;
  const jointHalfWidth = 0.006 / tileAlongMetres;

  for (let py = 0; py < height; py++) {
    const v = py / height;
    for (let px = 0; px < width; px++) {
      const u = px / width;
      const column = Math.min(boards - 1, Math.floor(u * boards));
      const xLocal = u * boards - column;

      // Which of the column's two boards are we on, and how far from a joint?
      const j1 = joint[column] ?? 0;
      const rel = (((v - j1) % 1) + 1) % 1;
      const segment = rel < 0.5 ? 0 : 1;
      const boardId = column * 2 + segment;
      const nearestJoint = Math.min(rel, Math.abs(rel - 0.5), 1 - rel);

      const tint = 1 + (hash2(boardId, 3, seed) - 0.5) * 0.16 * contrast;
      const phase = hash2(boardId, 5, seed) * 9;

      // Grain: warped contour lines along the board plus fine streaks.
      const warp = tileNoise(xLocal * 2.5 + phase, v * 5 + phase, 1000, 5, seed + 1);
      const contour = 0.5 + 0.5 * Math.sin((xLocal * 6 + warp * 3.2 + phase) * Math.PI * 2);
      const streak = tileNoise(xLocal * 34 + phase, v * 2.5, 1000, 3, seed + 2);
      const grainAmount = clamp01((contour * 0.32 + (streak - 0.5) * 0.3 + 0.08) * contrast);

      let r = mix(br, gr, grainAmount) * tint;
      let g = mix(bg, gg, grainAmount) * tint;
      let b = mix(bb, gb, grainAmount) * tint;

      // Dark gaps between boards and at end joints.
      const edge = Math.min(xLocal, 1 - xLocal) * (0.2 / 0.4); // metres to the board edge, ~0.2 m wide boards
      const gap = edge < 0.004 ? 0.55 : edge < 0.008 ? 0.82 : 1;
      const jointGap =
        nearestJoint < jointHalfWidth ? 0.6 : nearestJoint < jointHalfWidth * 2 ? 0.85 : 1;
      const shade = Math.min(gap, jointGap);
      r *= shade;
      g *= shade;
      b *= shade;

      const o = (py * width + px) * 4;
      data[o] = Math.min(255, Math.round(r));
      data[o + 1] = Math.min(255, Math.round(g));
      data[o + 2] = Math.min(255, Math.round(b));
      data[o + 3] = 255;
    }
  }
  return finish(data, width, height);
}

/** Oak boards in the gallery colours (`--scene-floor`, `--scene-floor-grain`). */
export function createOakFloorTexture(quality: GraphicsQuality = 'high'): DataTexture {
  return createWoodTexture({
    base: SCENE_PALETTE.floor,
    grain: SCENE_PALETTE.floorGrain,
    seed: 7,
    quality,
  });
}

/** Dark polished boards for the finale room (`--scene-finale-floor`), grain kept subtle. */
export function createFinaleFloorTexture(quality: GraphicsQuality = 'high'): DataTexture {
  return createWoodTexture({
    base: SCENE_PALETTE.finaleFloor,
    // A touch lighter than the base so the grain reads under the warm light.
    grain: '#1c1519',
    seed: 19,
    contrast: 0.8,
    quality,
  });
}

// ---------------------------------------------------------------------------------------------
// Linen plaster and pile
// ---------------------------------------------------------------------------------------------

/**
 * A near-white, low-contrast linen weave with soft plaster blotches. Multiplied with the wall's
 * vertex colours, so the wall colours stay true to the tokens. One tile is 1.2 m.
 */
export function createLinenTexture(quality: GraphicsQuality = 'high'): DataTexture {
  const size = Math.round(256 * scaleFor(quality));
  const data = new Uint8Array(size * size * 4);
  const threads = size / 4; // one thread pair every 4 px
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const warp = 0.5 + 0.5 * Math.sin(u * threads * Math.PI * 2);
      const weft = 0.5 + 0.5 * Math.sin(v * threads * Math.PI * 2);
      const weave = (warp + weft) * 0.5;
      const slub = tileNoise(u * 24, v * 24, 24, 24, 31);
      const blotch = tileNoise(u * 4, v * 4, 4, 4, 41);
      const value = 0.955 + (weave - 0.5) * 0.035 + (slub - 0.5) * 0.03 + (blotch - 0.5) * 0.04;
      const byte = Math.round(255 * clamp01(value));
      const o = (py * size + px) * 4;
      data[o] = byte;
      data[o + 1] = byte;
      data[o + 2] = byte;
      data[o + 3] = 255;
    }
  }
  return finish(data, size, size);
}

/** A soft brushed-pile texture for the runner; multiplied with its claret vertex colours. */
export function createRunnerPileTexture(quality: GraphicsQuality = 'high'): DataTexture {
  const size = Math.round(128 * scaleFor(quality) * (quality === 'low' ? 2 : 1));
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const fine = hash2(px, py, 53);
      const brush = tileNoise(u * 48, v * 6, 48, 6, 59);
      const value = 0.93 + (fine - 0.5) * 0.06 + (brush - 0.5) * 0.08;
      const byte = Math.round(255 * clamp01(value));
      const o = (py * size + px) * 4;
      data[o] = byte;
      data[o + 1] = byte;
      data[o + 2] = byte;
      data[o + 3] = 255;
    }
  }
  return finish(data, size, size);
}
