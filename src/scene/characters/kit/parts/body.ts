/**
 * The body mesh: head, face, neck, torso, garments, limbs, hands, shoes and badge, merged into
 * one skinned geometry (one draw call). Everything is rigid-skinned to one bone per part.
 */
import type { Color } from 'three';
import {
  Matrix4,
  Quaternion,
  ShapeGeometry,
  Vector3,
  CylinderGeometry,
  Shape,
  type BufferGeometry,
} from 'three';
import type { AvatarConfig } from '@contract';
import { darker, hex, shade } from '../colour';
import { PartBuilder, type BoneName } from '../geometry/partBuilder';
import { ellipsoid, loft, ringsAt, tube, type Ring, type TubeBand } from '../geometry/surface';
import { AVATAR_FIXED, BADGE_RING_BRASS, SKIN_TONES } from '../palette';
import {
  BASE,
  HEAD,
  chinBottomY,
  headCentre,
  jointsFor,
  shapeFor,
  type AvatarShape,
} from '../proportions';
import { buildFace, mouthLiftFor } from './face';
import { clampCollars, garmentFor, outfitColour, type Garment, type GarmentExtra } from './outfits';
import { HAIRLINES, type HairStyle } from './hair';
import { hairline } from '../geometry/surface';
import { NECK_Y, WAIST_Y, torsoRings } from './torso';

export type AvatarRole = 'guide' | 'visitor';

/**
 * Outfit pattern cells (40 mm each) round each kind of part. Always even, so checks and dots close
 * seamlessly round the part: torso 18 (about 0.115 m of radius), skirt 22, arms 8, legs 10.
 */
const CELLS = { torso: 18, skirt: 22, arm: 8, leg: 10 } as const;

/** Remaps colour bands defined over a whole limb onto the segment between t0 and t1. */
function sliceBands(bands: readonly TubeBand[], t0: number, t1: number, cells: number): TubeBand[] {
  const out: TubeBand[] = [];
  let previous = 0;
  for (const band of bands) {
    const lo = Math.max(previous, t0);
    const hi = Math.min(band.until, t1);
    if (hi > lo + 1e-6) {
      // A band's end colour only applies where the band really ends, not where a slice cuts it.
      const ends = band.until <= t1 + 1e-9;
      out.push({
        ...band,
        until: (hi - t0) / (t1 - t0),
        cells: band.patterned ? cells : 0,
        endColour: ends ? band.endColour : undefined,
      });
    }
    previous = band.until;
  }
  const last = out[out.length - 1];
  if (last) last.until = 1;
  return out;
}

/** Ambient darkening behind the knee (design spec 12.8.2 B), 10%. */
const KNEE_SHADE = 0.9;

/**
 * Sides round an arm, forearm or shin. A multiple of four puts a vertex exactly on the left, right,
 * front and back of the tube, so in the usual views the polygon's silhouette vertex has a normal
 * square to the view and the screen-space edge band (design spec 12.8.2 A) finds it. The old 10 had
 * a flat facet there, which left every arm and shin without the light rim on a dark backdrop. 8 also
 * costs fewer triangles than 10.
 */
const LIMB_SEGMENTS = 8;

/** `outfitMask` value for a part that gets no silhouette edge. */
const NO_EDGE = -1;

const ARM_SPLIT = BASE.upperArm / (BASE.upperArm + BASE.foreArm);
const LEG_SPLIT = BASE.thigh / (BASE.thigh + BASE.shin);

function addTorso(b: PartBuilder, shape: AvatarShape, garment: Garment): void {
  const g = garment;
  const skirtOnly = g.pelvis === null;

  // Pelvis shell (trousers, jeans, joggers). Dresses, coats and tunics use a skirt instead.
  if (g.pelvis) {
    const { pelvis } = torsoRings(shape, g.pelvis.ofs);
    const cells = g.pelvis.patterned ? CELLS.torso : 0;
    // Ambient darkening 10% at the crotch ring, and the waist rings in the separation colour.
    const rings = pelvis.map((r, i) => {
      const colour =
        i === 1
          ? darker(g.pelvis?.colour as Color, 0.1)
          : r.y >= WAIST_Y - 0.001 && g.pelvis?.topColour
            ? g.pelvis.topColour
            : (g.pelvis?.colour as Color);
      return { ...r, colour, cells };
    });
    b.add(loft(rings, { segments: 16 }), 'hips');
  }
  if (g.skirt) {
    const hip = shape.hip;
    const waistRx = 0.128 * shape.waist + 0.011;
    const hemRx = (0.255 + 0.02 * (hip - 1)) * g.skirt.flare;
    const hemRz = hemRx * (g.skirt.depth ?? 0.88);
    const top = WAIST_Y;
    const hem = g.skirt.hemY;
    const cells = g.skirt.patterned ? CELLS.skirt : 0;
    const rings: Ring[] = [
      { y: top, rx: waistRx, rz: 0.111, colour: g.skirt.colour, cells },
      { y: top - 0.1, rx: 0.17 * hip + 0.016, rz: 0.13, colour: g.skirt.colour, cells },
      {
        y: (top + hem) / 2,
        rx: (waistRx + hemRx) * 0.5 + 0.02,
        rz: ((waistRx + hemRx) * 0.5 + 0.02) * (g.skirt.depth ?? 0.88),
        colour: g.skirt.colour,
        cells,
      },
      { y: hem + 0.032, rx: hemRx - 0.004, rz: hemRz - 0.004, colour: g.skirt.colour, cells },
      { y: hem + 0.028, rx: hemRx, rz: hemRz, colour: g.skirt.hemColour },
      { y: hem, rx: hemRx + 0.002, rz: hemRz + 0.002, colour: g.skirt.hemColour },
    ];
    b.add(loft(rings, { segments: g.skirt.segments ?? 18 }), 'hips');
  }

  // Chest shell, extended below the waist as the hem.
  const outer = torsoRings(shape, g.chest.ofs);
  const hemY = skirtOnly ? WAIST_Y : g.chest.hemY;
  const cells = g.chest.patterned ? CELLS.torso : 0;
  const rings: Ring[] = [];
  if (hemY < WAIST_Y) {
    const lowerRings = outer.pelvis.filter((r) => !r.pole && r.y >= hemY - 0.0001 && r.y < WAIST_Y);
    const at = ringsAt(outer.pelvis, hemY);
    const hemColour = g.chest.hemColour ?? g.chest.colour;
    // The trim is the lowest ring only, so it grades into the body over 18 mm and reads as a hem
    // band, not a long fade. The hem ring is plain; the pattern starts above it.
    rings.push({ y: hemY, rx: at.rx, rz: at.rz, colour: hemColour });
    rings.push({ y: hemY + 0.018, rx: at.rx, rz: at.rz, colour: g.chest.colour, cells });
    for (const r of lowerRings) {
      if (r.y > hemY + 0.02) rings.push({ ...r, colour: g.chest.colour, cells });
    }
  }
  for (const r of outer.chest) rings.push({ ...r, colour: g.chest.colour, cells });
  b.add(loft(rings, { segments: 16 }), 'spine');
}

function addExtras(
  b: PartBuilder,
  extras: readonly GarmentExtra[],
  shape: AvatarShape,
  ofs: number,
): void {
  for (const e of extras) {
    if (e.kind === 'ring') {
      const mid = (e.y0 + e.y1) / 2;
      let rx = e.rx ?? 0.06;
      let rz = e.rz ?? 0.06;
      if (e.grow !== undefined) {
        const body = torsoRings(shape, 0);
        const at = ringsAt(e.y0 < WAIST_Y ? body.pelvis : body.chest, mid);
        rx = at.rx + ofs + e.grow;
        rz = at.rz + ofs + e.grow;
      }
      const rings: Ring[] = [
        { y: e.y0, rx, rz, colour: e.colour },
        { y: mid, rx: rx + 0.004, rz: rz + 0.004, colour: e.colour },
        { y: e.y1, rx, rz, colour: e.colour },
      ];
      const cells = e.patterned ? CELLS.torso : 0;
      b.add(
        loft(
          rings.map((r) => ({ ...r, cells })),
          { segments: 18 },
        ),
        e.bone,
      );
    } else {
      let centre: [number, number, number] = [...e.centre];
      if (e.onChest) {
        const chest = torsoRings(shape, 0).chest;
        const at = ringsAt(chest, centre[1]);
        const z =
          e.side === 'back'
            ? at.cz - at.rz - ofs - e.radii[2] * 0.4
            : at.cz + at.rz + ofs + e.radii[2] * 0.4;
        centre = [centre[0], centre[1], z];
      }
      b.add(
        ellipsoid(centre, e.radii, {
          colour: e.colour,
          rotation: e.rotation,
          segments: e.segments ?? 10,
          rows: e.rows ?? 6,
          cells: e.patterned ? CELLS.torso : 0,
        }),
        e.bone,
      );
    }
  }
}

function addLimbs(b: PartBuilder, shape: AvatarShape, garment: Garment, skin: Color): void {
  const j = jointsFor(shape);
  const arm = shape.arm;
  const leg = shape.leg;
  const upperArmBands = sliceBands(garment.armBands, 0, ARM_SPLIT, CELLS.arm);
  const foreArmBands = sliceBands(garment.armBands, ARM_SPLIT, 1, CELLS.arm);
  const thighBands = sliceBands(garment.legBands, 0, LEG_SPLIT, CELLS.leg);
  const shinBands = sliceBands(garment.legBands, LEG_SPLIT, 1, CELLS.leg);

  for (const side of [1, -1] as const) {
    const s = side === 1 ? 'L' : 'R';
    const shoulder = side === 1 ? j.armL : j.armR;
    const elbow = side === 1 ? j.elbowL : j.elbowR;
    const wrist = side === 1 ? j.wristL : j.wristR;
    b.add(
      tube({
        from: shoulder,
        to: elbow,
        radiusFrom: BASE.armRadius * arm,
        radiusTo: 0.036 * arm,
        bands: upperArmBands,
        capFrom: true,
        capTo: true,
        segments: LIMB_SEGMENTS,
      }),
      `arm${s}` as BoneName,
    );
    b.add(
      tube({
        from: elbow,
        to: wrist,
        radiusFrom: 0.036 * arm,
        radiusTo: BASE.wristRadius * arm,
        bands: foreArmBands,
        capFrom: true,
        capTo: true,
        segments: LIMB_SEGMENTS,
      }),
      `forearm${s}` as BoneName,
    );

    // Mitten hand and thumb, tilted along the forearm.
    const tilt = side * BASE.armRestAngle;
    const handCentre: [number, number, number] = [
      wrist[0] + side * Math.sin(BASE.armRestAngle) * 0.05,
      wrist[1] - Math.cos(BASE.armRestAngle) * 0.05,
      0,
    ];
    b.add(
      ellipsoid(handCentre, [0.034 * arm, 0.058, 0.027], {
        colour: skin,
        rotation: [0, 0, tilt],
        segments: 10,
        rows: 6,
      }),
      `forearm${s}` as BoneName,
    );
    b.add(
      ellipsoid([handCentre[0] - side * 0.03, handCentre[1] + 0.02, 0.014], [0.014, 0.03, 0.014], {
        colour: skin,
        rotation: [0, 0, tilt + side * 0.3],
        segments: 7,
        rows: 4,
      }),
      `forearm${s}` as BoneName,
    );

    // Legs.
    const hip = side === 1 ? j.legL : j.legR;
    const knee = side === 1 ? j.kneeL : j.kneeR;
    const ankle = side === 1 ? j.ankleL : j.ankleR;
    b.add(
      tube({
        from: hip,
        to: knee,
        radiusFrom: BASE.thighRadius * leg,
        radiusTo: BASE.kneeRadius * leg,
        bands: thighBands,
        capFrom: true,
        capTo: true,
        segments: 12,
        shadeTo: KNEE_SHADE,
      }),
      `leg${s}` as BoneName,
    );
    b.add(
      tube({
        from: knee,
        to: ankle,
        radiusFrom: BASE.kneeRadius * leg,
        radiusTo: BASE.ankleRadius * leg,
        bands: shinBands,
        capFrom: true,
        capTo: true,
        segments: LIMB_SEGMENTS,
        bulge: 0.08,
        shadeFrom: KNEE_SHADE,
      }),
      `shin${s}` as BoneName,
    );

    // Shoe and sole.
    b.add(
      ellipsoid([ankle[0], 0.06, 0.045], [0.05, 0.047, 0.125], {
        colour: hex(AVATAR_FIXED.shoes),
        segments: 12,
        rows: 6,
      }),
      `shin${s}` as BoneName,
    );
    b.add(
      ellipsoid([ankle[0], 0.019, 0.045], [0.054, 0.019, 0.134], {
        colour: hex(AVATAR_FIXED.sole),
        segments: 12,
        rows: 4,
      }),
      `shin${s}` as BoneName,
    );
  }
}

const quatZ = new Vector3(0, 0, 1);

/** The left-chest badge: brass for the Guide, a cream sticker with a rose heart for the Visitor. */
function addBadge(b: PartBuilder, shape: AvatarShape, garment: Garment, role: AvatarRole): void {
  const y = 1.15;
  const x = 0.088 * shape.shoulder;
  const chest = torsoRings(shape, garment.chest.ofs).chest;
  const at = ringsAt(chest, y);
  const ratio = Math.min(0.95, Math.abs(x - at.cx) / at.rx);
  const z = at.cz + at.rz * Math.sqrt(1 - ratio * ratio);
  const normal = new Vector3(
    (x - at.cx) / (at.rx * at.rx),
    0,
    (z - at.cz) / (at.rz * at.rz),
  ).normalize();
  const q = new Quaternion().setFromUnitVectors(quatZ, normal);
  const place = (g: BufferGeometry, lift: number) => {
    const p = new Vector3(x, y, z).addScaledVector(normal, lift);
    g.applyMatrix4(new Matrix4().compose(p, q, new Vector3(1, 1, 1)));
    return g;
  };
  const disc = (radius: number, depth: number) => {
    const g = new CylinderGeometry(radius, radius, depth, 20, 1);
    g.rotateX(Math.PI / 2);
    return g;
  };

  if (role === 'guide') {
    b.add(place(disc(0.037, 0.008), 0.0), 'spine', hex(BADGE_RING_BRASS), undefined, NO_EDGE);
    b.add(
      place(disc(0.03, 0.01), 0.001),
      'spine',
      hex(AVATAR_FIXED.badgeGuide),
      undefined,
      NO_EDGE,
    );
    b.add(
      place(disc(0.012, 0.012), 0.002),
      'spine',
      shade(hex(AVATAR_FIXED.badgeGuide), 1.12),
      undefined,
      NO_EDGE,
    );
  } else {
    b.add(
      place(disc(0.04, 0.005), 0.0),
      'spine',
      hex(AVATAR_FIXED.badgeVisitor),
      undefined,
      NO_EDGE,
    );
    const heart = new Shape();
    heart.moveTo(0, -0.45);
    heart.bezierCurveTo(-0.62, -0.05, -0.56, 0.46, -0.26, 0.46);
    heart.bezierCurveTo(-0.1, 0.46, 0, 0.36, 0, 0.26);
    heart.bezierCurveTo(0, 0.36, 0.1, 0.46, 0.26, 0.46);
    heart.bezierCurveTo(0.56, 0.46, 0.62, -0.05, 0, -0.45);
    const g = new ShapeGeometry(heart, 6);
    g.scale(0.052, 0.052, 1);
    g.translate(0, -0.002, 0);
    b.add(place(g, 0.0032), 'spine', hex(AVATAR_FIXED.badgeHeart), undefined, NO_EDGE);
  }
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Region separation on the head ellipsoid (design spec 12.8.2 B), vertex colours only: the skin is
 * 8% darker under the hairline and the fringe, easing out over the next row, and up to 10% darker
 * under the jaw (a soft chin shadow). Done on the unwarped head, so it follows the face shape.
 */
function shadeHead(head: BufferGeometry, hairStyle: HairStyle): BufferGeometry {
  const lower = hairline(...HAIRLINES[hairStyle]);
  const [cx, cy, cz] = headCentre();
  const pos = head.getAttribute('position');
  const col = head.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const phi = Math.asin(Math.max(-1, Math.min(1, (pos.getY(i) - cy) / HEAD.ry)));
    const theta = Math.atan2(pos.getX(i) - cx, pos.getZ(i) - cz);
    // Metres below the hairline along the head (negative under the hair).
    const below = (lower(theta) - phi) * HEAD.ry;
    const hairShadow = 0.08 * (1 - smoothstep(0, 0.045, below));
    const chin = 0.1 * smoothstep(-0.7, -1.2, phi);
    const k = (1 - hairShadow) * (1 - chin);
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return head;
}

export function buildBodyGeometry(
  config: AvatarConfig,
  role: AvatarRole,
  shape: AvatarShape = shapeFor(config),
): BufferGeometry {
  const skin = hex(SKIN_TONES[config.skinTone]);
  const garment = clampCollars(
    garmentFor({
      style: config.outfitStyle,
      outfit: outfitColour(config.outfitColor),
      skin,
    }),
    chinBottomY(shape.face),
  );
  const b = new PartBuilder(shape, { masked: true });

  // Head, neck and face.
  const [cx, cy, cz] = headCentre();
  b.add(
    shadeHead(
      ellipsoid([cx, cy, cz], [HEAD.rx, HEAD.ry, HEAD.rz], {
        colour: skin,
        segments: 22,
        rows: 12,
      }),
      config.hairStyle,
    ),
    'head',
  );
  b.add(
    tube({
      from: [0, NECK_Y - 0.03, 0],
      to: [0, NECK_Y + 0.07, 0],
      radiusFrom: 0.04 * shape.neck,
      radiusTo: 0.036 * shape.neck,
      // The neck sits in the chin shadow: 10% darker than the face.
      bands: [{ until: 1, colour: darker(skin, 0.1) }],
      segments: 10,
    }),
    'neck',
  );
  const face = buildFace(skin, mouthLiftFor(config.facialHair), shape.eye);
  // Small face features get no silhouette edge (mask -1), so the face is not outlined feature by feature.
  for (const g of [
    ...face.sclera,
    ...face.eyes,
    ...face.catchlights,
    face.nose,
    ...face.blush,
    face.mouth,
  ])
    b.add(g, 'head', undefined, undefined, NO_EDGE);
  for (const g of face.ears) b.add(g, 'head');

  addTorso(b, shape, garment);
  addExtras(b, garment.extras, shape, garment.chest.ofs);
  addLimbs(b, shape, garment, skin);
  addBadge(b, shape, garment, role);

  const geometry = b.build();
  if (!geometry) throw new Error('Avatar body produced no geometry');
  return geometry;
}
