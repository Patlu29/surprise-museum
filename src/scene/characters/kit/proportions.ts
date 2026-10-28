/**
 * Proportions and joint positions for the "designer toy" avatar (design spec 9.1).
 *
 * Medium height is 1.70 m: legs 0.80, torso 0.55, neck 0.05, head 0.32 (0.30 wide). Body type
 * changes torso, hip and limb widths only; the head never changes. Height scales the whole rig
 * uniformly (0.91, 1.00, 1.09). All numbers are metres in model space: feet at y = 0, facing +Z,
 * the character's left on +X.
 */
import type { AvatarConfig } from '@contract';

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
export function jointsFor(shape: BodyShape): Joints {
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
  return {
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
}

/** Head centre in model space. */
export function headCentre(): readonly [number, number, number] {
  return [0, BASE.hipY + BASE.torsoLength + HEAD.neckLength + HEAD.ry - 0.015, 0];
}

/** Height of the top of the bare head at scale 1, plus a little for hair, in metres. */
export const NOMINAL_HEIGHT = 1.7;
