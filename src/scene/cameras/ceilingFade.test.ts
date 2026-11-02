import { describe, expect, it } from 'vitest';
import {
  cameraPose,
  CAMERA_LIMITS,
  clampPitch,
  computeComposition,
} from '@/domain/camera/composition';
import { LAYOUT } from '@/domain/layout/constants';
import {
  boomLimitForHeight,
  CEILING_FADE,
  CEILING_HEIGHT,
  ceilingOpacityFor,
  ceilingReducedStep,
  maxCameraHeight,
} from './ceilingFade';

const H = CEILING_HEIGHT;
const DEG = Math.PI / 180;

describe('ceilingOpacityFor (spec 6.3)', () => {
  it('uses the scene wall height as the ceiling height', () => {
    expect(H).toBe(LAYOUT.wallHeight);
  });

  it('is fully opaque 0.6 m or more under the ceiling', () => {
    expect(ceilingOpacityFor(H - 0.6)).toBe(1);
    expect(ceilingOpacityFor(1.07)).toBe(1); // lowest orbit (pitch 4, boom 2.5)
    expect(ceilingOpacityFor(1.92)).toBe(1); // the default desktop pose
  });

  it('is fully clear within 0.1 m of the ceiling and above it, and not drawn then', () => {
    expect(ceilingOpacityFor(H - 0.1)).toBe(0);
    expect(ceilingOpacityFor(H - 0.05)).toBe(0);
    expect(ceilingOpacityFor(H)).toBe(0);
    expect(ceilingOpacityFor(4.4)).toBe(0);
    expect(ceilingOpacityFor(5.8)).toBe(0);
  });

  it('falls smoothly and monotonically in between, with no step', () => {
    let prev = 1;
    for (let y = H - 0.6; y <= H - 0.1 + 1e-9; y += 0.005) {
      const o = ceilingOpacityFor(y);
      expect(o).toBeLessThanOrEqual(prev + 1e-12);
      expect(prev - o).toBeLessThan(0.05); // at most 5% per 5 mm: no pop
      prev = o;
    }
    expect(ceilingOpacityFor(H - 0.35)).toBeCloseTo(0.5, 5);
  });

  it('cannot flicker: the same height always gives the same opacity', () => {
    const y = H - 0.3;
    const a = ceilingOpacityFor(y);
    for (let i = 0; i < 20; i++) expect(ceilingOpacityFor(y)).toBe(a);
    expect(Math.abs(ceilingOpacityFor(y + 0.001) - ceilingOpacityFor(y - 0.001))).toBeLessThan(
      0.02,
    );
  });

  it('is exactly 0 below the draw threshold so the caller can skip drawing', () => {
    for (let y = H - 0.6; y < H; y += 0.01) {
      const o = ceilingOpacityFor(y);
      expect(o === 0 || o >= CEILING_FADE.hideBelow).toBe(true);
    }
  });

  it('follows the ceiling height when it is given', () => {
    expect(ceilingOpacityFor(4.0, 5)).toBe(1);
    expect(ceilingOpacityFor(4.95, 5)).toBe(0);
  });

  it('leaves the default view as opaque as today in every viewport class, with the real wall height', () => {
    for (const [w, h] of [
      [360, 640],
      [390, 844],
      [844, 390],
      [1280, 720],
      [1920, 1080],
    ] as const) {
      const c = computeComposition(w, h);
      const y = cameraPose({ x: 0, y: c.pivotHeight, z: 0 }, 0, c.defaultPitchDeg * DEG, c.boom)
        .position.y;
      expect(
        H - y,
        `${w}x${h}: default camera is at least 0.6 m under the ceiling`,
      ).toBeGreaterThanOrEqual(0.6);
      expect(ceilingOpacityFor(y), `${w}x${h}`).toBe(1);
    }
  });
});

describe('ceilingReducedStep (reduced motion)', () => {
  it('switches off above H - 0.35 and on below H - 0.55, in one step', () => {
    expect(ceilingReducedStep(H - 0.34, true)).toBe(0);
    expect(ceilingReducedStep(H - 0.34, false)).toBe(0);
    expect(ceilingReducedStep(H - 0.56, true)).toBe(1);
    expect(ceilingReducedStep(H - 0.56, false)).toBe(1);
    expect(ceilingReducedStep(5, true)).toBe(0);
    expect(ceilingReducedStep(1.9, false)).toBe(1);
  });

  it('keeps its state between the two (0.2 m of hysteresis), so it never flickers', () => {
    for (let y = H - 0.55; y <= H - 0.35; y += 0.01) {
      expect(ceilingReducedStep(y, true), `on at ${y}`).toBe(1);
      expect(ceilingReducedStep(y, false), `off at ${y}`).toBe(0);
    }
  });

  it('a camera hovering inside the hysteresis band never toggles', () => {
    let on = true;
    let toggles = 0;
    for (let i = 0; i < 400; i++) {
      const y = H - 0.45 + 0.08 * Math.sin(i / 3); // jitter inside the band
      const nowOn: boolean = ceilingReducedStep(y, on) === 1;
      if (nowOn !== on) toggles++;
      on = nowOn;
    }
    expect(toggles).toBe(0);
  });

  it('only ever returns 0 or 1', () => {
    let on = true;
    for (let y = 0; y < 6; y += 0.05) {
      const v = ceilingReducedStep(y, on);
      expect([0, 1]).toContain(v);
      on = v === 1;
    }
  });
});

describe('the orbit reaches the ceiling (what the rule is for)', () => {
  const pivotY = 0.9;
  it('crosses the ceiling at a pitch the spec allows, so the fade is needed', () => {
    const top = cameraPose({ x: 0, y: pivotY, z: 0 }, 0, 55 * DEG, 6).position.y;
    expect(top).toBeGreaterThan(H);
    expect(ceilingOpacityFor(top)).toBe(0);
  });
  it('is opaque for the whole default-boom orbit up to 23 degrees', () => {
    const boom = 4.2;
    for (let p = CAMERA_LIMITS.pitchMinDeg; p <= 23; p++) {
      const y = cameraPose({ x: 0, y: pivotY, z: 0 }, 0, p * DEG, boom).position.y;
      expect(ceilingOpacityFor(y), `pitch ${p}`).toBe(1);
    }
  });
});

describe('boomLimitForHeight', () => {
  const pivotY = 0.9;
  it('lets the camera reach at most 2 m above the ceiling', () => {
    expect(maxCameraHeight()).toBeCloseTo(H + 2, 9);
    for (let p = CAMERA_LIMITS.pitchMinDeg; p <= CAMERA_LIMITS.pitchMaxDeg; p += 1) {
      for (const boom of [2.5, 4.2, 6]) {
        const limited = Math.min(boom, boomLimitForHeight(pivotY, p * DEG));
        const y = cameraPose({ x: 0, y: pivotY, z: 0 }, 0, clampPitch(p * DEG), limited).position.y;
        expect(y, `pitch ${p} boom ${boom}`).toBeLessThanOrEqual(
          Math.max(maxCameraHeight(), pivotY + CAMERA_LIMITS.boomMin * Math.sin(p * DEG)) + 1e-9,
        );
      }
    }
  });

  it('does not touch the spec pitch range at the default boom, and only trims the longest booms', () => {
    // Pitch 55 degrees: 5.25 m is allowed, so a 4.2 m default boom is untouched.
    expect(boomLimitForHeight(pivotY, 55 * DEG)).toBeCloseTo(
      (H + 2 - pivotY) / Math.sin(55 * DEG),
      9,
    );
    expect(boomLimitForHeight(pivotY, 55 * DEG)).toBeGreaterThan(5.2);
    expect(boomLimitForHeight(pivotY, 55 * DEG)).toBeLessThan(CAMERA_LIMITS.boomMax);
    // At the default pitch there is no limit worth speaking of.
    expect(boomLimitForHeight(pivotY, 14 * DEG)).toBeGreaterThan(CAMERA_LIMITS.boomMax);
  });

  it('never goes below the minimum boom and handles a flat camera', () => {
    expect(boomLimitForHeight(5, 55 * DEG)).toBe(CAMERA_LIMITS.boomMin);
    expect(boomLimitForHeight(pivotY, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
