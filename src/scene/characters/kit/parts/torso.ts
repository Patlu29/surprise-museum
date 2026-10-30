/**
 * Torso ring definitions shared by the skin, the garments and the badge placement, so clothes
 * always follow the body type exactly.
 */
import type { Color } from 'three';
import { BASE, type AvatarShape } from '../proportions';
import type { Ring } from '../geometry/surface';

const WAIST_Y = BASE.hipY + BASE.waistRise;
const NECK_Y = BASE.hipY + BASE.torsoLength;

export interface TorsoRings {
  /** Hips up to the waist (hips bone). */
  pelvis: Ring[];
  /** Waist up to the neck base (spine bone). */
  chest: Ring[];
}

/** Rings for the body at `ofs` metres outside the skin. Colour is applied by the caller. */
export function torsoRings(shape: AvatarShape, ofs = 0): TorsoRings {
  const hipY = BASE.hipY;
  const pelvis: Ring[] = [
    { y: hipY - 0.1, rx: 0, rz: 0, pole: true },
    { y: hipY - 0.085, rx: 0.07 * shape.hip + ofs, rz: 0.072 + ofs },
    { y: hipY - 0.04, rx: 0.125 * shape.hip + ofs, rz: 0.098 + ofs },
    { y: hipY + 0.04, rx: 0.15 * shape.hip + ofs, rz: 0.108 + ofs },
    { y: WAIST_Y, rx: 0.128 * shape.waist + ofs, rz: 0.1 + ofs },
  ];
  const chest: Ring[] = [
    { y: WAIST_Y, rx: 0.128 * shape.waist + ofs, rz: 0.1 + ofs },
    {
      y: WAIST_Y + 0.1,
      rx: 0.138 * shape.chest + ofs,
      rz: 0.108 * shape.chest * shape.depth + ofs,
    },
    { y: 1.16, rx: 0.15 * shape.shoulder + ofs, rz: 0.106 * shape.chest * shape.depth + ofs },
    { y: 1.26, rx: 0.158 * shape.shoulder + ofs, rz: 0.1 * shape.chest * shape.depth + ofs },
    { y: 1.31, rx: 0.11 * shape.shoulder + ofs, rz: 0.08 + ofs },
    { y: NECK_Y + 0.005, rx: 0.05 + ofs, rz: 0.046 + ofs },
    { y: NECK_Y + 0.015 + ofs, rx: 0, rz: 0, pole: true },
  ];
  return { pelvis, chest };
}

/** Applies one colour to rings that have none. */
export function paint(rings: readonly Ring[], colour: Color): Ring[] {
  return rings.map((r) => ({ ...r, colour: r.colour ?? colour }));
}

export { WAIST_Y, NECK_Y };
