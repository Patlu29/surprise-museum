import type { MuseumLayout } from '@/domain/layout/types';
import { dist2, forwardOf, type Vec2 } from '@/domain/math/vec2';
import type { NavGraph } from '@/domain/navigation/navGraph';

export interface HintResult {
  target: { kind: 'photo'; photoId: string } | { kind: 'finale' };
  bearingDeg: number;
  distanceM: number;
}

/**
 * "Where next?" (FR-32, Should): the nearest picture not yet viewed by walking distance, or the
 * finale once every picture has been viewed. Bearing is relative to the camera's heading:
 * 0 is straight ahead (up the screen), 90 is to the right.
 */
export function computeHint(
  layout: MuseumLayout,
  nav: NavGraph,
  from: Vec2,
  viewed: ReadonlySet<string>,
  cameraYaw: number,
): HintResult {
  let target: HintResult['target'] = { kind: 'finale' };
  let point: Vec2 = layout.finale.center;
  let best = Infinity;
  for (const slot of layout.slots) {
    if (viewed.has(slot.photoId)) continue;
    const d = nav.pathLength(from, slot.standingSpot);
    if (d < best) {
      best = d;
      target = { kind: 'photo', photoId: slot.photoId };
      point = { x: slot.position.x, z: slot.position.z };
    }
  }
  const dx = point.x - from.x;
  const dz = point.z - from.z;
  const fwd = forwardOf(cameraYaw);
  const right = { x: -fwd.z, z: fwd.x };
  const bearing =
    (Math.atan2(dx * right.x + dz * right.z, dx * fwd.x + dz * fwd.z) * 180) / Math.PI;
  return { target, bearingDeg: (bearing + 360) % 360, distanceM: dist2(from, point) };
}
