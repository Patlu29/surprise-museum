import type { CharacterState } from './characterState';

/**
 * Animation timing for idle, walk and present (ADR 0008, architecture 6.7). This turns
 * `locomotion`, `speed` and `gesture` into the numbers the avatar rig needs (walk phase, walk
 * blend, idle clock, present level). The joint angles themselves belong to the avatar kit's
 * `applyPose`, so the look of the motion lives with the rig. Nothing here knows where the state
 * came from (NFR-25).
 */

export const ANIMATION = {
  /** Metres travelled per full walk cycle (two steps). */
  strideLength: 1.2,
  /** Seconds to blend between idle and walk. */
  blendSeconds: 0.15,
  /** The presenting arm rises over this long, holds while gesture is 'present', then lowers. */
  presentSeconds: 0.6,
} as const;

export interface AnimState {
  /** Walk phase in radians, one full stride pair per 2 PI. */
  phase: number;
  /** 0 idle, 1 full walk. */
  walkBlend: number;
  /** 0 arm down, 1 arm raised (linear; the output is eased). */
  presentLevel: number;
  /** Seconds, for breathing and sway. */
  clock: number;
}

/** What the rig's `applyPose` takes. */
export interface AnimOutput {
  walkPhase: number;
  walkAmount: number;
  idleTime: number;
  /** 0 to 1, smoothstepped. */
  present: number;
}

export function createAnimState(): AnimState {
  return { phase: 0, walkBlend: 0, presentLevel: 0, clock: 0 };
}

export function createAnimOutput(): AnimOutput {
  return { walkPhase: 0, walkAmount: 0, idleTime: 0, present: 0 };
}

/**
 * Advance the timing by dt and write the output.
 * Reduced motion: the idle clock is held at zero (no sway or breathing) and the present gesture
 * never rises, so the pose is still. The walk cycle stays, because it is how the character shows
 * the movement the user asked for (FR-18).
 */
export function stepAnimation(
  state: AnimState,
  input: Pick<CharacterState, 'speed' | 'locomotion' | 'gesture'>,
  dt: number,
  reducedMotion: boolean,
  out: AnimOutput = createAnimOutput(),
): AnimOutput {
  state.clock += dt;

  const walking = input.locomotion === 'walk';
  const blendStep = dt / ANIMATION.blendSeconds;
  state.walkBlend += Math.max(-blendStep, Math.min(blendStep, (walking ? 1 : 0) - state.walkBlend));

  if (walking) {
    state.phase += ((input.speed * dt) / ANIMATION.strideLength) * Math.PI * 2;
    if (state.phase > Math.PI * 2) state.phase -= Math.PI * 2;
  }

  const presentTarget = !reducedMotion && input.gesture === 'present' ? 1 : 0;
  const presentStep = dt / ANIMATION.presentSeconds;
  state.presentLevel += Math.max(
    -presentStep,
    Math.min(presentStep, presentTarget - state.presentLevel),
  );

  const p = state.presentLevel;
  out.walkPhase = state.phase;
  out.walkAmount = state.walkBlend;
  out.idleTime = reducedMotion ? 0 : state.clock;
  out.present = p * p * (3 - 2 * p);
  return out;
}
