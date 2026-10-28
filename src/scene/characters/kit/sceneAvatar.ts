/**
 * Adapter from the kit's skinned rig to the scene's `AvatarRig` shape
 * (src/scene/characters/avatarRig.ts, wired through src/scene/seams.ts).
 *
 * The scene supplies timing (walk phase, blend, present level) and the rig turns it into bone
 * rotations with `applyPose`. Left and right are anatomical (the character's left is +X, its
 * right is -X), so the presenting arm is the character's right arm, as in architecture 6.7.
 * Characters are never pickable (raycast is switched off), so clicks reach the picture behind.
 */
import type { Mesh } from 'three';
import type { AvatarConfig } from '@contract';
import type { AvatarBuilder, AvatarRig as SceneAvatarRig } from '../avatarRig';
import { createAvatarRig } from './rig';

const noRaycast = () => {
  /* characters are never pickable, so clicks reach the picture behind them */
};

export const buildAvatar: AvatarBuilder = (config: AvatarConfig, role): SceneAvatarRig => {
  const rig = createAvatarRig(config, { role, blobShadow: true });
  rig.root.traverse((o) => {
    if ((o as Mesh).isMesh) (o as Mesh).raycast = noRaycast;
  });
  const scale = rig.root.scale.x;
  return {
    root: rig.root,
    height: rig.height,
    // The anchor sits 0.35 m above the head in unscaled rig space; the root scale applies on top.
    labelHeight: rig.labelAnchor.position.y * scale,
    scale,
    applyPose: (pose) => rig.applyPose(pose),
    setOpacity: (opacity) => rig.setOpacity(opacity),
    dispose: () => rig.dispose(),
  };
};
