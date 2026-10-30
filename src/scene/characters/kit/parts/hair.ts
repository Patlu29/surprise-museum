/**
 * Hair styles and facial hair (design spec 9.2), designed back-first: the Visitor mostly sees her
 * character from behind, so the silhouette from behind carries the style. Volume and length are
 * exaggerated slightly so the twelve styles differ at 120 px tall.
 *
 * Every style is built from three ingredients: a hairline-following cap, a few ellipsoids for
 * volume, and optional tails or curtains skinned to the `hairBack` bone so they can swing.
 * Hair colour also colours the brows and facial hair.
 */
import type { Color } from 'three';
import { type BufferGeometry } from 'three';
import type { AvatarConfig } from '@contract';
import { browColour, hex, mixColour, shade } from '../colour';
import { PartBuilder, type BoneName } from '../geometry/partBuilder';
import { ellipsoid, hairline, loft, shell, tube, type Ring } from '../geometry/surface';
import { HAIR_COLORS, SKIN_TONES } from '../palette';
import { HEAD, headCentre, shapeFor, type AvatarShape } from '../proportions';
import { featureOnHead } from './face';

export type HairStyle = AvatarConfig['hairStyle'];
export type FacialHair = AvatarConfig['facialHair'];

const [HX, HY, HZ] = headCentre();
const C: readonly [number, number, number] = [HX, HY, HZ];
const R: readonly [number, number, number] = [HEAD.rx, HEAD.ry, HEAD.rz];

interface Ctx {
  b: PartBuilder;
  hair: Color;
  skin: Color;
}

function cap(
  ctx: Ctx,
  thickness: number,
  front: number,
  side: number,
  back: number,
  options: { colour?: Color; segments?: number; rows?: number } = {},
): void {
  ctx.b.add(
    shell({
      centre: C,
      radii: R,
      thickness,
      lower: hairline(front, side, back),
      segments: options.segments ?? 20,
      rows: options.rows ?? 5,
      colour: options.colour ?? ctx.hair,
    }),
    'head',
  );
}

function blob(
  ctx: Ctx,
  bone: BoneName,
  centre: readonly [number, number, number],
  radii: readonly [number, number, number],
  options: {
    colour?: Color;
    rotation?: readonly [number, number, number];
    segments?: number;
    rows?: number;
  } = {},
): void {
  ctx.b.add(
    ellipsoid(centre, radii, {
      colour: options.colour ?? ctx.hair,
      rotation: options.rotation,
      segments: options.segments ?? 10,
      rows: options.rows ?? 6,
    }),
    bone,
  );
}

/** A curtain of hair behind the head and shoulders, skinned to hairBack so it can sway. */
function curtain(ctx: Ctx, rings: readonly Ring[], half: number, segments = 16): void {
  const geometry = loft(
    rings.map((r) => ({ ...r, colour: r.colour ?? ctx.hair })),
    // The arc is centred on the back of the head (theta = PI).
    { segments, arc: [Math.PI - half, Math.PI + half] },
  );
  ctx.b.add(geometry, 'hairBack');
}

const HAIR_BUILDERS: Record<HairStyle, (ctx: Ctx) => void> = {
  shaved(ctx) {
    // A faint scalp shadow so the style reads as chosen, not missing.
    cap(ctx, 0.002, 0.62, 0.28, -0.25, { colour: mixColour(ctx.skin, ctx.hair, 0.28) });
  },

  buzz(ctx) {
    cap(ctx, 0.006, 0.6, 0.26, -0.28);
  },

  'short-crop'(ctx) {
    cap(ctx, 0.02, 0.5, 0.3, -0.22);
    blob(ctx, 'head', [HX, HY + 0.135, HZ + 0.015], [0.115, 0.065, 0.125]);
    blob(ctx, 'head', [HX, HY + 0.095, HZ + 0.125], [0.105, 0.035, 0.045], {
      rotation: [0.25, 0, 0],
    });
  },

  'side-part'(ctx) {
    cap(ctx, 0.025, 0.45, 0.2, -0.32);
    blob(ctx, 'head', [HX + 0.035, HY + 0.13, HZ + 0.025], [0.12, 0.068, 0.13], {
      rotation: [0, 0, -0.12],
    });
    blob(ctx, 'head', [HX + 0.105, HY + 0.07, HZ + 0.085], [0.06, 0.055, 0.075], {
      rotation: [0.2, 0.3, 0],
    });
  },

  'curly-short'(ctx) {
    cap(ctx, 0.012, 0.5, 0.12, -0.35);
    // Curls on a golden spiral over the crown, plus a ring round the back and sides.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const crown = 14;
    for (let i = 0; i < crown; i++) {
      const phi = 0.2 + (i / (crown - 1)) * 1.2;
      const theta = i * golden;
      const cp = Math.cos(phi);
      blob(
        ctx,
        'head',
        [
          HX + (HEAD.rx + 0.028) * cp * Math.sin(theta),
          HY + (HEAD.ry + 0.028) * Math.sin(phi),
          HZ + (HEAD.rz + 0.028) * cp * Math.cos(theta),
        ],
        [0.04, 0.04, 0.04],
        { segments: 6, rows: 4 },
      );
    }
    for (let i = 0; i < 10; i++) {
      const theta = Math.PI * (0.55 + (i / 9) * 0.9) * (i % 2 === 0 ? 1 : -1);
      const phi = -0.15 + (i % 3) * 0.12;
      const cp = Math.cos(phi);
      blob(
        ctx,
        'head',
        [
          HX + (HEAD.rx + 0.026) * cp * Math.sin(theta),
          HY + (HEAD.ry + 0.026) * Math.sin(phi),
          HZ + (HEAD.rz + 0.026) * cp * Math.cos(theta),
        ],
        [0.037, 0.037, 0.037],
        { segments: 6, rows: 4 },
      );
    }
  },

  bob(ctx) {
    cap(ctx, 0.03, 0.5, -0.1, -0.7);
    curtain(
      ctx,
      [
        { y: HY - 0.17, rx: 0.17, rz: 0.162, cz: -0.002 },
        { y: HY - 0.09, rx: 0.188, rz: 0.176 },
        { y: HY + 0.03, rx: 0.186, rz: 0.172 },
        { y: HY + 0.1, rx: 0.17, rz: 0.158 },
      ],
      2.35,
    );
    blob(ctx, 'head', [HX, HY + 0.095, HZ + 0.13], [0.12, 0.04, 0.05], { rotation: [0.25, 0, 0] });
  },

  'long-straight'(ctx) {
    cap(ctx, 0.03, 0.5, -0.05, -0.8);
    curtain(
      ctx,
      [
        { y: HY - 0.46, rx: 0.1, rz: 0.03, cz: -0.12 },
        { y: HY - 0.42, rx: 0.13, rz: 0.04, cz: -0.115 },
        { y: HY - 0.26, rx: 0.15, rz: 0.06, cz: -0.085 },
        { y: HY - 0.12, rx: 0.17, rz: 0.15, cz: -0.01 },
        { y: HY + 0.02, rx: 0.17, rz: 0.165 },
      ],
      2.2,
    );
    blob(ctx, 'head', [HX, HY + 0.095, HZ + 0.13], [0.115, 0.04, 0.05], { rotation: [0.25, 0, 0] });
  },

  'long-wavy'(ctx) {
    cap(ctx, 0.035, 0.5, -0.05, -0.8);
    const wave = (i: number) => 0.016 * Math.sin(i * 2.1);
    curtain(
      ctx,
      [
        { y: HY - 0.5, rx: 0.115 + wave(0), rz: 0.04, cz: -0.125 },
        { y: HY - 0.43, rx: 0.16 + wave(1), rz: 0.05, cz: -0.12 },
        { y: HY - 0.34, rx: 0.145 + wave(2), rz: 0.055, cz: -0.1 },
        { y: HY - 0.24, rx: 0.175 + wave(3), rz: 0.07, cz: -0.085 },
        { y: HY - 0.12, rx: 0.19 + wave(4), rz: 0.15, cz: -0.012 },
        { y: HY + 0.02, rx: 0.18, rz: 0.17 },
      ],
      2.3,
      20,
    );
    blob(ctx, 'head', [HX, HY + 0.1, HZ + 0.13], [0.12, 0.045, 0.055], { rotation: [0.25, 0, 0] });
  },

  ponytail(ctx) {
    cap(ctx, 0.025, 0.5, 0.2, -0.3);
    blob(ctx, 'head', [HX, HY + 0.11, HZ - 0.07], [0.1, 0.07, 0.1]);
    // Hair tie, then a tapering tail that hangs and swings.
    blob(ctx, 'hairBack', [0, HY + 0.07, -0.158], [0.042, 0.03, 0.036], {
      colour: shade(ctx.hair, 0.62),
    });
    ctx.b.add(
      tube({
        from: [0, HY + 0.06, -0.165],
        to: [0, HY - 0.33, -0.21],
        radiusFrom: 0.052,
        radiusTo: 0.026,
        depthScale: 0.7,
        bands: [{ until: 1, colour: ctx.hair }],
        capFrom: true,
        capTo: true,
        segments: 10,
        bulge: 0.25,
      }),
      'hairBack',
    );
  },

  bun(ctx) {
    cap(ctx, 0.025, 0.5, 0.2, -0.3);
    blob(ctx, 'head', [HX, HY + 0.15, HZ - 0.075], [0.075, 0.07, 0.075], { segments: 12, rows: 7 });
    blob(ctx, 'head', [HX, HY + 0.1, HZ - 0.05], [0.062, 0.02, 0.062], {
      colour: shade(ctx.hair, 0.62),
    });
  },

  afro(ctx) {
    // A big round halo that thins to the face at its lower edge, so it frames the face
    // instead of floating in front of it.
    const smooth = (t: number) => t * t * (3 - 2 * t);
    ctx.b.add(
      shell({
        centre: [HX, HY + 0.035, HZ - 0.035],
        radii: R,
        thickness: (t) => 0.014 + 0.11 * smooth(Math.min(1, t * 1.7)),
        lower: hairline(0.2, -0.1, -0.55),
        segments: 28,
        rows: 8,
        colour: ctx.hair,
      }),
      'head',
    );
  },

  braids(ctx) {
    cap(ctx, 0.025, 0.5, 0.05, -0.5);
    for (const side of [-1, 1]) {
      const x = side * 0.085;
      const links = 7;
      for (let i = 0; i < links; i++) {
        const y = HY - 0.03 - i * 0.052;
        const z = -0.13 - i * 0.004;
        const zig = (i % 2 === 0 ? 1 : -1) * 0.007;
        blob(ctx, 'hairBack', [x + zig, y, z], [0.03, 0.036, 0.03], { segments: 7, rows: 4 });
      }
      blob(ctx, 'hairBack', [x, HY - 0.03 - links * 0.052, -0.158], [0.022, 0.03, 0.022], {
        colour: shade(ctx.hair, 0.6),
        segments: 7,
        rows: 4,
      });
    }
    blob(ctx, 'head', [HX, HY + 0.095, HZ + 0.12], [0.1, 0.035, 0.045], { rotation: [0.25, 0, 0] });
  },
};

/** Thin brows in the hair colour, moved only as needed to keep a minimum contrast with the skin. */
function addBrows(ctx: Ctx, thickness: number): void {
  const colour = browColour(ctx.hair, ctx.skin);
  for (const s of [-1, 1]) {
    ctx.b.add(
      featureOnHead(s * 0.38, 0.28, [0.028, 0.0065 * thickness, 0.007], colour, {
        lift: 0.0005,
        roll: s * 0.14,
      }),
      'head',
    );
  }
}

function moustache(ctx: Ctx, lift: number): void {
  for (const s of [-1, 1]) {
    ctx.b.add(
      featureOnHead(s * 0.17, -0.285, [0.032, 0.0115, 0.012], ctx.hair, { lift, roll: s * -0.22 }),
      'head',
    );
  }
}

const FACIAL_HAIR_BUILDERS: Record<FacialHair, ((ctx: Ctx) => void) | null> = {
  none: null,

  stubble(ctx) {
    const colour = mixColour(ctx.skin, ctx.hair, 0.42);
    ctx.b.add(
      shell({
        centre: C,
        radii: R,
        thickness: 0.0025,
        lower: () => -1.15,
        upper: (t) => -0.3 + 0.28 * Math.pow(Math.abs(Math.sin(t)), 3),
        arc: [-1.3, 1.3],
        segments: 14,
        rows: 4,
        colour,
      }),
      'head',
    );
  },

  moustache(ctx) {
    moustache(ctx, 0.004);
  },

  goatee(ctx) {
    moustache(ctx, 0.004);
    ctx.b.add(
      shell({
        centre: C,
        radii: R,
        thickness: 0.016,
        lower: () => -1.12,
        upper: () => -0.55,
        arc: [-0.5, 0.5],
        segments: 10,
        rows: 4,
        colour: ctx.hair,
      }),
      'head',
    );
  },

  'full-beard'(ctx) {
    ctx.b.add(
      shell({
        centre: C,
        radii: R,
        thickness: 0.018,
        lower: () => -1.2,
        upper: (t) => -0.3 + 0.32 * Math.pow(Math.abs(Math.sin(t)), 2.5),
        arc: [-1.35, 1.35],
        segments: 18,
        rows: 5,
        colour: ctx.hair,
      }),
      'head',
    );
    moustache(ctx, 0.02);
  },
};

export function buildHairGeometry(
  config: AvatarConfig,
  shape: AvatarShape = shapeFor(config),
): BufferGeometry | null {
  const ctx: Ctx = {
    b: new PartBuilder(shape),
    hair: hex(HAIR_COLORS[config.hairColor]),
    skin: hex(SKIN_TONES[config.skinTone]),
  };
  HAIR_BUILDERS[config.hairStyle](ctx);
  addBrows(ctx, shape.brow);
  FACIAL_HAIR_BUILDERS[config.facialHair]?.(ctx);
  return ctx.b.build();
}
