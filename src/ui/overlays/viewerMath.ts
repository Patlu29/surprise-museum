/**
 * Zoom and pan maths for the full-screen photo viewer (design spec 5.8). The image is laid out
 * to fit its container (`object-fit: contain`) at scale 1; the transform is
 * `translate(x, y) scale(scale)` about its centre.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

export interface Size2 {
  width: number;
  height: number;
}

export const IDENTITY: ViewTransform = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/** Keeps the zoomed image covering the container: no panning past its edges. */
export function clampPan(
  transform: ViewTransform,
  content: Size2,
  container: Size2,
): ViewTransform {
  const scale = clampScale(transform.scale);
  const limitX = Math.max(0, (content.width * scale - container.width) / 2);
  const limitY = Math.max(0, (content.height * scale - container.height) / 2);
  return {
    scale,
    // `+ 0` turns -0 into 0.
    x: Math.max(-limitX, Math.min(limitX, transform.x)) + 0,
    y: Math.max(-limitY, Math.min(limitY, transform.y)) + 0,
  };
}

/**
 * Changes the scale while keeping the point under `focal` (relative to the container centre) fixed.
 */
export function zoomAt(
  transform: ViewTransform,
  nextScale: number,
  focal: { x: number; y: number },
  content: Size2,
  container: Size2,
): ViewTransform {
  const scale = clampScale(nextScale);
  if (scale === transform.scale) return clampPan(transform, content, container);
  const ratio = scale / transform.scale;
  return clampPan(
    {
      scale,
      x: focal.x - ratio * (focal.x - transform.x),
      y: focal.y - ratio * (focal.y - transform.y),
    },
    content,
    container,
  );
}

/** Double-tap or double-click: toggles between 1 and 2.5 times (design spec 5.8). */
export function toggleZoom(
  transform: ViewTransform,
  focal: { x: number; y: number },
  content: Size2,
  container: Size2,
): ViewTransform {
  return transform.scale > 1.01
    ? { ...IDENTITY }
    : zoomAt(transform, DOUBLE_TAP_SCALE, focal, content, container);
}
