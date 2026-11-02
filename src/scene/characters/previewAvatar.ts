import { avatarFaceShape, avatarGender, avatarOutfitPattern, type AvatarConfig } from '@contract';
import type { Mesh, Object3D } from 'three';
import type { CharacterRole } from '@/domain/characters/characterState';
import type { AvatarRig } from './avatarRig';
import { createAvatarRig } from './kit/rig';

/**
 * The builder preview's avatar: one rig per character for the life of the preview, kept in step
 * with the whole config (including `gender`, `faceShape` and `outfitPattern`) through
 * `setAppearance`. A gender change, a face shape change or both run one 250 ms morph (design spec
 * 9.5 and 12.8.2 D); a pattern change fades the pattern in over 150 ms (12.8.2 E). Reduced motion
 * shows each change at once. The visit never uses this: it builds the final shape once with
 * `buildAvatar` from the whole config.
 */
export interface PreviewAvatarRig extends AvatarRig {
  /** Apply a new config. A gender or face shape change starts a morph unless `reduced` is true. */
  update(config: AvatarConfig, reduced: boolean): void;
  /** The pattern strength now (0 to 1), for tests and the QA hook. */
  readonly patternMix: number;
  /** True while a morph is running. */
  readonly morphing: boolean;
  /** Advance the morph and the pattern fade by dt seconds. Call before `applyPose`. No cost while idle. */
  stepMorph(dt: number): void;
}

/** `--duration-fast` (design spec 12.8.2 E): the outfit pattern fades in over this. Mirror of tokens.css. */
export const PATTERN_FADE_SECONDS = 0.15;

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
  let patternElapsed = PATTERN_FADE_SECONDS;
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
    get patternMix() {
      return rig.patternMix;
    },
    get morphing() {
      return rig.morphing;
    },
    applyPose: (pose) => rig.applyPose(pose),
    setOpacity: (opacity) => rig.setOpacity(opacity),
    dispose: () => rig.dispose(),
    update(next, reduced) {
      const toGender = avatarGender(next);
      const toFace = avatarFaceShape(next);
      const genderChanged = toGender !== avatarGender(rig.config);
      const faceChanged = toFace !== avatarFaceShape(rig.config);
      const patternChanged = avatarOutfitPattern(next) !== avatarOutfitPattern(rig.config);
      if (!reduced && (genderChanged || faceChanged)) {
        // Order matters: begin (records the shape on screen now), then setAppearance. One morph
        // blends both, so a change of gender and face shape together share one run.
        if (genderChanged) rig.beginGenderMorph(toGender);
        if (faceChanged) rig.beginFaceShapeMorph(toFace);
        elapsed = 0;
      }
      withoutParent(rig.root, () => rig.setAppearance(next));
      if (patternChanged && !reduced) {
        rig.patternMix = 0;
        patternElapsed = 0;
      } else {
        rig.patternMix = 1;
        patternElapsed = PATTERN_FADE_SECONDS;
      }
    },
    stepMorph(dt) {
      if (patternElapsed < PATTERN_FADE_SECONDS) {
        patternElapsed += dt;
        rig.patternMix = Math.min(1, patternElapsed / PATTERN_FADE_SECONDS);
      }
      if (!rig.morphing) return;
      elapsed += dt;
      withoutParent(rig.root, () => rig.setMorphProgress(elapsed / GENDER_MORPH_SECONDS));
    },
  };
}
