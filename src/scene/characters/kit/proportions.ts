/**
 * Proportions and joint positions for the "designer toy" avatar (design spec 9.1).
 *
 * Medium height is 1.70 m: legs 0.80, torso 0.55, neck 0.05, head 0.32 (0.30 wide). Body type
 * changes torso, hip and limb widths only; the head never changes. Gender (design spec 9.1, v1.1)
 * is a second set of multipliers applied first, with body type multiplied on top; Neutral is
 * exactly 1.00 everywhere, so a Neutral character is the v1.0 character bit for bit. Height scales the whole rig
 * uniformly (0.91, 1.00, 1.09). All numbers are metres in model space: feet at y = 0, facing +Z,
 * the character's left on +X.
 */
import { avatarGender, type AvatarConfig, type AvatarGender } from '@contract';

export type BodyType = AvatarConfig['bodyType'];
export type HeightId = AvatarConfig['height'];

export const HEIGHT_SCALE: Readonly<Record<HeightId, number>> = {
  short: 0.91,
  medium: 1,
  tall: 1.09,
};

/** Width multipliers per body type (design spec 9.1). */
export interface BodyShape {
  /** Shoulder and upper chest width. */
  shoulder: number;
  /** Chest width and depth (bust for curvy). */
  chest: number;
  waist: number;
  hip: number;
  /** Arm thickness. */
  arm: number;
  /** Thigh and shin thickness. */
  leg: number;
}

export const BODY_SHAPES: Readonly<Record<BodyType, BodyShape>> = {
  slim: { shoulder: 0.9, chest: 0.9, waist: 0.9, hip: 0.9, arm: 0.88, leg: 0.88 },
  regular: { shoulder: 1, chest: 1, waist: 1, hip: 1, arm: 1, leg: 1 },
  curvy: { shoulder: 1, chest: 1.04, waist: 0.96, hip: 1.12, arm: 1, leg: 1.1 },
  broad: { shoulder: 1.15, chest: 1.08, waist: 1.08, hip: 1, arm: 1.12, leg: 1.05 },
};

/**
 * Gender shape multipliers (design spec 9.1 and 9.6). Same topology for every gender: these move
 * rings, joints and existing vertices, and resize the existing brows and eyes, nothing more.
 * Spec values, with three tunings inside the 0.03 allowance (9.1 and 9.6) so that the silhouette
 * from behind differs by 10% or more between neighbours when measured on the real mesh: Woman
 * shoulder 0.95 to 0.945 (the Slim Woman 0.34 m limit allows no lower), Woman hip 1.06 to 1.07
 * (Wider hips Woman is 0.36 m), Man shoulder 1.07 to 1.08. `torso` is the torso length; the leg length that
 * keeps the total height identical is derived in `composeShape`.
 */
export interface GenderShape {
  shoulder: number;
  waist: number;
  hip: number;
  /** Chest front-to-back depth only (the width never changes). */
  depth: number;
  neck: number;
  /** Arm and leg thickness; the mitten hands follow the arms. */
  limb: number;
  torso: number;
  /** Lower-head width. */
  jaw: number;
  brow: number;
  eye: number;
}

export const GENDER_SHAPES: Readonly<Record<AvatarGender, GenderShape>> = {
  feminine: {
    shoulder: 0.945,
    waist: 0.92,
    hip: 1.07,
    depth: 1.04,
    neck: 0.92,
    limb: 0.94,
    torso: 0.98,
    jaw: 0.94,
    brow: 0.9,
    eye: 1.06,
  },
  neutral: {
    shoulder: 1,
    waist: 1,
    hip: 1,
    depth: 1,
    neck: 1,
    limb: 1,
    torso: 1,
    jaw: 1,
    brow: 1,
    eye: 1,
  },
  masculine: {
    shoulder: 1.08,
    waist: 1.02,
    hip: 0.97,
    depth: 1.02,
    neck: 1.12,
    limb: 1.06,
    torso: 1.02,
    jaw: 1.06,
    brow: 1.15,
    eye: 0.97,
  },
};

const GENDER_KEYS = Object.keys(GENDER_SHAPES.neutral) as (keyof GenderShape)[];

/** Linear blend of two gender shapes, for the preview morph. `t` is 0 (from) to 1 (to). */
export function blendGender(from: GenderShape, to: GenderShape, t: number): GenderShape {
  const out = { ...to };
  for (const k of GENDER_KEYS) out[k] = from[k] + (to[k] - from[k]) * t;
  return out;
}

/** Everything the builders need: body type and gender combined, plus the face parameters. */
export interface AvatarShape extends BodyShape {
  depth: number;
  neck: number;
  /** Torso length multiplier. */
  torso: number;
  /** Leg length multiplier, derived so that torso plus legs keep the Neutral total height. */
  legs: number;
  jaw: number;
  brow: number;
  eye: number;
}

/** Gender first, body type multiplied on top. Neutral multiplies by exactly 1. */
export function composeShape(body: BodyShape, g: GenderShape): AvatarShape {
  return {
    shoulder: g.shoulder * body.shoulder,
    chest: body.chest,
    waist: g.waist * body.waist,
    hip: g.hip * body.hip,
    arm: g.limb * body.arm,
    leg: g.limb * body.leg,
    depth: g.depth,
    neck: g.neck,
    torso: g.torso,
    legs: (BASE.hipY + BASE.torsoLength * (1 - g.torso)) / BASE.hipY,
    jaw: g.jaw,
    brow: g.brow,
    eye: g.eye,
  };
}

/** The shape for a config, reading gender through `avatarGender` (missing means Neutral). */
export function shapeFor(config: AvatarConfig): AvatarShape {
  return composeShape(BODY_SHAPES[config.bodyType], GENDER_SHAPES[avatarGender(config)]);
}

/**
 * Vertical remap for torso and leg length: legs scale about the floor, the torso about the hip,
 * and everything from the neck base up (head, hair, face) stays put. Null when nothing changes.
 */
export function heightWarp(shape: AvatarShape): ((y: number) => number) | null {
  if (shape.torso === 1) return null;
  const hip = BASE.hipY;
  const neck = hip + BASE.torsoLength;
  const hipNow = hip * shape.legs;
  return (y) => (y <= hip ? y * shape.legs : y < neck ? hipNow + (y - hip) * shape.torso : y);
}

/**
 * Jaw width factor at a point `dy` metres from the head centre (negative below). One at and above
 * the equator, easing to `jaw` at the chin, so the jaw gets rounder or squarer on the same mesh.
 */
export function jawScale(jaw: number, dy: number): number {
  if (dy >= 0) return 1;
  const t = Math.min(1, -Math.asin(Math.max(-1, dy / HEAD.ry)) / 1.1);
  return 1 + (jaw - 1) * t * t;
}

export const HEAD = {
  /** Head ellipsoid radii (0.30 wide, 0.32 tall). */
  rx: 0.15,
  ry: 0.16,
  rz: 0.15,
  /** The head's base sits this far above the neck joint. */
  neckLength: 0.05,
} as const;

export const BASE = {
  hipY: 0.78,
  /** Spine bone origin, above the hip joint. */
  waistRise: 0.17,
  /** Neck base above the hip joint (torso length 0.55). */
  torsoLength: 0.55,
  /** Arm pivot below the neck base. */
  shoulderDrop: 0.07,
  hipHalfSpacing: 0.075,
  thigh: 0.39,
  shin: 0.31,
  upperArm: 0.27,
  foreArm: 0.21,
  /** Arms rest slightly away from the body. */
  armRestAngle: 0.12,
  armPivotX: 0.165,
  /** Radii at the shoulder end of the arm, and at the wrist. */
  armRadius: 0.042,
  wristRadius: 0.032,
  thighRadius: 0.075,
  kneeRadius: 0.055,
  ankleRadius: 0.04,
} as const;

export interface Joints {
  hips: readonly [number, number, number];
  spine: readonly [number, number, number];
  neck: readonly [number, number, number];
  head: readonly [number, number, number];
  hairBack: readonly [number, number, number];
  armL: readonly [number, number, number];
  armR: readonly [number, number, number];
  elbowL: readonly [number, number, number];
  elbowR: readonly [number, number, number];
  wristL: readonly [number, number, number];
  wristR: readonly [number, number, number];
  legL: readonly [number, number, number];
  legR: readonly [number, number, number];
  kneeL: readonly [number, number, number];
  kneeR: readonly [number, number, number];
  ankleL: readonly [number, number, number];
  ankleR: readonly [number, number, number];
}

/** Model-space joint positions (bind pose) for a body shape. */
export function jointsFor(shape: AvatarShape): Joints {
  const hipY = BASE.hipY;
  const waistY = hipY + BASE.waistRise;
  const neckY = hipY + BASE.torsoLength;
  const headY = neckY + HEAD.neckLength;
  const shoulderY = neckY - BASE.shoulderDrop;
  const px = BASE.armPivotX * shape.shoulder;
  const a = BASE.armRestAngle;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const hipX = BASE.hipHalfSpacing * shape.hip;

  const arm = (side: 1 | -1) => {
    const shoulder: [number, number, number] = [side * px, shoulderY, 0];
    const elbow: [number, number, number] = [
      shoulder[0] + side * dx * BASE.upperArm,
      shoulder[1] + dy * BASE.upperArm,
      0,
    ];
    const wrist: [number, number, number] = [
      elbow[0] + side * dx * BASE.foreArm,
      elbow[1] + dy * BASE.foreArm,
      0,
    ];
    return { shoulder, elbow, wrist };
  };
  const leg = (side: 1 | -1) => {
    const hip: [number, number, number] = [side * hipX, hipY, 0];
    const knee: [number, number, number] = [side * hipX, hipY - BASE.thigh, 0];
    const ankle: [number, number, number] = [side * hipX, hipY - BASE.thigh - BASE.shin, 0];
    return { hip, knee, ankle };
  };
  const l = arm(1);
  const r = arm(-1);
  const ll = leg(1);
  const lr = leg(-1);
  const joints: Joints = {
    hips: [0, hipY, 0],
    spine: [0, waistY, 0],
    neck: [0, neckY, 0],
    head: [0, headY, 0],
    hairBack: [0, headY + 0.16, -0.1],
    armL: l.shoulder,
    armR: r.shoulder,
    elbowL: l.elbow,
    elbowR: r.elbow,
    wristL: l.wrist,
    wristR: r.wrist,
    legL: ll.hip,
    legR: lr.hip,
    kneeL: ll.knee,
    kneeR: lr.knee,
    ankleL: ll.ankle,
    ankleR: lr.ankle,
  };
  const warp = heightWarp(shape);
  if (!warp) return joints;
  // Same remap as the vertices, so the bind pose and the mesh agree.
  const out = {} as Record<keyof Joints, readonly [number, number, number]>;
  for (const k of Object.keys(joints) as (keyof Joints)[]) {
    const [x, y, z] = joints[k];
    out[k] = [x, warp(y), z];
  }
  return out;
}

/** Head centre in model space. */
export function headCentre(): readonly [number, number, number] {
  return [0, BASE.hipY + BASE.torsoLength + HEAD.neckLength + HEAD.ry - 0.015, 0];
}

/** Height of the top of the bare head at scale 1, plus a little for hair, in metres. */
export const NOMINAL_HEIGHT = 1.7;
