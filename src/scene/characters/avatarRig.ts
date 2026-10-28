import type { AvatarConfig } from '@contract';
import type { Group } from 'three';
import type { CharacterRole } from '@/domain/characters/characterState';
import { HEIGHT_SCALE, NOMINAL_HEIGHT } from './kit/proportions';

/** What the scene feeds the rig each frame (see domain/characters/animation.ts). */
export interface AvatarPoseInput {
  /** Walk phase in radians. */
  walkPhase: number;
  /** 0 standing, 1 full walk. */
  walkAmount: number;
  /** Seconds, for idle breathing and sway. 0 holds a still pose. */
  idleTime: number;
  /** 0 arm down, 1 the character's right arm raised towards the photo. */
  present: number;
}

/**
 * The stable shape the scene needs from an avatar (ADR 0008): a root to add to the scene, a pose
 * input, a fade, and the heights for the name label. Left and right are anatomical: the
 * character's left is +X and its right is -X, so the presenting arm is the right arm.
 */
export interface AvatarRig {
  /** Origin at the feet, facing +Z at heading 0. Includes its own soft blob shadow. */
  root: Group;
  /** Head-top height in metres, with the height option applied. */
  height: number;
  /** Name label height above the feet in metres (0.35 m above the head, scaled with height). */
  labelHeight: number;
  /** The uniform height scale (0.91, 1.00, 1.09). */
  scale: number;
  applyPose(pose: AvatarPoseInput): void;
  /** 0 to 1. Below 1 the figure and its shadow turn transparent (yield and relocate fades). */
  setOpacity(opacity: number): void;
  dispose(): void;
}

export type AvatarBuilder = (config: AvatarConfig, role: CharacterRole) => AvatarRig;

/** Head-top height in metres for a config, without building a rig (a medium character is 1.7 m). */
export function avatarHeight(config: AvatarConfig): number {
  return NOMINAL_HEIGHT * HEIGHT_SCALE[config.height];
}
