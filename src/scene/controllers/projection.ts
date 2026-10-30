import { Vector3, type Camera } from 'three';
import { characterPoints } from '@/domain/camera/presentationFraming';
import { LAYOUT } from '@/domain/layout/constants';
import type { PhotoSlot } from '@/domain/layout/types';
import type { ScreenRect } from '@/state/screenRects';

const v = new Vector3();

/**
 * Bounding rectangle, in CSS pixels in client coordinates, of a set of world points.
 * Returns null if any point is behind the camera or the rectangle is wholly off screen.
 * The view offset used for composition is part of the projection matrix, so it is included.
 */
export function projectPoints(
  points: ReadonlyArray<readonly [number, number, number]>,
  camera: Camera,
  area: { left: number; top: number; width: number; height: number },
): ScreenRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    v.set(p[0], p[1], p[2]).project(camera);
    if (v.z > 1 || v.z < -1) return null; // behind the camera or beyond the far plane
    const x = area.left + (v.x * 0.5 + 0.5) * area.width;
    const y = area.top + (-v.y * 0.5 + 0.5) * area.height;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < area.left || minX > area.left + area.width) return null;
  if (maxY < area.top || minY > area.top + area.height) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The four corners of a picture's outer frame, in world space. */
export function frameCorners(slot: PhotoSlot): Array<[number, number, number]> {
  const hw = slot.frameWidth / 2;
  const hh = slot.frameHeight / 2;
  const x = slot.position.x + slot.normal.x * LAYOUT.frameDepth;
  const y = slot.position.y;
  const z = slot.position.z;
  return [
    [x, y - hh, z - hw],
    [x, y - hh, z + hw],
    [x, y + hh, z - hw],
    [x, y + hh, z + hw],
  ];
}

/**
 * The points that bound a standing character on screen, one body radius either side of the feet
 * and of the head top along the camera's right. The same shape the presentation-camera solver
 * uses (`characterPoints`), so the published rectangles, the solver and QA agree.
 */
export function characterCorners(
  x: number,
  z: number,
  height: number,
  camera: Camera,
): Array<[number, number, number]> {
  const e = camera.matrixWorld.elements;
  return characterPoints(x, z, height, e[0] ?? 1, e[2] ?? 0);
}

export function unionRect(a: ScreenRect | null, b: DOMRect | null): ScreenRect | null {
  if (!b || (b.width === 0 && b.height === 0)) return a;
  if (!a) return { x: b.left, y: b.top, width: b.width, height: b.height };
  const x = Math.min(a.x, b.left);
  const y = Math.min(a.y, b.top);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.right) - x,
    height: Math.max(a.y + a.height, b.bottom) - y,
  };
}
