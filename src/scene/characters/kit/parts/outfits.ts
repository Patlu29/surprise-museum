/**
 * The twelve outfits (design spec 9.2, 12.8.2 G, ADR 0021 7.3). An outfit is a `Garment`: colours
 * and offsets for the torso shell, the pelvis or skirt, the arm and leg colour bands, and a few
 * extras (collar, hood, belt, lapel, tie, bib) that read from behind as well as from the front.
 *
 * Rule from the spec: a large flat block in the outfit colour plus one fixed contrasting garment.
 * Each style replaces the garment, so the triangle budget is set by the worst single style.
 *
 * Trims (12.8.2 B) are vertex colours on rings that exist anyway: cuff, hem and collar rings use
 * `trimColour`, and the separation rule doubles the hem trim when the top is too close to the
 * fixed bottom. `patterned` marks the outfit-colour regions that carry the pattern (E); trims,
 * skin, shoes, the badge and the fixed contrasting garment stay plain.
 */
import type { Color } from 'three';
import type { AvatarConfig } from '@contract';
import { LOOK } from '../../../materials/look';
import { contrastRatio, darker, hex, lighter, luminance, mixColour, trimColour } from '../colour';
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
      /** Offset the centre by the torso's front (or back) surface at this height (adds ofs). */
      onChest?: boolean;
      side?: 'front' | 'back';
      segments?: number;
      rows?: number;
      patterned?: boolean;
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
      patterned?: boolean;
    };

export interface Garment {
  /** Torso shell above the hem. `patterned` covers the shell but not the hem trim. */
  chest: { colour: Color; ofs: number; hemY: number; hemColour?: Color; patterned?: boolean };
  /**
   * Trousers, joggers or the skirt's waistband. `topColour` is the colour of the waist rings (the
   * separation rule lightens a dark bottom's top edge); the crotch ring is darkened by the builder.
   */
  pelvis: { colour: Color; ofs: number; topColour?: Color; patterned?: boolean } | null;
  /** Skirt from the waist to the hem (dress, coat, tunic). */
  skirt?: {
    colour: Color;
    hemColour: Color;
    hemY: number;
    flare: number;
    /** Front-to-back depth of the hem relative to its width (default 0.88). */
    depth?: number;
    segments?: number;
    patterned?: boolean;
  };
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

/**
 * Leg swing scale for a style. Skirted garments (dress, coat, tunic) do not deform, so the walk
 * swings the legs 10% less (about 25 degrees instead of 28) to keep the thighs inside the hem.
 */
export function legScaleFor(style: OutfitStyle): number {
  return style === 'dress' || style === 'coat' || style === 'tunic' ? 0.9 : 1;
}

export function outfitColour(id: AvatarConfig['outfitColor']): Color {
  return hex(OUTFIT_COLORS[id]);
}

/**
 * Lowers any neck-bone ring so its top stays clear of the chin (face shapes with a longer chin).
 * Oval's chin is above every ring, so Oval is unchanged. Mutates and returns the garment.
 */
export function clampCollars(garment: Garment, chinY: number): Garment {
  const limit = chinY - 0.003;
  for (const e of garment.extras) {
    if (e.kind === 'ring' && e.bone === 'neck' && e.y1 > limit) {
      e.y1 = Math.max(e.y0 + 0.012, limit);
    }
  }
  return garment;
}

/** The separation rule (12.8.2 B): the top is too close to the fixed bottom. */
export function needsSeparation(top: Color, bottom: Color): boolean {
  return contrastRatio(top, bottom) < LOOK.separationThreshold;
}

/** Fixed colours the outfit styles share. */
function fixedColours() {
  return {
    denim: hex(AVATAR_FIXED.denim),
    trousers: hex(AVATAR_FIXED.trousers),
    joggers: hex(AVATAR_FIXED.joggers),
    cream: hex('#f6efe2'),
  };
}

/** Hem trim for a top over a fixed bottom: doubled when the two are close. */
function hemTrim(top: Color, bottom: Color): Color {
  return trimColour(top, needsSeparation(top, bottom) ? 2 : 1);
}

/** The bottom's waist colour: a dark bottom close to the top goes lighter at its top edge. */
function waistColour(top: Color, bottom: Color): Color | undefined {
  return needsSeparation(top, bottom) && luminance(bottom) < 0.3 ? lighter(bottom, 0.1) : undefined;
}

export function garmentFor({ style, outfit, skin }: GarmentInput): Garment {
  const { denim, trousers, joggers, cream } = fixedColours();
  const cuff = trimColour(outfit);

  switch (style) {
    case 'tee-jeans':
      return {
        chest: {
          colour: outfit,
          ofs: 0.011,
          hemY: 0.84,
          hemColour: hemTrim(outfit, denim),
          patterned: true,
        },
        pelvis: { colour: denim, ofs: 0.006, topColour: waistColour(outfit, denim) },
        armBands: [
          { until: 0.34, colour: outfit, extra: 0.01, patterned: true, endColour: cuff },
          { until: 1, colour: skin },
        ],
        legBands: [
          { until: 0.94, colour: denim, extra: 0.006 },
          { until: 1, colour: lighter(denim, 0.12), extra: 0.01 },
        ],
        extras: [],
      };

    case 'hoodie':
      return {
        chest: {
          colour: outfit,
          ofs: 0.022,
          hemY: 0.8,
          hemColour: hemTrim(outfit, joggers),
          patterned: true,
        },
        pelvis: { colour: joggers, ofs: 0.008, topColour: waistColour(outfit, joggers) },
        armBands: [
          { until: 0.93, colour: outfit, extra: 0.016, patterned: true },
          { until: 1, colour: cuff, extra: 0.011 },
        ],
        legBands: [
          { until: 0.92, colour: joggers, extra: 0.01 },
          { until: 1, colour: darker(joggers, 0.2), extra: 0.006 },
        ],
        extras: [
          // Hood bunched at the back of the neck: the signature of a hoodie from behind.
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.285, -0.085],
            radii: [0.125, 0.075, 0.085],
            colour: darker(outfit, 0.06),
            patterned: true,
          },
        ],
      };

    case 'shirt-trousers':
      return {
        chest: {
          colour: outfit,
          ofs: 0.011,
          hemY: 0.86,
          hemColour: hemTrim(outfit, trousers),
          patterned: true,
        },
        pelvis: { colour: trousers, ofs: 0.006, topColour: waistColour(outfit, trousers) },
        armBands: [
          { until: 0.95, colour: outfit, extra: 0.011, patterned: true },
          { until: 1, colour: cuff, extra: 0.013 },
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
        chest: { colour: outfit, ofs: 0.011, hemY: 0.95, patterned: true },
        pelvis: null,
        skirt: {
          colour: outfit,
          hemColour: trimColour(outfit, 1.3),
          hemY: 0.46,
          flare: 1,
          patterned: true,
        },
        armBands: [
          { until: 0.24, colour: outfit, extra: 0.01, patterned: true, endColour: cuff },
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
            colour: darker(outfit, 0.18),
          },
        ],
      };

    case 'suit':
      return {
        chest: {
          colour: outfit,
          ofs: 0.02,
          hemY: 0.74,
          hemColour: trimColour(outfit),
          patterned: true,
        },
        pelvis: { colour: outfit, ofs: 0.006, patterned: true },
        armBands: [
          { until: 0.955, colour: outfit, extra: 0.015, patterned: true },
          { until: 1, colour: cream, extra: 0.011 },
        ],
        legBands: [{ until: 1, colour: outfit, extra: 0.006, patterned: true }],
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
            colour: darker(outfit, 0.5),
            onChest: true,
          },
        ],
      };

    case 'sweater':
      return {
        chest: {
          colour: outfit,
          ofs: 0.014,
          hemY: 0.8,
          hemColour: hemTrim(outfit, trousers),
          patterned: true,
        },
        pelvis: { colour: trousers, ofs: 0.006, topColour: waistColour(outfit, trousers) },
        armBands: [
          { until: 0.93, colour: outfit, extra: 0.014, patterned: true },
          { until: 1, colour: cuff, extra: 0.016 },
        ],
        legBands: [{ until: 1, colour: trousers, extra: 0.006 }],
        extras: [
          // The ribbed hem band, a little wider than the waist.
          { kind: 'ring', bone: 'spine', y0: 0.8, y1: 0.84, grow: 0.011, colour: cuff },
          // Crew neck.
          {
            kind: 'ring',
            bone: 'neck',
            y0: 1.318,
            y1: 1.35,
            rx: 0.062,
            rz: 0.058,
            colour: cuff,
          },
        ],
      };

    case 'overalls': {
      const tee = cream;
      return {
        chest: { colour: tee, ofs: 0.011, hemY: 0.95 },
        pelvis: { colour: outfit, ofs: 0.016, topColour: trimColour(outfit), patterned: true },
        armBands: [
          { until: 0.34, colour: tee, extra: 0.01, endColour: trimColour(tee) },
          { until: 1, colour: skin },
        ],
        legBands: [
          { until: 0.94, colour: outfit, extra: 0.018, patterned: true },
          { until: 1, colour: darker(outfit, 0.16), extra: 0.02 },
        ],
        extras: [
          // Bib, and two straps over the shoulders (front and back: the back-view cue).
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.08, 0],
            radii: [0.075, 0.13, 0.012],
            colour: outfit,
            onChest: true,
            segments: 8,
            rows: 5,
            patterned: true,
          },
          ...([-1, 1] as const).flatMap((s) =>
            (['front', 'back'] as const).map((side): GarmentExtra => ({
              kind: 'ellipsoid',
              bone: 'spine',
              centre: [s * 0.05, 1.265, 0],
              radii: [0.012, 0.075, 0.011],
              rotation: [0, 0, s * 0.12],
              colour: outfit,
              onChest: true,
              side,
              segments: 6,
              rows: 3,
              patterned: true,
            })),
          ),
        ],
      };
    }

    case 'coat':
      return {
        chest: { colour: outfit, ofs: 0.02, hemY: 0.95, patterned: true },
        pelvis: null,
        skirt: {
          colour: outfit,
          hemColour: trimColour(outfit, 1.3),
          hemY: 0.42,
          flare: 1.08,
          depth: 0.98,
          segments: 16,
          patterned: true,
        },
        armBands: [
          { until: 0.94, colour: outfit, extra: 0.017, patterned: true },
          { until: 1, colour: cuff, extra: 0.019 },
        ],
        legBands: [{ until: 1, colour: trousers, extra: 0.006 }],
        extras: [
          { kind: 'ring', bone: 'neck', y0: 1.318, y1: 1.358, rx: 0.068, rz: 0.062, colour: cuff },
        ],
      };

    case 'tracksuit': {
      const bottom = darker(outfit, 0.08);
      return {
        chest: {
          colour: outfit,
          ofs: 0.02,
          hemY: 0.8,
          hemColour: trimColour(outfit, 1.2),
          patterned: true,
        },
        pelvis: { colour: bottom, ofs: 0.009, patterned: true },
        armBands: [
          { until: 0.93, colour: outfit, extra: 0.015, patterned: true },
          { until: 1, colour: cuff, extra: 0.012 },
        ],
        // Joggers: roomy at the thigh, tapering and gathered at the ankle.
        legBands: [
          { until: 0.5, colour: bottom, extra: 0.014, patterned: true },
          { until: 0.88, colour: bottom, extra: 0.006, patterned: true },
          { until: 1, colour: trimColour(bottom), extra: -0.004 },
        ],
        extras: [
          // Stand collar and the zip.
          {
            kind: 'ring',
            bone: 'neck',
            y0: 1.318,
            y1: 1.356,
            rx: 0.064,
            rz: 0.058,
            colour: darker(outfit, 0.06),
          },
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.1, 0],
            radii: [0.006, 0.17, 0.01],
            colour: mixColour(outfit, cream, 0.55),
            onChest: true,
            segments: 6,
            rows: 3,
          },
        ],
      };
    }

    case 'cardigan':
      return {
        chest: {
          colour: outfit,
          ofs: 0.02,
          hemY: 0.8,
          hemColour: hemTrim(outfit, trousers),
          patterned: true,
        },
        pelvis: { colour: trousers, ofs: 0.006, topColour: waistColour(outfit, trousers) },
        armBands: [
          { until: 0.93, colour: outfit, extra: 0.016, patterned: true },
          { until: 1, colour: cuff, extra: 0.013 },
        ],
        legBands: [{ until: 1, colour: trousers, extra: 0.006 }],
        extras: [
          // The open front: a cream tee panel between two button lines.
          {
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [0, 1.1, 0],
            radii: [0.05, 0.15, 0.012],
            colour: cream,
            onChest: true,
            segments: 8,
            rows: 5,
          },
          ...([-1, 1] as const).map((s): GarmentExtra => ({
            kind: 'ellipsoid',
            bone: 'spine',
            centre: [s * 0.058, 1.1, 0],
            radii: [0.007, 0.15, 0.013],
            colour: cuff,
            onChest: true,
            segments: 6,
            rows: 3,
          })),
        ],
      };

    case 'tunic':
      return {
        chest: { colour: outfit, ofs: 0.013, hemY: 0.95, patterned: true },
        pelvis: null,
        skirt: {
          colour: outfit,
          hemColour: trimColour(outfit, 1.2),
          hemY: 0.5,
          flare: 0.8,
          depth: 1,
          segments: 16,
          patterned: true,
        },
        armBands: [
          { until: 0.95, colour: outfit, extra: 0.014, patterned: true },
          { until: 1, colour: cuff, extra: 0.013 },
        ],
        legBands: [{ until: 1, colour: trousers, extra: 0.006 }],
        extras: [
          // Mandarin (stand) collar.
          { kind: 'ring', bone: 'neck', y0: 1.318, y1: 1.35, rx: 0.056, rz: 0.052, colour: cuff },
        ],
      };

    case 'jumpsuit':
    default:
      return {
        chest: { colour: outfit, ofs: 0.011, hemY: 0.8, patterned: true },
        pelvis: { colour: outfit, ofs: 0.009, patterned: true },
        armBands: [
          { until: 0.4, colour: outfit, extra: 0.01, patterned: true, endColour: cuff },
          { until: 1, colour: skin },
        ],
        legBands: [
          { until: 0.93, colour: outfit, extra: 0.008, patterned: true },
          { until: 1, colour: darker(outfit, 0.16), extra: 0.011 },
        ],
        extras: [
          {
            kind: 'ring',
            bone: 'spine',
            y0: 0.94,
            y1: 0.97,
            grow: 0.006,
            colour: darker(outfit, 0.2),
          },
        ],
      };
  }
}
