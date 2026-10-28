import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  DOUBLE_TAP_SCALE,
  IDENTITY,
  MAX_SCALE,
  toggleZoom,
  zoomAt,
} from './viewerMath';

const container = { width: 400, height: 600 };
const content = { width: 400, height: 300 };

describe('clampScale', () => {
  it('keeps zoom between 1 and 5 times', () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(9)).toBe(MAX_SCALE);
  });
});

describe('clampPan', () => {
  it('does not allow panning when the photo fits', () => {
    expect(clampPan({ scale: 1, x: 80, y: 80 }, content, container)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });

  it('allows panning only as far as the zoomed photo extends past the container', () => {
    // At 2x the photo is 800 wide in a 400 container: 200 px each way. 600 tall in 600: no vertical pan.
    expect(clampPan({ scale: 2, x: 500, y: 500 }, content, container)).toEqual({
      scale: 2,
      x: 200,
      y: 0,
    });
    expect(clampPan({ scale: 2, x: -500, y: -500 }, content, container)).toEqual({
      scale: 2,
      x: -200,
      y: 0,
    });
  });
});

describe('zoomAt', () => {
  it('keeps the point under the finger in place', () => {
    const focal = { x: 100, y: 0 };
    const zoomed = zoomAt(IDENTITY, 2, focal, content, container);
    // Point under the focal: local = (focal - t) / scale before, and after.
    const before = focal.x / 1;
    const after = (focal.x - zoomed.x) / zoomed.scale;
    expect(after).toBeCloseTo(before, 5);
  });

  it('clamps the pan after zooming', () => {
    const zoomed = zoomAt(IDENTITY, 2, { x: 390, y: 0 }, content, container);
    expect(Math.abs(zoomed.x)).toBeLessThanOrEqual(200);
  });

  it('never goes beyond 5 times', () => {
    expect(zoomAt(IDENTITY, 50, { x: 0, y: 0 }, content, container).scale).toBe(MAX_SCALE);
  });
});

describe('toggleZoom', () => {
  it('toggles between 1 and 2.5 times', () => {
    const zoomed = toggleZoom(IDENTITY, { x: 0, y: 0 }, content, container);
    expect(zoomed.scale).toBe(DOUBLE_TAP_SCALE);
    expect(toggleZoom(zoomed, { x: 0, y: 0 }, content, container)).toEqual(IDENTITY);
  });
});
