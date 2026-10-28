import { firstHitDistance, inflateAabb, pointInAabb, type Aabb } from '../navigation/geometry';
import { clamp, type Vec2 } from '../math/vec2';

/**
 * Third-person camera maths (design spec 3.4 and 6.3). Pure, so the composition targets are
 * unit-tested: the Visitor must not fill the screen or hide the picture she is looking at.
 *
 * Yaw is the direction the camera looks, in the heading convention (forward = (sin, cos)), so
 * yaw = PI looks down the route (-Z). Pitch is the elevation of the camera above the pivot.
 */

export const CAMERA_LIMITS = {
  pitchMinDeg: 4,
  pitchMaxDeg: 55,
  boomMin: 2.5,
  boomMax: 6,
  /** The boom may shorten this far when a wall is in the way. */
  boomOcclusionMin: 1.2,
  occlusionMargin: 0.25,
  /** Reset view appears beyond this many degrees from the default (design spec 6.4). */
  resetThresholdDeg: 20,
} as const;

export type ViewportClass = 'phone-portrait' | 'phone-landscape' | 'wide';

export interface Composition {
  viewportClass: ViewportClass;
  /** Vertical field of view in degrees (design: 50 to 60). */
  fovDeg: number;
  /** Default distance from the pivot to the camera, metres. */
  boom: number;
  defaultPitchDeg: number;
  /** Height of the camera's pivot above the Visitor's feet. */
  pivotHeight: number;
  /**
   * Constant view offset as a fraction of viewport height (negative moves the picture down).
   * Apply with camera.setViewOffset(w, h, 0, offset * h, w, h). It is a fixed composition, not
   * camera motion.
   */
  viewOffsetY: number;
  /** Expected on-screen figures, for tests and the handoff. */
  visitorHeightFraction: number;
  feetFromTop: number;
}

/** Targets from design spec 3.4: Visitor height on screen and feet position, by viewport. */
const TARGETS: Record<ViewportClass, { height: number; feet: number; fov: number }> = {
  'phone-portrait': { height: 0.3, feet: 0.72, fov: 60 },
  'phone-landscape': { height: 0.46, feet: 0.8, fov: 52 },
  wide: { height: 0.4, feet: 0.82, fov: 52 },
};

const VISITOR_HEIGHT = 1.7;
const PIVOT_HEIGHT = 0.9;
const DEFAULT_PITCH_DEG = 14;

export function classifyViewport(width: number, height: number): ViewportClass {
  if (height > width && width < 640) return 'phone-portrait';
  if (width > height && height <= 500) return 'phone-landscape';
  return 'wide';
}

export function computeComposition(width: number, height: number): Composition {
  const viewportClass = classifyViewport(width, height);
  const t = TARGETS[viewportClass];
  const pitch = (DEFAULT_PITCH_DEG * Math.PI) / 180;
  // Screen height of one metre at the pivot, in NDC (the viewport spans 2).
  const k = (2 * t.height) / VISITOR_HEIGHT;
  const boom = clamp(
    Math.cos(pitch) / (k * Math.tan((t.fov * Math.PI) / 180 / 2)),
    CAMERA_LIMITS.boomMin,
    CAMERA_LIMITS.boomMax,
  );
  const feetNdc = 1 - 2 * t.feet;
  const pivotNdc = feetNdc + PIVOT_HEIGHT * k;
  return {
    viewportClass,
    fovDeg: t.fov,
    boom,
    defaultPitchDeg: DEFAULT_PITCH_DEG,
    pivotHeight: PIVOT_HEIGHT,
    viewOffsetY: pivotNdc / 2,
    visitorHeightFraction: t.height,
    feetFromTop: t.feet,
  };
}

/** Where the camera sits for a pivot, yaw, pitch (radians) and boom. */
export function cameraPose(
  pivot: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  boom: number,
): { position: { x: number; y: number; z: number }; forward: { x: number; y: number; z: number } } {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return {
    position: { x: pivot.x - fx * boom * cp, y: pivot.y + boom * sp, z: pivot.z - fz * boom * cp },
    forward: { x: fx * cp, y: -sp, z: fz * cp },
  };
}

/**
 * Boom length after walls shorten it (design spec 6.3), at least 1.2 m.
 *
 * `hard` walls always stop the camera. `soft` walls (the partitions between rooms) do not: the
 * camera may sit behind them and the scene fades them, so the Visitor keeps her on-screen size in
 * narrow rooms. The one thing a soft wall still does is keep the camera itself out of the wall's
 * thickness: if the camera would end up inside (or within the margin of) a soft wall, the boom is
 * shortened to stop in front of it.
 */
export function occludedBoom(
  pivot: Vec2,
  yaw: number,
  pitch: number,
  boom: number,
  hard: readonly Aabb[],
  soft: readonly Aabb[] = [],
): number {
  const cp = Math.max(0.2, Math.cos(pitch));
  const dir = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  let horizontal = boom * cp;
  const hit = firstHitDistance(pivot, dir, horizontal, hard, CAMERA_LIMITS.occlusionMargin);
  if (hit < horizontal) horizontal = hit;

  const band = CAMERA_LIMITS.occlusionMargin + 0.1;
  for (const box of soft) {
    const end = { x: pivot.x + dir.x * horizontal, z: pivot.z + dir.z * horizontal };
    const inflated = inflateAabb(box, band);
    if (!pointInAabb(end, inflated)) continue;
    const stop = firstHitDistance(pivot, dir, horizontal, [box], band);
    if (stop < horizontal) horizontal = stop;
  }
  return Math.max(CAMERA_LIMITS.boomOcclusionMin, horizontal / cp);
}

export function clampPitch(pitch: number): number {
  return clamp(
    pitch,
    (CAMERA_LIMITS.pitchMinDeg * Math.PI) / 180,
    (CAMERA_LIMITS.pitchMaxDeg * Math.PI) / 180,
  );
}

export function clampBoom(boom: number): number {
  return clamp(boom, CAMERA_LIMITS.boomMin, CAMERA_LIMITS.boomMax);
}
