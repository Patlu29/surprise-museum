import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_MS,
  DOWNGRADE_COOLDOWN_MS,
  INTERACTION_HOLD_MS,
  MAX_UPGRADES,
  cameraSettledForUpgrade,
  initialDockState,
  requestFreeRechoice,
  stepDock,
  type DockState,
} from './captionDockState';
import type { DockInputs, Rect } from './chooseCaptionDock';
import { detectLayout } from '@/lib/layout';

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

function inputs(actors: Rect[] = [], picture: Rect | null = null): DockInputs {
  return {
    layout: detectLayout(1280, 720),
    viewport: rect(12, 12, 1256, 696),
    insets: { top: 56, bottom: 0 },
    keepOut: [],
    picture,
    actors,
    bigText: false,
  };
}

/** Blocks the right full and fitted cards, so the first sample places a strip or left full. */
const blockRightFull = rect(900, 300, 300, 200);
const blockLeft = rect(20, 70, 300, 300);

/** Runs samples every 100 ms; `blocked(t)` says which actors are present at time t. */
function run(
  from: number,
  to: number,
  state: DockState,
  actorsAt: (t: number) => Rect[],
  opts: { settled?: (t: number) => boolean; busy?: (t: number) => boolean } = {},
): { state: DockState; changes: number[] } {
  const changes: number[] = [];
  let s = state;
  for (let t = from; t <= to; t += 100) {
    const before = s.placement;
    s = stepDock(s, {
      inputs: inputs(actorsAt(t)),
      now: t,
      settled: opts.settled?.(t) ?? true,
      busy: opts.busy?.(t) ?? false,
    });
    if (s.placement !== before && before !== null) changes.push(t);
  }
  return { state: s, changes };
}

const both = [blockRightFull, blockLeft];

describe('stepDock: upgrade rule', () => {
  it('U1: upgrades once, 600 to 800 ms after the blocker clears', () => {
    const start = run(0, 2000, initialDockState(), () => both).state;
    expect(start.placement?.size).not.toBe('full');
    const clearedAt = 2100;
    const result = run(clearedAt, 4000, start, (t) => (t < clearedAt ? both : []));
    expect(result.changes).toHaveLength(1);
    const delay = (result.changes[0] ?? 0) - clearedAt;
    expect(delay).toBeGreaterThanOrEqual(600);
    expect(delay).toBeLessThanOrEqual(800);
    expect(result.state.placement?.size).toBe('full');
    expect(result.state.upgrades).toBe(1);
  });

  it('U2: a blocker toggling every 300 ms never causes an upgrade', () => {
    const start = run(0, 2000, initialDockState(), () => both).state;
    const toggling = (t: number) => (Math.floor((t - 2000) / 300) % 2 === 0 ? both : []);
    const result = run(2100, 12000, start, toggling);
    expect(result.changes.length).toBeLessThanOrEqual(1);
    expect(result.state.upgrades).toBeLessThanOrEqual(1);
  });

  it('U3: a candidate that clears by only 9 to 15 px is not taken', () => {
    // The picture's right edge sits 12 px from the right dock's left edge: clear at 8, blocked at 16.
    const start = run(0, 2000, initialDockState(), () => both).state;
    const placed = start.placement;
    expect(placed?.size).not.toBe('full');
    const right = placed ? placed.expandedRect.x : 0;
    const near = rect(right - 12 - 40, 400, 40, 100);
    // Only left blocked: the right candidate clears at 8 px but not at 16 px.
    const result = run(2100, 6000, start, () => [blockLeft, near]);
    expect(result.changes).toHaveLength(0);
  });

  it('U4: cool-down and cap: at most two upgrades, none closer than 1.5 s', () => {
    let s = initialDockState();
    const changes: number[] = [];
    // Start fully blocked, then open one candidate at a time over a long run.
    const stages = (t: number) => (t < 2000 ? both : t < 5000 ? [blockLeft] : []);
    for (let t = 0; t <= 15000; t += 100) {
      const before = s.placement;
      s = stepDock(s, { inputs: inputs(stages(t)), now: t, settled: true, busy: false });
      if (before && s.placement !== before) changes.push(t);
    }
    expect(s.upgrades).toBeLessThanOrEqual(MAX_UPGRADES);
    for (let i = 1; i < changes.length; i += 1) {
      expect((changes[i] ?? 0) - (changes[i - 1] ?? 0)).toBeGreaterThanOrEqual(COOLDOWN_MS);
    }
  });

  it('a downgrade blocks upgrades for 3 s', () => {
    // Placed full on the right; a blocker arrives and stays: downgrade after 400 ms.
    let s = run(0, 500, initialDockState(), () => []).state;
    expect(s.placement?.dock).toBe('right');
    const blocker = [blockRightFull];
    const r = run(600, 1500, s, () => blocker);
    s = r.state;
    expect(r.changes).toHaveLength(1);
    expect(s.cooldownMs).toBe(DOWNGRADE_COOLDOWN_MS);
    const downgradedAt = r.changes[0] ?? 0;
    // The blocker leaves at once; no upgrade before 3 s have passed.
    const after = run(1600, downgradedAt + DOWNGRADE_COOLDOWN_MS - 100, s, () => []);
    expect(after.changes).toHaveLength(0);
    const later = run(downgradedAt + DOWNGRADE_COOLDOWN_MS, downgradedAt + 4500, after.state, () => []);
    expect(later.changes).toHaveLength(1);
  });

  it('U5: no upgrade while busy, and not until 600 ms after it ends', () => {
    const start = run(0, 2000, initialDockState(), () => both).state;
    const busyUntil = 5000;
    const result = run(2100, 7000, start, (t) => (t < 2100 ? both : []), {
      busy: (t) => t <= busyUntil,
    });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toBeGreaterThanOrEqual(busyUntil + INTERACTION_HOLD_MS);
  });

  it('U6: no upgrade while the camera is entering or returning', () => {
    const start = run(0, 2000, initialDockState(), () => both).state;
    const result = run(2100, 6000, start, () => [], { settled: () => false });
    expect(result.changes).toHaveLength(0);
    expect(result.state.placement?.size).not.toBe('full');
  });

  it('settled rule: framed and follow count, a cut counts 300 ms after it ends', () => {
    expect(cameraSettledForUpgrade('framed', true, 0, 10)).toBe(true);
    expect(cameraSettledForUpgrade('follow', true, 0, 10)).toBe(true);
    expect(cameraSettledForUpgrade('entering', false, 0, 10_000)).toBe(false);
    expect(cameraSettledForUpgrade('returning', false, 0, 10_000)).toBe(false);
    expect(cameraSettledForUpgrade('cut', true, 1000, 1200)).toBe(false);
    expect(cameraSettledForUpgrade('cut', true, 1000, 1300)).toBe(true);
  });

  it('the one free re-choice at the first framed signal needs no dwell or cool-down', () => {
    // Card appears early while the Guide blocks the right dock.
    const start = run(0, 200, initialDockState(), () => both, { settled: () => false }).state;
    expect(start.placement?.size).not.toBe('full');
    // The framing settles; the blockers are gone. Re-choice takes effect on the next sample.
    const armed = requestFreeRechoice(start);
    const next = stepDock(armed, { inputs: inputs([]), now: 300, settled: true, busy: false });
    expect(next.placement?.size).toBe('full');
    expect(next.upgrades).toBe(0);
    expect(next.freeRechoice).toBe(false);
  });

  it('a free re-choice waits for a settled camera', () => {
    const start = run(0, 200, initialDockState(), () => both).state;
    const armed = requestFreeRechoice(start);
    const next = stepDock(armed, { inputs: inputs([]), now: 300, settled: false, busy: false });
    expect(next.freeRechoice).toBe(true);
    expect(next.placement).toBe(start.placement);
  });

  it('a downgrade needs 400 ms of overlap', () => {
    const s = run(0, 500, initialDockState(), () => []).state;
    const blocker = [blockRightFull];
    const r = run(600, 900, s, () => blocker);
    expect(r.changes).toHaveLength(0);
    const r2 = run(600, 1100, s, () => blocker);
    expect(r2.changes).toHaveLength(1);
  });
});
