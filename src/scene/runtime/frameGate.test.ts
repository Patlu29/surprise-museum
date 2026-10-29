import { describe, expect, it } from 'vitest';
import { createFrameGate } from './frameGate';

/** Simulates a display at `hz` for `seconds` and returns how many frames the gate lets through. */
function rendered(hz: number, fps: number, seconds: number, jitterMs = 0): number {
  const gate = createFrameGate(fps);
  const period = 1000 / hz;
  let count = 0;
  for (let i = 1; i * period <= seconds * 1000; i++) {
    // Deterministic jitter that alternates early and late.
    const t = i * period + (i % 2 === 0 ? jitterMs : -jitterMs);
    if (gate(t)) count++;
  }
  return count;
}

describe('createFrameGate', () => {
  it('renders every tick when the display is at the cap', () => {
    expect(rendered(60, 60, 10)).toBeGreaterThanOrEqual(595);
    expect(rendered(60, 60, 10, 0.4)).toBeGreaterThanOrEqual(595);
  });

  it('halves a 60 Hz display for a 30 FPS cap', () => {
    const n = rendered(60, 30, 10, 0.4);
    expect(n).toBeGreaterThanOrEqual(295);
    expect(n).toBeLessThanOrEqual(301);
  });

  it('holds 60 FPS on a 120 Hz display and never undershoots on 144 Hz', () => {
    const at120 = rendered(120, 60, 10, 0.3);
    expect(at120).toBeGreaterThanOrEqual(595);
    expect(at120).toBeLessThanOrEqual(605);
    const at144 = rendered(144, 60, 10, 0.3);
    expect(at144).toBeGreaterThanOrEqual(595);
    expect(at144).toBeLessThanOrEqual(760);
  });

  it('keeps an even 30 FPS rhythm on a display slightly off 60 Hz', () => {
    const gate = createFrameGate(30);
    const period = 16.6; // 60.24 Hz
    let last = 0;
    let worst = 0;
    for (let i = 1; i < 6000; i++) {
      if (gate(i * period)) {
        if (last > 0) worst = Math.max(worst, i * period - last);
        last = i * period;
      }
    }
    expect(worst).toBeLessThan(36); // no 50 ms frame hiding in the rhythm
  });

  it('runs a slow cap (10 FPS behind the welcome screen)', () => {
    const n = rendered(60, 10, 10);
    expect(n).toBeGreaterThanOrEqual(98);
    expect(n).toBeLessThanOrEqual(102);
  });

  it('does not burst to catch up after a stall', () => {
    const gate = createFrameGate(30);
    expect(gate(1000)).toBe(true);
    // A two second stall, then ticks at 60 Hz: one frame now, then the normal rhythm.
    expect(gate(3000)).toBe(true);
    expect(gate(3016.7)).toBe(false);
    expect(gate(3033.4)).toBe(true);
  });
});
