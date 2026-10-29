import { describe, expect, it } from 'vitest';
import { DprGovernor } from './dprGovernor';

/** Feeds `seconds` of frames at a fixed interval; returns the caps it asked for. */
function run(
  gov: DprGovernor,
  startMs: number,
  seconds: number,
  intervalMs: number,
  active = true,
): { changes: number[]; end: number } {
  const changes: number[] = [];
  let t = startMs;
  const end = startMs + seconds * 1000;
  while (t < end) {
    const next = gov.frame(t, active);
    if (next !== null) changes.push(next);
    t += intervalMs;
  }
  return { changes, end: t };
}

const phone = () => new DprGovernor({ targetFps: 30, start: 1.5, floor: 1 });

describe('DprGovernor', () => {
  it('leaves a device that holds its frame rate alone', () => {
    expect(run(phone(), 0, 60, 33.4).changes).toEqual([]);
    const laptop = new DprGovernor({ targetFps: 60, start: 2, floor: 1 });
    expect(run(laptop, 0, 60, 16.7).changes).toEqual([]);
  });

  it('ignores a slow start: nothing happens during the warm-up', () => {
    expect(run(phone(), 0, 5.5, 80).changes).toEqual([]);
  });

  it('steps down twice, then stops at the floor', () => {
    const gov = phone();
    const { changes } = run(gov, 0, 60, 60); // about 16 FPS against a target of 30
    expect(changes).toEqual([1.25, 1]);
    expect(gov.cap).toBe(1);
  });

  it('needs two slow windows in a row: one slow patch is forgiven', () => {
    const gov = phone();
    const a = run(gov, 0, 12.1, 33.4); // warm-up (6 s) and two good windows
    const b = run(gov, a.end, 3, 70); // one slow window
    const c = run(gov, b.end, 10, 33.4); // recovers
    expect([...a.changes, ...b.changes, ...c.changes]).toEqual([]);
  });

  it('ignores pauses and single long frames', () => {
    const gov = phone();
    run(gov, 0, 8, 33.4);
    expect(gov.frame(20_000, true)).toBeNull(); // a hidden tab: one 12 s gap
    expect(run(gov, 20_033, 10, 33.4).changes).toEqual([]);
  });

  it('does not count time on the welcome screen or in the viewer, and warms up again after', () => {
    const gov = phone();
    expect(run(gov, 0, 30, 100, false).changes).toEqual([]);
    expect(run(gov, 30_000, 5.5, 100).changes).toEqual([]); // still warming up
  });

  it('waits to settle after a change before judging again', () => {
    const gov = phone();
    const first = run(gov, 0, 20, 60);
    expect(first.changes[0]).toBe(1.25);
    expect(first.changes.length).toBeLessThanOrEqual(2);
  });
});
