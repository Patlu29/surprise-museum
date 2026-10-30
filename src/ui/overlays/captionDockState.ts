import type { LayoutKind } from '@/lib/layout';
import type { DockInputs, Placement } from './chooseCaptionDock';
import type { Candidate } from './chooseCaptionDock';
import {
  candidateKey,
  chooseCaptionDock,
  clearUpgradeCandidates,
  isPlacementClear,
  samePlacement,
} from './chooseCaptionDock';

/**
 * The stability and upgrade rules for the caption card (design spec 3.5, "Stability"), as a pure
 * step function so the timers, hysteresis, cool-downs and cap are unit-tested with a fake clock.
 * The hook feeds it the 100 ms samples.
 */

/** A placement may overlap something for this long before it moves (a downgrade). */
export const OVERLAP_GRACE_MS = 400;
/** A better candidate must be clear for this long, in a row, before an upgrade. */
export const UPGRADE_DWELL_MS = 600;
/** No upgrade for this long after any placement change. */
export const COOLDOWN_MS = 1500;
/** No upgrade for this long after a downgrade. */
export const DOWNGRADE_COOLDOWN_MS = 3000;
/** At most this many upgrades per presentation. */
export const MAX_UPGRADES = 2;
/** After an interaction ends, upgrades wait this much longer. */
export const INTERACTION_HOLD_MS = 600;
/** After a `cut` ends, the camera counts as settled only once this has passed. */
export const CUT_SETTLE_MS = 300;

export interface DockState {
  placement: Placement | null;
  layout: LayoutKind | null;
  /** When the current placement began to overlap something, or null. */
  overlapSince: number | null;
  /** Per candidate: when it began to be clear at the upgrade margin. Reset by any blocked sample. */
  clearSince: Record<string, number>;
  lastChangeAt: number;
  cooldownMs: number;
  upgrades: number;
  /** Upgrades wait until this time (interaction end plus the hold). */
  interactionUntil: number;
  /** One free re-choice is pending (the first `framed` signal, if the card appeared earlier). */
  freeRechoice: boolean;
}

export interface DockStep {
  inputs: DockInputs;
  now: number;
  /** The presentation camera is `framed`, `follow`, or 300 ms past a `cut`; never `entering` or `returning`. */
  settled: boolean;
  /** Read more is open, focus is inside the card, it is being scrolled or touched, or the Visitor is typing. */
  busy: boolean;
}

export function initialDockState(): DockState {
  return {
    placement: null,
    layout: null,
    overlapSince: null,
    clearSince: {},
    lastChangeAt: -Infinity,
    cooldownMs: COOLDOWN_MS,
    upgrades: 0,
    interactionUntil: 0,
    freeRechoice: false,
  };
}

/** Marks the one free re-choice as available (call at the first `framed` signal if a card is already placed). */
export function requestFreeRechoice(state: DockState): DockState {
  return state.placement ? { ...state, freeRechoice: true } : state;
}

/** Whether the camera mode lets an upgrade be evaluated (design spec 3.5, rule 1). */
export function cameraSettledForUpgrade(
  mode: string,
  settled: boolean,
  changedAt: number,
  now: number,
): boolean {
  if (mode === 'entering' || mode === 'returning' || mode === 'pending') return false;
  if (mode === 'cut') return settled && now - changedAt >= CUT_SETTLE_MS;
  return true;
}

function changed(state: DockState, next: Placement, now: number, cooldownMs: number): DockState {
  return {
    ...state,
    placement: next,
    overlapSince: null,
    lastChangeAt: now,
    cooldownMs,
  };
}

/**
 * One 100 ms sample. Returns the next state; `state.placement` changes only when the card moves
 * (compare with `samePlacement`).
 */
export function stepDock(state: DockState, step: DockStep): DockState {
  const { inputs, now, settled, busy } = step;
  const current = state.placement;

  // A new card or a layout change starts from a fresh choice and a fresh budget.
  if (!current || current.layout !== inputs.layout) {
    return {
      ...state,
      placement: chooseCaptionDock(inputs),
      layout: inputs.layout,
      overlapSince: null,
      clearSince: {},
      lastChangeAt: now,
      cooldownMs: COOLDOWN_MS,
      upgrades: 0,
      interactionUntil: busy ? now + INTERACTION_HOLD_MS : 0,
    };
  }

  let next: DockState = state;
  if (busy) next = { ...next, interactionUntil: now + INTERACTION_HOLD_MS };

  // Per-candidate dwell timers keep running during interaction; a blocked sample resets that timer.
  const better = clearUpgradeCandidates(current, inputs);
  const clearSince: Record<string, number> = {};
  for (const candidate of better) {
    const key = candidateKey(candidate);
    clearSince[key] = state.clearSince[key] ?? now;
  }
  next = { ...next, clearSince };

  if (busy) return next;

  // The one free re-choice: no dwell, no cool-down, not counted towards the cap.
  if (next.freeRechoice && settled) {
    const choice = chooseCaptionDock(inputs);
    next = { ...next, freeRechoice: false };
    return samePlacement(current, choice) ? next : changed(next, choice, now, COOLDOWN_MS);
  }

  // Downgrade (the stay rule): overlapping for 400 ms or more moves to the best clear candidate.
  if (isPlacementClear(current, inputs)) {
    next = { ...next, overlapSince: null };
  } else {
    const since = next.overlapSince ?? now;
    if (now - since >= OVERLAP_GRACE_MS) {
      const choice = chooseCaptionDock(inputs);
      // A least-overlap fallback only moves to another fallback here; a clear candidate is an
      // upgrade and must pass the dwell and hysteresis tests below.
      if (samePlacement(current, choice) || (!current.clear && choice.clear)) {
        next = { ...next, overlapSince: now };
        return finishUpgrade(next, step, better, clearSince);
      }
      return { ...changed(next, choice, now, DOWNGRADE_COOLDOWN_MS), clearSince: {} };
    }
    next = { ...next, overlapSince: since };
  }

  return finishUpgrade(next, step, better, clearSince);
}

/** The upgrade rule: every condition must hold. */
function finishUpgrade(
  next: DockState,
  step: DockStep,
  better: Candidate[],
  clearSince: Record<string, number>,
): DockState {
  const { inputs, now, settled } = step;
  if (
    settled &&
    next.upgrades < MAX_UPGRADES &&
    now >= next.interactionUntil &&
    now - next.lastChangeAt >= next.cooldownMs
  ) {
    const target = better.find((candidate) => {
      const since = clearSince[candidateKey(candidate)];
      return since !== undefined && now - since >= UPGRADE_DWELL_MS;
    });
    if (target) {
      const upgraded: Placement = { ...target, layout: inputs.layout, clear: true };
      return { ...changed(next, upgraded, now, COOLDOWN_MS), upgrades: next.upgrades + 1 };
    }
  }
  return next;
}
