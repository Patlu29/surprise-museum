/**
 * The six outfits (design spec 9.2). An outfit is a `Garment`: colours and offsets for the
 * torso shell, the pelvis or skirt, the arm and leg colour bands, and a few extras (collar,
 * hood, belt, lapel and tie) that read from behind as well as from the front.
 *
 * Rule from the spec: a large flat block in the outfit colour plus one fixed contrasting garment.
 */
import type { Color } from 'three';
import type { AvatarConfig } from '@contract';
import { hex, mixColour, shade } from '../colour';
import { AVATAR_FIXED, OUTFIT_COLORS } from '../palette';
import type { TubeBand } from '../geometry/surface';

export type OutfitStyle = AvatarConfig['outfitStyle'];

/** A decorative extra: an ellipsoid or a belt ring, in model-space coordinates. */
export type GarmentExtra =
  | {
      kind: 'ellipsoid';
      bone: 'spine' | 'hips' | 'neck';
      centre: readonly [number, number, number];
      radii: readonly [number, number, number];
      colour: Color;
      rotation?: readonly [number, number, number];
      /** Offset the centre by the torso's front surface at this height (adds ofs). */
      onChest?: boolean;
    }
  | {
      kind: 'ring';
      bone: 'spine' | 'hips' | 'neck';
      y0: number;
      y1: number;
      /**
       * `grow` rings follow the torso: radius is the body's plus the garment offset plus `grow`.
       * `rx` and `rz` are absolute (used at the neck).
       */
      grow?: number;
      rx?: number;
      rz?: number;
      colour: Color;
    };

export interface Garment {
  /** Torso shell above the hem. */
  chest: { colour: Color; ofs: number; hemY: number; hemColour?: Color };
  /** Trousers, joggers or the skirt's waistband. */
  pelvis: { colour: Color; ofs: number } | null;
  /** Skirt from the waist to the hem (dress only). */
  skirt?: { colour: Color; hemColour: Color; hemY: number; flare: number };
  /** Colour bands along the whole arm, 0 at the shoulder to 1 at the wrist. */
  armBands: TubeBand[];
  /** Colour bands along the whole leg, 0 at the hip to 1 at the ankle. */
  legBands: TubeBand[];
  extras: GarmentExtra[];
}

export interface GarmentInput {
  style: OutfitStyle;
  outfit: Color;
  skin: Color;
}

export function outfitColour(id: AvatarConfig['outfitColor']): Color {
  return hex(OUTFIT_COLORS[id]);
}

export function garmentFor({ style, outfit, skin }: GarmentInput): Garment {
  const denim = hex(AVATAR_FIXED.denim);
  const trousers = hex(AVATAR_FIXED.trousers);
  const joggers = hex(AVATAR_FIXED.joggers);
  const cream = hex('#f6efe2');

  switch (style) {
    case 'tee-jeans':
      return {
        chest: { colour: outfit, ofs: 0.011, hemY: 0.84 },
        pelvis: { colour: denim, ofs: 0.006 },
        armBands: [
          { until: 0.34, colour: outfit, extra: 0.01 },
          { until: 1, colour: skin },
        ],
        legBands: [
          { until: 0.94, colour: denim, extra: 0.006 },
          { until: 1, colour: shade(denim, 1.18), extra: 0.01 },
        ],
        extras: [],
      };

    case 'hoodie':
      return {
        chest: { colour: outfit, ofs: 0.022, hemY: 0.8, hemColour: shade(outfit, 0.86) },
        pelvis: { colour: joggers, ofs: 0.008 },
        armBands: [
          { until: 0.93, colour: outfit, extra: 0.016 },
          { until: 1, colour: shade(outfit, 0.86), extra: 0.011 },
        ],
        legBands: [
          { until: 0.92, colour: joggers, extra: 0.01 },
          { until: 1, colour: shade(joggers, 0.8), extra: 0.006 },
        ],
        extras: [
          // Hood bunched at the back of the neck: the signature of a hoodie from behind.
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.285, -0.085],
            radii: [0.125, 0.075, 0.085],
            colour: shade(outfit, 0.94),
          },
        ],
      };

    case 'shirt-trousers':
      return {
        chest: { colour: outfit, ofs: 0.011, hemY: 0.86 },
        pelvis: { colour: trousers, ofs: 0.006 },
        armBands: [
          { until: 0.95, colour: outfit, extra: 0.011 },
          { until: 1, colour: shade(outfit, 0.9), extra: 0.013 },
        ],
        legBands: [{ until: 1, colour: trousers, extra: 0.006 }],
        extras: [
          {
            kind: 'ring',
            bone: 'hips',
            y0: 0.925,
            y1: 0.955,
            grow: 0.007,
            colour: hex(AVATAR_FIXED.shoes),
          },
          {
            kind: 'ring',
            bone: 'neck',
            y0: 1.318,
            y1: 1.352,
            rx: 0.062,
            rz: 0.058,
            colour: mixColour(outfit, cream, 0.45),
          },
        ],
      };

    case 'dress':
      return {
        chest: { colour: outfit, ofs: 0.011, hemY: 0.95 },
        pelvis: null,
        skirt: { colour: outfit, hemColour: shade(outfit, 0.84), hemY: 0.46, flare: 1 },
        armBands: [
          { until: 0.24, colour: outfit, extra: 0.01 },
          { until: 1, colour: skin },
        ],
        legBands: [{ until: 1, colour: skin }],
        extras: [
          {
            kind: 'ring',
            bone: 'spine',
            y0: 0.94,
            y1: 0.968,
            grow: 0.006,
            colour: shade(outfit, 0.82),
          },
        ],
      };

    case 'suit':
      return {
        chest: { colour: outfit, ofs: 0.02, hemY: 0.74, hemColour: shade(outfit, 0.92) },
        pelvis: { colour: outfit, ofs: 0.006 },
        armBands: [
          { until: 0.955, colour: outfit, extra: 0.015 },
          { until: 1, colour: cream, extra: 0.011 },
        ],
        legBands: [{ until: 1, colour: outfit, extra: 0.006 }],
        extras: [
          { kind: 'ring', bone: 'neck', y0: 1.318, y1: 1.358, rx: 0.066, rz: 0.06, colour: cream },
          // Shirt front, V-shaped panel, and a darker tie.
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.2, 0],
            radii: [0.04, 0.1, 0.01],
            colour: cream,
            onChest: true,
          },
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.17, 0.0],
            radii: [0.014, 0.075, 0.008],
            colour: shade(outfit, 0.5),
            onChest: true,
          },
        ],
      };

    case 'jumpsuit':
    default:
      return {
        chest: { colour: outfit, ofs: 0.011, hemY: 0.8 },
        pelvis: { colour: outfit, ofs: 0.009 },
        armBands: [
          { until: 0.4, colour: outfit, extra: 0.01 },
          { until: 1, colour: skin },
        ],
        legBands: [
          { until: 0.93, colour: outfit, extra: 0.008 },
          { until: 1, colour: shade(outfit, 0.84), extra: 0.011 },
        ],
        extras: [
          {
            kind: 'ring',
            bone: 'spine',
            y0: 0.94,
            y1: 0.97,
            grow: 0.006,
            colour: shade(outfit, 0.8),
          },
        ],
      };
  }
}
