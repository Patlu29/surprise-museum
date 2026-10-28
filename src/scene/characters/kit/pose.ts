/**
 * Procedural poses for the avatar rig (idle, walk, present). The scene-developer owns timing
 * (advancing the walk phase by speed / stride, easing the gesture); this module only turns
 * numbers into bone rotations, so the look of the motion lives with the rig.
 *
 * Numbers follow architecture 6.7: legs swing about 25 degrees, arms counter-swing about 20,
 * hips bob 3 cm peak to peak. Reduced motion: do not call `applyPose` with moving values; call
 * `rig.resetPose()` for the still pose.
 */
import type { Bone } from 'three';
import { BASE } from './proportions';

export interface AvatarPose {
  /** Walk cycle phase in radians. One full stride pair per 2 PI. */
  walkPhase: number;
  /** 0 (standing) to 1 (full walk). Blend this with speed for smooth starts and stops. */
  walkAmount: number;
  /** Seconds, for the idle breathing and sway. */
  idleTime: number;
  /** 0 (arm down) to 1 (right arm raised towards the photo). */
  present: number;
  /** Head turn about the vertical axis in radians, positive to the character's left. Clamped. */
  lookYaw: number;
}

export const NEUTRAL_POSE: Readonly<AvatarPose> = {
  walkPhase: 0,
  walkAmount: 0,
  idleTime: 0,
  present: 0,
  lookYaw: 0,
};

export type PoseBones = Readonly<
  Record<
    | 'hips'
    | 'spine'
    | 'neck'
    | 'head'
    | 'hairBack'
    | 'armL'
    | 'forearmL'
    | 'armR'
    | 'forearmR'
    | 'legL'
    | 'shinL'
    | 'legR'
    | 'shinR',
    Bone
  >
>;

const LEG_SWING = (25 * Math.PI) / 180;
const ARM_SWING = (20 * Math.PI) / 180;
const KNEE_BEND = 0.65;
const BOB = 0.015; // peak to peak 3 cm

export function applyPose(bones: PoseBones, hipRestY: number, input: Partial<AvatarPose>): void {
  const p = { ...NEUTRAL_POSE, ...input };
  const w = Math.min(1, Math.max(0, p.walkAmount));
  const idle = 1 - w;
  const phase = p.walkPhase;
  const sinP = Math.sin(phase);
  const present = Math.min(1, Math.max(0, p.present));

  // Hips: bob twice per stride, breathe when idle.
  bones.hips.position.y =
    hipRestY + BOB * Math.cos(phase * 2) * w - 0.002 * Math.sin(p.idleTime * 1.7) * idle;
  bones.hips.rotation.y = sinP * 0.04 * w;
  bones.hips.rotation.z = sinP * 0.025 * w;

  // Spine: counter-rotates the hips, leans a touch into the walk, breathes.
  // Kept small: shirt (spine) and trousers (hips) overlap at the waist, and a bigger twist
  // would push the trouser shell through the shirt hem.
  bones.spine.rotation.y = -sinP * 0.04 * w;
  bones.spine.rotation.x = 0.04 * w + Math.sin(p.idleTime * 1.7) * 0.012 * idle;
  bones.neck.rotation.x = -0.02 * w;

  // Head: counters the body's turn so the gaze stays steady, plus the look target.
  const yaw = Math.max(-0.9, Math.min(0.9, p.lookYaw));
  bones.head.rotation.y = yaw + sinP * 0.04 * w + Math.sin(p.idleTime * 0.6) * 0.025 * idle;
  bones.head.rotation.x = -0.02 * w + Math.sin(p.idleTime * 1.1) * 0.01 * idle;

  // Legs. +X rotation moves a hanging foot backwards, so a forward swing is negative.
  const leg = (thigh: Bone, shin: Bone, ph: number) => {
    const s = Math.sin(ph);
    thigh.rotation.x = -s * LEG_SWING * w;
    shin.rotation.x = Math.max(0, Math.cos(ph)) * KNEE_BEND * w;
  };
  leg(bones.legL, bones.shinL, phase);
  leg(bones.legR, bones.shinR, phase + Math.PI);

  // Arms counter-swing the legs; a slight constant elbow bend; idle sway.
  const sway = Math.sin(p.idleTime * 1.3) * 0.015 * idle;
  bones.armL.rotation.x = sinP * ARM_SWING * w + sway;
  bones.forearmL.rotation.x = -(0.12 + 0.18 * Math.max(0, -sinP) * w);
  bones.armL.rotation.z = 0;

  // The right arm swings opposite, then rises to present. Raising goes forward and a little out.
  const swingR = -sinP * ARM_SWING * w - sway;
  bones.armR.rotation.x = swingR * (1 - present) + -1.25 * present;
  bones.armR.rotation.z = -0.28 * present;
  bones.forearmR.rotation.x =
    -(0.12 + 0.18 * Math.max(0, sinP) * w) * (1 - present) + -0.35 * present;

  // Hair that hangs from the back of the head swings against the direction of travel.
  bones.hairBack.rotation.x =
    0.06 * w * (0.6 + 0.4 * Math.cos(phase * 2)) + Math.sin(p.idleTime * 1.3) * 0.01 * idle;
  bones.hairBack.rotation.z = sinP * 0.05 * w;
}

/** Hip rest height at body scale 1, exported so callers need not import proportions. */
export const HIP_REST_Y = BASE.hipY;
