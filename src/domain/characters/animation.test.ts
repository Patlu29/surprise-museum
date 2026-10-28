import { describe, expect, it } from 'vitest';
import { ANIMATION, createAnimOutput, createAnimState, stepAnimation } from './animation';

const walk = { speed: 1.6, locomotion: 'walk' as const, gesture: 'none' as const };
const idle = { speed: 0, locomotion: 'idle' as const, gesture: 'none' as const };
const present = { speed: 0, locomotion: 'idle' as const, gesture: 'present' as const };

function run(input: typeof walk | typeof idle | typeof present, seconds: number, reduced = false) {
  const s = createAnimState();
  const out = createAnimOutput();
  for (let i = 0; i < Math.round(seconds * 60); i++) stepAnimation(s, input, 1 / 60, reduced, out);
  return { s, out };
}

describe('animation timing', () => {
  it('advances the walk phase only while locomotion is walk (FR-18)', () => {
    expect(run(idle, 2).s.phase).toBe(0);
    expect(run(walk, 2).s.phase).not.toBe(0);
  });

  it('advances the phase in proportion to speed, so feet do not slide', () => {
    const slow = run({ ...walk, speed: 0.8 }, 1);
    const fast = run({ ...walk, speed: 1.6 }, 1);
    expect(slow.s.phase).toBeCloseTo((0.8 / ANIMATION.strideLength) * Math.PI * 2, 1);
    const cycles = 1.6 / ANIMATION.strideLength;
    expect(fast.s.phase / (Math.PI * 2)).toBeCloseTo(cycles - Math.floor(cycles), 1);
  });

  it('blends between idle and walk in about 150 ms', () => {
    const s = createAnimState();
    const out = createAnimOutput();
    for (let i = 0; i < 4; i++) stepAnimation(s, walk, 1 / 60, false, out);
    expect(out.walkAmount).toBeLessThan(1);
    for (let i = 0; i < 6; i++) stepAnimation(s, walk, 1 / 60, false, out);
    expect(out.walkAmount).toBe(1);
    for (let i = 0; i < 12; i++) stepAnimation(s, idle, 1 / 60, false, out);
    expect(out.walkAmount).toBe(0);
  });

  it('raises the arm over 0.6 s for the present gesture and lowers it afterwards', () => {
    const s = createAnimState();
    const out = createAnimOutput();
    for (let i = 0; i < 18; i++) stepAnimation(s, present, 1 / 60, false, out); // 0.3 s
    expect(out.present).toBeGreaterThan(0.2);
    expect(out.present).toBeLessThan(1);
    for (let i = 0; i < 20; i++) stepAnimation(s, present, 1 / 60, false, out); // 0.63 s
    expect(out.present).toBeCloseTo(1, 5);
    for (let i = 0; i < 40; i++) stepAnimation(s, idle, 1 / 60, false, out);
    expect(out.present).toBe(0);
  });

  it('holds a still pose under reduced motion: no gesture, idle clock frozen', () => {
    const { out } = run(present, 3, true);
    expect(out.present).toBe(0);
    expect(out.idleTime).toBe(0);
  });

  it('keeps the walk cycle under reduced motion, since it shows the movement the user asked for', () => {
    expect(run(walk, 1, true).out.walkAmount).toBe(1);
  });

  it('runs the idle clock with full motion', () => {
    expect(run(idle, 1.3).out.idleTime).toBeGreaterThan(1.2);
  });
});
