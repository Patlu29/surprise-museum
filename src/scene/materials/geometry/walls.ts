/**
 * Walls, doorways and ceiling dressing (design spec 1.4).
 *
 * One vertex-coloured geometry per wall run, so every wall in the museum shares one material and
 * can be merged into one draw call with `mergePlaced`. The linen weave comes from a tiling
 * texture; the warm-to-shaded gradient and the skirting come from vertex colours, which is
 * baked-looking lighting at no runtime cost.
 */
import type { BufferGeometry } from 'three';
import { CircleGeometry, Color, RingGeometry } from 'three';
import { SCENE_PALETTE } from '../palette';
import {
  applyMetreUv,
  boxPart,
  mergeParts,
  normaliseAttributes,
  setConstantAttribute,
  setVertexColour,
} from './builders';

export const WALL = {
  height: 3.2,
  thickness: 0.2,
  skirtingHeight: 0.12,
  /** Skirting stands this far proud of the wall face. */
  skirtingProud: 0.015,
  doorWidth: 2.4,
  doorHeight: 2.7,
  architrave: 0.12,
  /** One tile of the linen texture covers this many metres. */
  linenTileMetres: 1.2,
} as const;

export type WallVariant = 'gallery' | 'finale';

export interface Doorway {
  /** Centre along the wall's local X, from -length/2 to +length/2. */
  centre: number;
  width?: number;
  height?: number;
}

export interface WallRunOptions {
  /** Length along local X, metres. */
  length: number;
  height?: number;
  thickness?: number;
  variant?: WallVariant;
  /** Openings cut into the wall. Each gets a lintel and a painted architrave. */
  doorways?: readonly Doorway[];
  /** Set false for walls with no skirting (for example a short return). */
  skirting?: boolean;
}

interface WallColours {
  wall: Color;
  shade: Color;
  skirting: Color;
}

function wallColours(variant: WallVariant): WallColours {
  if (variant === 'finale') {
    const wall = new Color(SCENE_PALETTE.finaleWall);
    // Same 100% to ~80% ceiling gradient as the galleries, from the claret base.
    const shade = wall.clone().multiplyScalar(0.78);
    // Skirting dims with the room so the pale paint does not glare against the claret.
    const skirting = new Color(SCENE_PALETTE.skirting).multiplyScalar(0.62);
    return { wall, shade, skirting };
  }
  return {
    wall: new Color(SCENE_PALETTE.wall),
    shade: new Color(SCENE_PALETTE.wallShade),
    skirting: new Color(SCENE_PALETTE.skirting),
  };
}

/** Wall colour at height y: wall colour up to 1 m, easing to the shade colour at the ceiling. */
function gradientAt(y: number, height: number, c: WallColours): Color {
  const t = Math.min(1, Math.max(0, (y - 1.0) / Math.max(0.01, height - 1.0)));
  const eased = t * t * (3 - 2 * t);
  return c.wall.clone().lerp(c.shade, eased);
}

/**
 * A wall slab spanning x0..x1 and y0..y1 (local), with the vertical gradient written into vertex
 * colours. Only the four visible vertical faces and the top are kept to save triangles.
 */
function wallSlab(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  thickness: number,
  fullHeight: number,
  colours: WallColours,
): BufferGeometry {
  const w = x1 - x0;
  const h = y1 - y0;
  const g = boxPart(w, h, thickness, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, colour: '#ffffff' });
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const c = gradientAt(pos.getY(i), fullHeight, colours);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return g;
}

function skirtingStrip(
  x0: number,
  x1: number,
  thickness: number,
  colours: WallColours,
): BufferGeometry {
  const depth = thickness + WALL.skirtingProud * 2;
  return boxPart(x1 - x0, WALL.skirtingHeight, depth, {
    x: (x0 + x1) / 2,
    y: WALL.skirtingHeight / 2,
    colour: colours.skirting,
  });
}

/**
 * Builds a straight wall run, centred on x = 0, standing on y = 0, centred on z = 0.
 * Doorways are cut as openings with a lintel above and a painted architrave around them.
 * Faces +Z and -Z are both wall faces, so the run works for either side of a room.
 */
export function createWallRunGeometry(options: WallRunOptions): BufferGeometry {
  const height = options.height ?? WALL.height;
  const thickness = options.thickness ?? WALL.thickness;
  const colours = wallColours(options.variant ?? 'gallery');
  const half = options.length / 2;
  const withSkirting = options.skirting ?? true;

  const doors = [...(options.doorways ?? [])]
    .map((d) => ({
      x0: Math.max(-half, d.centre - (d.width ?? WALL.doorWidth) / 2),
      x1: Math.min(half, d.centre + (d.width ?? WALL.doorWidth) / 2),
      top: Math.min(height, d.height ?? WALL.doorHeight),
    }))
    .sort((a, b) => a.x0 - b.x0);

  const parts: BufferGeometry[] = [];
  let cursor = -half;
  for (const d of doors) {
    if (d.x0 > cursor + 1e-4) {
      parts.push(wallSlab(cursor, d.x0, 0, height, thickness, height, colours));
      if (withSkirting) parts.push(skirtingStrip(cursor, d.x0, thickness, colours));
    }
    // Lintel above the opening.
    if (height - d.top > 1e-4) {
      parts.push(wallSlab(d.x0, d.x1, d.top, height, thickness, height, colours));
    }
    // Architrave: two jambs and a head, proud of the wall on both faces.
    const a = WALL.architrave;
    const depth = thickness + WALL.skirtingProud * 2;
    const archColour = colours.skirting;
    parts.push(
      boxPart(a, d.top + a, depth, { x: d.x0 + a / 2, y: (d.top + a) / 2, colour: archColour }),
      boxPart(a, d.top + a, depth, { x: d.x1 - a / 2, y: (d.top + a) / 2, colour: archColour }),
      boxPart(d.x1 - d.x0, a, depth, {
        x: (d.x0 + d.x1) / 2,
        y: d.top + a / 2,
        colour: archColour,
      }),
    );
    cursor = d.x1;
  }
  if (half - cursor > 1e-4) {
    parts.push(wallSlab(cursor, half, 0, height, thickness, height, colours));
    if (withSkirting) parts.push(skirtingStrip(cursor, half, thickness, colours));
  }

  const merged = mergeParts(parts);
  applyMetreUv(merged, WALL.linenTileMetres);
  return normaliseAttributes(merged);
}

/** A flat ceiling (normal pointing down) centred on x = 0, z = 0 at y = `height`. */
export function createCeilingGeometry(
  width: number,
  depth: number,
  height: number = WALL.height,
): BufferGeometry {
  const g = boxPart(width, 0.02, depth, { y: height + 0.01, colour: SCENE_PALETTE.ceiling });
  return normaliseAttributes(applyMetreUv(g, 2));
}

export interface CeilingRoseOptions {
  radius?: number;
  /** Colour of the glowing lamp disc at the centre. */
  lampColour?: string;
}

/**
 * A brass ceiling rose with a warm lamp disc. Faces down. Origin at the ceiling surface, so
 * place it at y = ceiling height. Also used for the finale oculus (pass a larger radius).
 * The lamp disc has aGlow = 1, so it reads as lit.
 */
export function createCeilingRoseGeometry(options: CeilingRoseOptions = {}): BufferGeometry {
  const radius = options.radius ?? 0.4;
  const segments = 32;
  const down = -Math.PI / 2;

  const outer = new RingGeometry(radius * 0.72, radius, segments);
  outer.rotateX(down);
  outer.translate(0, -0.012, 0);
  setVertexColour(outer, SCENE_PALETTE.brass);
  setConstantAttribute(outer, 'aGlow', 0);

  const inner = new RingGeometry(radius * 0.58, radius * 0.72, segments);
  inner.rotateX(down);
  inner.translate(0, -0.006, 0);
  setVertexColour(inner, SCENE_PALETTE.brassDeep);
  setConstantAttribute(inner, 'aGlow', 0);

  const lamp = new CircleGeometry(radius * 0.58, segments);
  lamp.rotateX(down);
  lamp.translate(0, -0.01, 0);
  setVertexColour(lamp, options.lampColour ?? '#fff0d2');
  setConstantAttribute(lamp, 'aGlow', 1);

  return normaliseAttributes(mergeParts([outer, inner, lamp]));
}

/** A recessed brass-edged light strip for long rooms. Faces down, origin at the ceiling. */
export function createCeilingStripGeometry(length: number, width = 0.3): BufferGeometry {
  const parts = [
    boxPart(width + 0.08, 0.016, length + 0.08, {
      y: -0.008,
      colour: SCENE_PALETTE.brass,
    }),
    boxPart(width, 0.012, length, { y: -0.016, colour: '#fff0d2', glow: 1 }),
  ];
  return normaliseAttributes(mergeParts(parts));
}
