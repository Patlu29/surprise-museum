import { avatarGender, type AvatarConfig } from '@contract';
import type { Mesh, Object3D } from 'three';
import type { CharacterRole } from '@/domain/characters/characterState';
import type { AvatarRig } from './avatarRig';
import { createAvatarRig } from './kit/rig';

/**
 * The builder preview's avatar: one rig per character for the life of the preview, kept in step
 * with the config through `setAppearance`, with the 250 ms gender morph (design spec 9.5). The
 * visit never uses this: it builds the final shape once with `buildAvatar`.
 */
export interface PreviewAvatarRig extends AvatarRig {
  /** Apply a new config. A gender change starts a morph unless `reduced` is true. */
  update(config: AvatarConfig, reduced: boolean): void;
  /** Advance the morph by dt seconds. Call before `applyPose`. No cost while idle. */
  stepMorph(dt: number): void;
}

/** `--duration-gender-morph` (design spec 9.5); tokens.css is 250 ms. Mirror, change together. */
export const GENDER_MORPH_SECONDS = 0.25;

/**
 * Run a rig rebuild with the rig root detached from its parent.
 *
 * Root cause of BUG-6: the kit's `refreshBones` calls `skeleton.calculateInverses()` from the
 * bones' WORLD matrices, which include every parent's transform (the plinth offset, the three-
 * quarter turn, the pair's yaw). The skinned meshes were bound while the rig had no parent, so
 * their bind matrix is parent-free; after a bind-pose rebuild (gender or body type) the inverses
 * carry the parent's transform and the body is drawn displaced by it (to the middle of the
 * preview, from the plinth's x). Hair, skin and height do not rebuild the bind pose, so they were
 * fine, and a rig built fresh in place is bound consistently. Fix in the kit (technical-artist):
 * compute the inverses with the rig root's parent matrix treated as identity. Until then this
 * wrapper does exactly that from the outside.
 */
function withoutParent(root: Object3D, fn: () => void): void {
  const parent = root.parent;
  root.parent = null;
  try {
    fn();
  } finally {
    root.parent = parent;
  }
}

const noRaycast = () => {
  /* characters are never pickable */
};

export function buildPreviewAvatar(config: AvatarConfig, role: CharacterRole): PreviewAvatarRig {
  const rig = createAvatarRig(config, { role, blobShadow: true });
  rig.root.traverse((o) => {
    if ((o as Mesh).isMesh) (o as Mesh).raycast = noRaycast;
  });
  let elapsed = 0;
  return {
    root: rig.root,
    get height() {
      return rig.height;
    },
    get labelHeight() {
      return rig.labelAnchor.position.y * rig.root.scale.x;
    },
    get scale() {
      return rig.root.scale.x;
    },
    applyPose: (pose) => rig.applyPose(pose),
    setOpacity: (opacity) => rig.setOpacity(opacity),
    dispose: () => rig.dispose(),
    update(next, reduced) {
      const to = avatarGender(next);
      if (!reduced && to !== avatarGender(rig.config)) {
        // Order matters: begin (records the shape on screen now), then setAppearance.
        rig.beginGenderMorph(to);
        elapsed = 0;
      }
      withoutParent(rig.root, () => rig.setAppearance(next));
    },
    stepMorph(dt) {
      if (!rig.morphing) return;
      elapsed += dt;
      withoutParent(rig.root, () => rig.setGenderMorphProgress(elapsed / GENDER_MORPH_SECONDS));
    },
  };
}
