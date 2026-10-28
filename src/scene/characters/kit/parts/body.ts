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
import { hex, shade } from '../colour';
import { PartBuilder, type BoneName } from '../geometry/partBuilder';
import { ellipsoid, loft, ringsAt, tube, type Ring, type TubeBand } from '../geometry/surface';
import { AVATAR_FIXED, BADGE_RING_BRASS, SKIN_TONES } from '../palette';
import { BASE, BODY_SHAPES, HEAD, headCentre, jointsFor, type BodyShape } from '../proportions';
import { buildFace, mouthLiftFor } from './face';
import { garmentFor, outfitColour, type Garment, type GarmentExtra } from './outfits';
import { NECK_Y, WAIST_Y, paint, torsoRings } from './torso';

export type AvatarRole = 'guide' | 'visitor';

/** Remaps colour bands defined over a whole limb onto the segment between t0 and t1. */
function sliceBands(bands: readonly TubeBand[], t0: number, t1: number): TubeBand[] {
  const out: TubeBand[] = [];
  let previous = 0;
  for (const band of bands) {
    const lo = Math.max(previous, t0);
    const hi = Math.min(band.until, t1);
    if (hi > lo + 1e-6) out.push({ ...band, until: (hi - t0) / (t1 - t0) });
    previous = band.until;
  }
  const last = out[out.length - 1];
  if (last) last.until = 1;
  return out;
}

const ARM_SPLIT = BASE.upperArm / (BASE.upperArm + BASE.foreArm);
const LEG_SPLIT = BASE.thigh / (BASE.thigh + BASE.shin);

function addTorso(b: PartBuilder, shape: BodyShape, garment: Garment): void {
  const g = garment;
  const skirtOnly = g.pelvis === null;

  // Pelvis shell (trousers, jeans, joggers). Dresses use a skirt instead.
  if (g.pelvis) {
    const { pelvis } = torsoRings(shape, g.pelvis.ofs);
    b.add(loft(paint(pelvis, g.pelvis.colour), { segments: 16 }), 'hips');
  }
  if (g.skirt) {
    const hip = shape.hip;
    const waistRx = 0.128 * shape.waist + 0.011;
    const hemRx = (0.255 + 0.02 * (hip - 1)) * g.skirt.flare;
    const hemRz = hemRx * 0.88;
    const top = WAIST_Y;
    const hem = g.skirt.hemY;
    const rings: Ring[] = [
      { y: top, rx: waistRx, rz: 0.111, colour: g.skirt.colour },
      { y: top - 0.1, rx: 0.17 * hip + 0.016, rz: 0.13, colour: g.skirt.colour },
      {
        y: (top + hem) / 2,
        rx: (waistRx + hemRx) * 0.5 + 0.02,
        rz: ((waistRx + hemRx) * 0.5 + 0.02) * 0.88,
        colour: g.skirt.colour,
      },
      { y: hem + 0.032, rx: hemRx - 0.004, rz: hemRz - 0.004, colour: g.skirt.colour },
      { y: hem + 0.028, rx: hemRx, rz: hemRz, colour: g.skirt.hemColour },
      { y: hem, rx: hemRx + 0.002, rz: hemRz + 0.002, colour: g.skirt.hemColour },
    ];
    b.add(loft(rings, { segments: 18 }), 'hips');
  }

  // Chest shell, extended below the waist as the hem.
  const outer = torsoRings(shape, g.chest.ofs);
  const hemY = skirtOnly ? WAIST_Y : g.chest.hemY;
  const rings: Ring[] = [];
  if (hemY < WAIST_Y) {
    const lowerRings = outer.pelvis.filter((r) => !r.pole && r.y >= hemY - 0.0001 && r.y < WAIST_Y);
    const at = ringsAt(outer.pelvis, hemY);
    const hemColour = g.chest.hemColour ?? g.chest.colour;
    rings.push({ y: hemY, rx: at.rx, rz: at.rz, colour: hemColour });
    rings.push({ y: hemY + 0.018, rx: at.rx, rz: at.rz, colour: hemColour });
    for (const r of lowerRings) if (r.y > hemY + 0.02) rings.push({ ...r, colour: g.chest.colour });
  }
  for (const r of outer.chest) rings.push({ ...r, colour: g.chest.colour });
  b.add(loft(rings, { segments: 16 }), 'spine');
}

function addExtras(
  b: PartBuilder,
  extras: readonly GarmentExtra[],
  shape: BodyShape,
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
      b.add(loft(rings, { segments: 18 }), e.bone);
    } else {
      let centre: [number, number, number] = [...e.centre];
      if (e.onChest) {
        const chest = torsoRings(shape, 0).chest;
        const at = ringsAt(chest, centre[1]);
        centre = [centre[0], centre[1], at.cz + at.rz + ofs + e.radii[2] * 0.4];
      }
      b.add(
        ellipsoid(centre, e.radii, {
          colour: e.colour,
          rotation: e.rotation,
          segments: 10,
          rows: 6,
        }),
        e.bone,
      );
    }
  }
}

function addLimbs(b: PartBuilder, shape: BodyShape, garment: Garment, skin: Color): void {
  const j = jointsFor(shape);
  const arm = shape.arm;
  const leg = shape.leg;
  const upperArmBands = sliceBands(garment.armBands, 0, ARM_SPLIT);
  const foreArmBands = sliceBands(garment.armBands, ARM_SPLIT, 1);
  const thighBands = sliceBands(garment.legBands, 0, LEG_SPLIT);
  const shinBands = sliceBands(garment.legBands, LEG_SPLIT, 1);

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
        segments: 10,
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
        segments: 10,
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
        segments: 10,
        bulge: 0.08,
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
function addBadge(b: PartBuilder, shape: BodyShape, garment: Garment, role: AvatarRole): void {
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
    b.add(place(disc(0.037, 0.008), 0.0), 'spine', hex(BADGE_RING_BRASS));
    b.add(place(disc(0.03, 0.01), 0.001), 'spine', hex(AVATAR_FIXED.badgeGuide));
    b.add(place(disc(0.012, 0.012), 0.002), 'spine', shade(hex(AVATAR_FIXED.badgeGuide), 1.12));
  } else {
    b.add(place(disc(0.04, 0.005), 0.0), 'spine', hex(AVATAR_FIXED.badgeVisitor));
    const heart = new Shape();
    heart.moveTo(0, -0.45);
    heart.bezierCurveTo(-0.62, -0.05, -0.56, 0.46, -0.26, 0.46);
    heart.bezierCurveTo(-0.1, 0.46, 0, 0.36, 0, 0.26);
    heart.bezierCurveTo(0, 0.36, 0.1, 0.46, 0.26, 0.46);
    heart.bezierCurveTo(0.56, 0.46, 0.62, -0.05, 0, -0.45);
    const g = new ShapeGeometry(heart, 6);
    g.scale(0.052, 0.052, 1);
    g.translate(0, -0.002, 0);
    b.add(place(g, 0.0032), 'spine', hex(AVATAR_FIXED.badgeHeart));
  }
}

export function buildBodyGeometry(config: AvatarConfig, role: AvatarRole): BufferGeometry {
  const shape = BODY_SHAPES[config.bodyType];
  const skin = hex(SKIN_TONES[config.skinTone]);
  const garment = garmentFor({
    style: config.outfitStyle,
    outfit: outfitColour(config.outfitColor),
    skin,
  });
  const b = new PartBuilder();

  // Head, neck and face.
  const [cx, cy, cz] = headCentre();
  b.add(
    ellipsoid([cx, cy, cz], [HEAD.rx, HEAD.ry, HEAD.rz], { colour: skin, segments: 22, rows: 12 }),
    'head',
  );
  b.add(
    tube({
      from: [0, NECK_Y - 0.03, 0],
      to: [0, NECK_Y + 0.07, 0],
      radiusFrom: 0.04,
      radiusTo: 0.036,
      bands: [{ until: 1, colour: skin }],
      segments: 10,
    }),
    'neck',
  );
  const face = buildFace(skin, mouthLiftFor(config.facialHair));
  for (const g of [
    ...face.sclera,
    ...face.eyes,
    face.nose,
    ...face.blush,
    face.mouth,
    ...face.ears,
  ])
    b.add(g, 'head');

  addTorso(b, shape, garment);
  addExtras(b, garment.extras, shape, garment.chest.ofs);
  addLimbs(b, shape, garment, skin);
  addBadge(b, shape, garment, role);

  const geometry = b.build();
  if (!geometry) throw new Error('Avatar body produced no geometry');
  return geometry;
}
