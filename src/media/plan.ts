import type { Size } from './types';

/** Scales to fit inside a long-edge limit without enlarging. Sizes are whole pixels of 1 or more. */
export function fitWithin(width: number, height: number, longEdge: number): Size {
  const long = Math.max(width, height);
  if (long <= longEdge)
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = longEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Plans the canvases to draw through when shrinking an image, in order. Every canvas stays
 * within `cap` pixels on its long edge (iOS limits canvas area to about 16.7 million pixels, and
 * 24 and 48 megapixel photos exceed it; ADR 0004), and no single step shrinks by more than 2x
 * except the first step of an oversized source, which is capped at `cap`. Smoothing quality
 * drops sharply beyond 2x on some browsers, hence the halving.
 *
 * Returns an empty array when the source already fits `target`.
 */
export function planResizeSteps(
  width: number,
  height: number,
  target: number,
  cap: number,
): Size[] {
  const finalSize = fitWithin(width, height, target);
  const long = Math.max(width, height);
  if (long <= target) return [];
  const steps: Size[] = [];
  let currentLong = long;
  while (currentLong > target) {
    const nextLong = Math.max(target, Math.min(cap, Math.ceil(currentLong / 2)));
    steps.push(nextLong === target ? finalSize : fitWithin(width, height, nextLong));
    currentLong = nextLong;
  }
  return steps;
}
