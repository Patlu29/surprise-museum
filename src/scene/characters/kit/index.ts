/**
 * Avatar kit (owner: technical-artist, ADR 0008). Stylised "designer toy" characters built from
 * code primitives, no downloaded art. Usage and the animation contract are in
 * docs/handoffs/technical-artist.md.
 */
export type { AvatarConfig } from '@contract';
export {
  AVATAR_FIXED,
  BADGE_RING_BRASS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_BLUSH,
  SKIN_TONES,
  type HairColorId,
  type OutfitColorId,
  type SkinToneId,
} from './palette';
export {
  BODY_TYPE_LABELS,
  DEFAULT_GUIDE_APPEARANCE,
  DEFAULT_VISITOR_APPEARANCE,
  FACIAL_HAIR_LABELS,
  HAIR_COLOR_LABELS,
  HAIR_STYLE_LABELS,
  HEIGHT_LABELS,
  OUTFIT_COLOR_LABELS,
  OUTFIT_STYLE_LABELS,
  SKIN_LABELS,
  describeAvatar,
} from './options';
export {
  BASE,
  BODY_SHAPES,
  HEAD,
  HEIGHT_SCALE,
  NOMINAL_HEIGHT,
  type BodyShape,
} from './proportions';
export { NEUTRAL_POSE, type AvatarPose, type PoseBones } from './pose';
export {
  createAvatarRig,
  type AvatarRig,
  type AvatarRigOptions,
  type AvatarRigStats,
  type AvatarRole,
} from './rig';
export { useAvatarRig } from './useAvatarRig';
