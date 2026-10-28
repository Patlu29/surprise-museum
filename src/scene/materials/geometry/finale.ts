/**
 * The finale room's set pieces (design spec 1.5): podium, lectern with guest book, light cone,
 * dust motes and the oculus. Local origin is the floor point under each piece.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  RingGeometry,
} from 'three';
import { SCENE_PALETTE } from '../palette';
import {
  boxPart,
  mergeParts,
  normaliseAttributes,
  setConstantAttribute,
  setVertexColour,
} from './builders';

export const PODIUM = {
  radius: 1.5,
  height: 0.18,
  ringInner: 1.16,
  ringOuter: 1.23,
} as const;

/**
 * A low cream stone disc with a thin brass inlay ring. The ring has aGlow = 1: raise the podium
 * material's glow to brighten it on enter (300 ms) and for the R2 "all viewed" pulse.
 */
export function createPodiumGeometry(): BufferGeometry {
  const { radius, height, ringInner, ringOuter } = PODIUM;
  const segments = 56;
  const cream = SCENE_PALETTE.podium;

  const side = new CylinderGeometry(radius, radius * 1.015, height, segments, 1, true);
  side.translate(0, height / 2, 0);
  setVertexColour(side, cream);
  setConstantAttribute(side, 'aGlow', 0);

  const top = (inner: number, outer: number, colour: string, glow: number) => {
    const g =
      inner <= 0
        ? new CircleGeometry(outer, segments)
        : new RingGeometry(inner, outer, segments, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, height + (glow > 0 ? 0.0015 : 0), 0);
    setVertexColour(g, colour);
    setConstantAttribute(g, 'aGlow', glow);
    return g;
  };

  const parts = [
    side,
    top(0, ringInner, cream, 0),
    top(ringInner, ringOuter, SCENE_PALETTE.brass, 0.55),
    top(ringOuter, radius, cream, 0),
  ];
  const merged = mergeParts(parts);
  // UVs are unused on the podium; zero them so the attribute set matches the others.
  merged.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(merged.getAttribute('position').count * 2), 2),
  );
  return normaliseAttributes(merged);
}

/**
 * A walnut lectern with a cream open guest book. Footprint 0.6 by 0.4 m (solid in the layout),
 * front facing +Z towards the approaching Visitor. About 1.05 m tall.
 */
export function createLecternGeometry(): BufferGeometry {
  const walnut = SCENE_PALETTE.frame;
  const parts: BufferGeometry[] = [
    boxPart(0.6, 0.08, 0.4, { y: 0.04, colour: walnut }),
    boxPart(0.34, 0.86, 0.24, { y: 0.08 + 0.43, colour: walnut }),
    boxPart(0.1, 0.78, 0.04, { y: 0.08 + 0.41, z: 0.131, colour: '#5a4032' }),
  ];

  // Sloped desk, tilted towards the reader.
  const desk = new BoxGeometry(0.6, 0.05, 0.4);
  desk.rotateX(0.32);
  desk.translate(0, 1.0, 0);
  setVertexColour(desk, walnut);
  setConstantAttribute(desk, 'aGlow', 0);
  parts.push(desk);

  // Open book: two page blocks meeting at a spine, on the desk.
  for (const side of [-1, 1]) {
    const page = new BoxGeometry(0.21, 0.014, 0.28);
    page.rotateZ(side * 0.07);
    page.rotateX(0.32);
    page.translate(side * 0.108, 1.043, 0.012);
    setVertexColour(page, SCENE_PALETTE.mat);
    setConstantAttribute(page, 'aGlow', 0);
    parts.push(page);
  }
  const spine = new BoxGeometry(0.012, 0.022, 0.29);
  spine.rotateX(0.32);
  spine.translate(0, 1.038, 0.012);
  setVertexColour(spine, SCENE_PALETTE.brassDeep);
  setConstantAttribute(spine, 'aGlow', 0);
  parts.push(spine);

  return normaliseAttributes(mergeParts(parts.map(stripUv)));
}

function stripUv(g: BufferGeometry): BufferGeometry {
  g.deleteAttribute('uv');
  g.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2),
  );
  return g;
}

export interface LightConeGeometryOptions {
  /** Radius at the oculus (top). */
  radiusTop?: number;
  /** Radius where the light reaches the floor. */
  radiusBottom?: number;
  height?: number;
}

/**
 * The open-ended cone for `LightConeMaterial`. Origin at the cone's centre; for a 3.2 m room
 * place it at y = height / 2 so the narrow end meets the oculus.
 */
export function createLightConeGeometry(options: LightConeGeometryOptions = {}): BufferGeometry {
  const rt = options.radiusTop ?? 0.4;
  const rb = options.radiusBottom ?? 1.5;
  const h = options.height ?? 3.2;
  return new CylinderGeometry(rt, rb, h, 28, 1, true);
}

export interface DustMoteGeometryOptions {
  /** Design spec 1.5: 40 or fewer. */
  count?: number;
  /** A fixed seed keeps preview and published museums identical. */
  seed?: number;
}

/** Deterministic mulberry32 generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeds for `DustMotesMaterial`. All motion is computed in the vertex shader, so the geometry is
 * static. Positions are placeholders (the shader ignores them) but kept valid for culling: set
 * `frustumCulled = false` on the Points.
 */
export function createDustMoteGeometry(options: DustMoteGeometryOptions = {}): BufferGeometry {
  const count = Math.min(40, Math.max(1, options.count ?? 32));
  const next = rng(options.seed ?? 20261027);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = next();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  return g;
}
