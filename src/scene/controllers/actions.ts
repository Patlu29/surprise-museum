import type { Vec2 } from '@/domain/math/vec2';
import { clearScreenRects } from '@/state/screenRects';
import type { JumpTarget } from '@/state/sessionStore';
import type { FollowCameraRig } from '../cameras/FollowCameraRig';
import type { SceneRuntime } from '../runtime/SceneRuntime';

/**
 * Scene-side actions behind the UI's command counters (replay, jump to a picture). They are cuts:
 * the UI's fade-through veil hides them (design spec 5.12, 6.9). Each one clears the presentation
 * state, puts the Guide beside the Visitor, and snaps the camera behind her. Reduced motion needs
 * no special case: a cut is already the reduced-motion behaviour.
 */
export function replay(runtime: SceneRuntime, rig: FollowCameraRig): void {
  const { layout, visitor, guide, director } = runtime;
  const v = layout.spawn.visitor;
  const g = layout.spawn.guide;
  runtime.autopilot.target = null;
  director.reset();
  runtime.finaleSignal.reset();
  visitor.teleport({ x: v.position.x, y: 0, z: v.position.z }, v.heading);
  guide.teleport({ x: g.position.x, y: 0, z: g.position.z }, g.heading);
  rig.snapBehind(v.heading);
  clearScreenRects();
}

/** Stand the Visitor in front of a picture (or on the podium); the presentation then starts as usual. */
export function jumpTo(runtime: SceneRuntime, rig: FollowCameraRig, target: JumpTarget): boolean {
  const { layout, visitor, guide, director } = runtime;
  let position: Vec2;
  let heading: number;
  if (target.kind === 'photo') {
    const slot = layout.slots.find((s) => s.photoId === target.photoId);
    if (!slot) return false;
    position = slot.standingSpot;
    // Face the picture: straight into the wall, along the reversed normal.
    heading = Math.atan2(-slot.normal.x, -slot.normal.z);
  } else {
    position = { x: layout.finale.center.x, z: layout.finale.center.z + 0.8 };
    heading = Math.PI;
  }
  runtime.autopilot.target = null;
  director.reset();
  runtime.finaleSignal.reset();
  visitor.teleport({ x: position.x, y: 0, z: position.z }, heading);
  rig.snapBehind(heading);
  guide.placeBesideVisitor(position, { x: rig.pose.position.x, z: rig.pose.position.z });
  clearScreenRects();
  return true;
}
