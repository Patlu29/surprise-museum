/**
 * Frames, picture lights and plaques (design spec 1.4).
 *
 * Frame anatomy, from the photo outwards: a 0.04 m cream mount, then a 0.02 m walnut rim; depth
 * 0.05 m. Local origin is the centre of the photo, `z = 0` is the wall surface and +Z faces the
 * room. The photo plane itself belongs to the scene (it needs a texture); `createPhotoGeometry`
 * returns a plane of the right size at the right depth, and `createPhotoMaterial` an unlit
 * material that is never tone mapped, so a photo is always evenly lit (FR-40).
 */
import type { BufferGeometry } from 'three';
import {
  BufferAttribute,
  BufferGeometry as Geometry,
  CylinderGeometry,
  PlaneGeometry,
} from 'three';
import { LOOK } from '../look';
import { SCENE_PALETTE } from '../palette';
import {
  boxPart,
  mergeParts,
  normaliseAttributes,
  setConstantAttribute,
  setVertexColour,
} from './builders';

export const FRAME = {
  rim: 0.02,
  mount: 0.04,
  /** rim + mount: the border added around the photo on every side. */
  border: 0.06,
  depth: 0.05,
  /** Depth of the mount's front face; the walnut rim stands proud of it. */
  mountDepth: 0.036,
  /** The photo plane sits here, recessed behind the mount. */
  photoZ: 0.02,
} as const;

/** Brass fillet between the walnut and the mount (design spec 12.8.3): 3 mm wide, 8 triangles. */
export const FILLET = { width: 0.003 } as const;
/** The mount's inner edge is shaded this much darker (a fake bevel), vertex colour only. */
export const MOUNT_BEVEL = 0.06;

/** A flat rectangular ring (four quads, 8 triangles) in the plane z, facing +Z. */
function flatRing(outerW: number, outerH: number, inset: number, z: number, colour: string) {
  const ow = outerW / 2;
  const oh = outerH / 2;
  const iw = ow - inset;
  const ih = oh - inset;
  // Outer then inner corners, counter-clockwise from the lower left.
  const o = [
    [-ow, -oh],
    [ow, -oh],
    [ow, oh],
    [-ow, oh],
  ] as const;
  const i = [
    [-iw, -ih],
    [iw, -ih],
    [iw, ih],
    [-iw, ih],
  ] as const;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [x, y] of [...o, ...i]) positions.push(x, y, z);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    // Quad between outer k, outer n, inner n, inner k.
    indices.push(k, n, 4 + n, k, 4 + n, 4 + k);
  }
  const g = new Geometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const normals = new Float32Array(8 * 3);
  for (let k = 0; k < 8; k++) normals[k * 3 + 2] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(indices);
  setVertexColour(g, colour);
  setConstantAttribute(g, 'aGlow', 0);
  return normaliseAttributes(g);
}

/** Darkens the vertices of `part` for which `inner` is true by `MOUNT_BEVEL` (vertex colours only). */
function shadeVertices(
  part: BufferGeometry,
  inner: (x: number, y: number) => boolean,
): BufferGeometry {
  const pos = part.getAttribute('position');
  const col = part.getAttribute('color');
  for (let v = 0; v < pos.count; v++) {
    if (!inner(pos.getX(v), pos.getY(v))) continue;
    const k = 1 - MOUNT_BEVEL;
    col.setXYZ(v, col.getX(v) * k, col.getY(v) * k, col.getZ(v) * k);
  }
  return part;
}

/** The photo plane, sized to the photo, positioned inside the frame. UVs are the default 0 to 1. */
export function createPhotoGeometry(photoWidth: number, photoHeight: number): BufferGeometry {
  const g = new PlaneGeometry(photoWidth, photoHeight);
  g.translate(0, 0, FRAME.photoZ);
  return g;
}

/** Walnut rim and cream mount around a photo of the given size. One draw call. */
export function createFrameGeometry(photoWidth: number, photoHeight: number): BufferGeometry {
  const { rim, mount, border, depth, mountDepth } = FRAME;
  const outerW = photoWidth + border * 2;
  const outerH = photoHeight + border * 2;
  const walnut = SCENE_PALETTE.frame;
  const cream = SCENE_PALETTE.mat;
  const parts: BufferGeometry[] = [
    // Walnut rim: top and bottom span the full width, sides fit between them.
    boxPart(outerW, rim, depth, { y: outerH / 2 - rim / 2, z: depth / 2, colour: walnut }),
    boxPart(outerW, rim, depth, { y: -outerH / 2 + rim / 2, z: depth / 2, colour: walnut }),
    boxPart(rim, outerH - rim * 2, depth, {
      x: -outerW / 2 + rim / 2,
      z: depth / 2,
      colour: walnut,
    }),
    boxPart(rim, outerH - rim * 2, depth, {
      x: outerW / 2 - rim / 2,
      z: depth / 2,
      colour: walnut,
    }),
    // Cream mount, inside the rim, a little lower than the rim's front face. The vertices on the
    // photo side are 6% darker, so the mount reads as bevelled (a fake bevel, vertex colour only).
    shadeVertices(
      boxPart(outerW - rim * 2, mount, mountDepth, {
        y: photoHeight / 2 + mount / 2,
        z: mountDepth / 2,
        colour: cream,
      }),
      (_x, y) => y < photoHeight / 2 + 1e-6,
    ),
    shadeVertices(
      boxPart(outerW - rim * 2, mount, mountDepth, {
        y: -photoHeight / 2 - mount / 2,
        z: mountDepth / 2,
        colour: cream,
      }),
      (_x, y) => y > -photoHeight / 2 - 1e-6,
    ),
    shadeVertices(
      boxPart(mount, photoHeight, mountDepth, {
        x: -photoWidth / 2 - mount / 2,
        z: mountDepth / 2,
        colour: cream,
      }),
      (x) => x > -photoWidth / 2 - 1e-6,
    ),
    shadeVertices(
      boxPart(mount, photoHeight, mountDepth, {
        x: photoWidth / 2 + mount / 2,
        z: mountDepth / 2,
        colour: cream,
      }),
      (x) => x < photoWidth / 2 + 1e-6,
    ),
    // Brass fillet where the mount meets the walnut: a 3 mm flat ring just proud of the mount face.
    flatRing(
      outerW - rim * 2,
      outerH - rim * 2,
      FILLET.width,
      mountDepth + 0.0006,
      LOOK.frameFillet,
    ),
  ];
  return normaliseAttributes(mergeParts(parts));
}

/**
 * A small brass picture light: wall plate, arm, bar and a visible warm strip underneath.
 * Positioned for a frame of the given photo height, sitting above the frame's top edge.
 * The strip has aGlow = 1 so it reads as lit.
 */
export function createPictureLightGeometry(
  photoWidth: number,
  photoHeight: number,
): BufferGeometry {
  const brass = SCENE_PALETTE.brass;
  const deep = SCENE_PALETTE.brassDeep;
  const barLength = Math.min(0.6, Math.max(0.28, photoWidth * 0.5));
  const y = photoHeight / 2 + FRAME.border + 0.13;
  const reach = 0.17;

  const bar = new CylinderGeometry(0.022, 0.022, barLength, 12, 1);
  bar.rotateZ(Math.PI / 2);
  bar.translate(0, y, reach);
  setVertexColour(bar, brass);
  setConstantAttribute(bar, 'aGlow', 0);

  const parts: BufferGeometry[] = [
    boxPart(0.05, 0.07, 0.012, { y, z: 0.006, colour: deep }),
    boxPart(0.014, 0.014, reach, { y, z: reach / 2, colour: brass }),
    bar,
    boxPart(barLength * 0.92, 0.004, 0.028, { y: y - 0.024, z: reach, colour: '#fff0d2', glow: 1 }),
  ];
  return normaliseAttributes(mergeParts(parts));
}

/** A flat plaque face (0.18 by 0.12 m by default). The texture carries the brass border and text. */
export function createPlaqueGeometry(width = 0.18, height = 0.12): BufferGeometry {
  const g = new PlaneGeometry(width, height);
  g.translate(0, 0, 0.004);
  return g;
}
