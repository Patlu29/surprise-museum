import { CAMERA_LIMITS } from '@/domain/camera/composition';
import { LAYOUT } from '@/domain/layout/constants';

/**
 * Ceiling cutaway (design spec 6.3, "Ceiling and a high camera"). Pure, so the rule is
 * unit-tested; the scene applies it in `CeilingFade`.
 *
 * The camera orbits the Visitor, so at a high pitch with a long boom it sits above the ceiling
 * (pivot 0.9 m + boom x sin pitch: more than 3.2 m from about 33 degrees at a 4.2 m boom). The
 * ceiling is therefore handled three ways, which do not depend on each other:
 *   1. It is a single-sided, down-facing surface, so from above it is back-face culled and can
 *      never occlude (no sorting, no extra draw call).
 *   2. Its opacity is a continuous function of the camera's height only (no timer, so it follows
 *      the user's own input and cannot flicker), which keeps the ceiling from filling the top of
 *      the view as the camera nears it from below.
 *   3. The camera's height is capped a little above the ceiling, so a very long boom at a steep
 *      pitch does not send the camera to the roof.
 * Below an opacity of `hideBelow` the ceiling is not drawn at all.
 */
export const CEILING_FADE = {
  /** Fully opaque with the camera at least this far under the ceiling (metres). */
  opaqueBelow: 0.6,
  /** Fully clear within this distance of the ceiling, or above it (metres). */
  clearWithin: 0.1,
  /** Reduced motion: switches off when the camera rises above this far under the ceiling... */
  reducedOffBelow: 0.35,
  /** ...and back on when it falls below this far under the ceiling (0.2 m of hysteresis). */
  reducedOnBelow: 0.55,
  /** The ceiling is not drawn below this opacity. */
  hideBelow: 0.02,
  /** The camera never sits higher than this above the ceiling (metres). */
  maxAboveCeiling: 2.0,
} as const;

/** Height of the ceiling plane in the scene. */
export const CEILING_HEIGHT = LAYOUT.wallHeight;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The ceiling's opacity for a camera at height `cameraY`: 1 - smoothstep(H - 0.6, H - 0.1, y)
 * (spec 6.3). Opaque with the camera 0.6 m or more under the ceiling, clear within 0.1 m and
 * above. Returns exactly 0 below `hideBelow`, so the caller can skip drawing.
 */
export function ceilingOpacityFor(cameraY: number, ceilingY: number = CEILING_HEIGHT): number {
  const o =
    1 -
    smoothstep(ceilingY - CEILING_FADE.opaqueBelow, ceilingY - CEILING_FADE.clearWithin, cameraY);
  return o < CEILING_FADE.hideBelow ? 0 : o;
}

/**
 * Reduced motion: any fade is instant, so the ceiling is a hard step with hysteresis. It switches
 * off when the camera rises above H - 0.35 and back on when it falls below H - 0.55; in between it
 * keeps `wasOn`, so it never flickers at the threshold. Returns 1 (on) or 0 (off).
 */
export function ceilingReducedStep(
  cameraY: number,
  wasOn: boolean,
  ceilingY: number = CEILING_HEIGHT,
): 0 | 1 {
  if (cameraY > ceilingY - CEILING_FADE.reducedOffBelow) return 0;
  if (cameraY < ceilingY - CEILING_FADE.reducedOnBelow) return 1;
  return wasOn ? 1 : 0;
}

/** The highest the camera may be (metres). */
export function maxCameraHeight(ceilingY: number = CEILING_HEIGHT): number {
  return ceilingY + CEILING_FADE.maxAboveCeiling;
}

/**
 * The longest boom that keeps the camera at or under `maxY`, for a pivot height and a pitch
 * (radians, camera elevation). It never drops below the normal minimum boom, and it does not
 * change the pitch or the user's zoom setting: lowering the pitch gives the zoom back.
 */
export function boomLimitForHeight(
  pivotY: number,
  pitch: number,
  maxY: number = maxCameraHeight(),
): number {
  const s = Math.sin(pitch);
  if (s <= 1e-4) return Number.POSITIVE_INFINITY;
  return Math.max(CAMERA_LIMITS.boomMin, (maxY - pivotY) / s);
}
