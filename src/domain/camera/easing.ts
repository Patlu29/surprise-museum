/**
 * Cubic-bezier easing, the same curve a CSS `cubic-bezier(x1, y1, x2, y2)` draws. Pure and
 * allocation-free after construction, so the camera can ease without touching the DOM.
 */
export type Easing = (t: number) => number;

const NEWTON_ITERATIONS = 6;
const BISECTION_ITERATIONS = 24;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Solve sampleX(s) = t: Newton first, bisection when the slope is flat.
    let s = t;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const err = sampleX(s) - t;
      if (Math.abs(err) < 1e-6) return sampleY(s);
      const slope = slopeX(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= err / slope;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < BISECTION_ITERATIONS; i++) {
      const x = sampleX(s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return sampleY(s);
  };
}

/**
 * `--ease-camera` (design spec 6.12.3, tokens.css): `cubic-bezier(0.37, 0, 0.63, 1)` (v1.3, ease-in-out
 * sine). Slow start, slow stop, no overshoot. Mirror of the token: change both together.
 */
export const easeCamera: Easing = cubicBezier(0.37, 0, 0.63, 1);
