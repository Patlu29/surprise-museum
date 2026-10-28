/**
 * Avatar palette: a typed mirror of the `--avatar-*` design tokens.
 *
 * Source of truth: src/styles/tokens.css (owner: ux-ui-designer) and docs/design-spec.md,
 * Appendix A (section 9.2). Option ids are the stable storage keys from
 * supabase/functions/_shared/contract.ts (AVATAR_OPTIONS). `palette.test.ts` parses tokens.css
 * and fails if a value drifts or an option id has no colour.
 */
import type { AvatarConfig } from '@contract';

export type SkinToneId = AvatarConfig['skinTone'];
export type HairColorId = AvatarConfig['hairColor'];
export type OutfitColorId = AvatarConfig['outfitColor'];

export const SKIN_TONES: Readonly<Record<SkinToneId, string>> = {
  'skin-01': '#fbe3d0',
  'skin-02': '#f4cfb0',
  'skin-03': '#ebb68f',
  'skin-04': '#dda073',
  'skin-05': '#c98858',
  'skin-06': '#b06f44',
  'skin-07': '#8f5733',
  'skin-08': '#70412a',
  'skin-09': '#52301f',
  'skin-10': '#3a2218',
};

export const HAIR_COLORS: Readonly<Record<HairColorId, string>> = {
  black: '#1c1618',
  'dark-brown': '#3b2820',
  brown: '#5e3e2b',
  auburn: '#8b3a22',
  ginger: '#c2652a',
  blonde: '#ddb45e',
  platinum: '#eee3c6',
  grey: '#a19da3',
  white: '#f2efea',
  pink: '#e487a9',
  blue: '#4d7bd6',
};

export const OUTFIT_COLORS: Readonly<Record<OutfitColorId, string>> = {
  red: '#c23b3b',
  coral: '#ee7b66',
  orange: '#e98a2e',
  mustard: '#d9a82b',
  green: '#4f9a5e',
  teal: '#2f8f8f',
  sky: '#6db2e0',
  navy: '#263a66',
  purple: '#7b55a6',
  pink: '#e58fb0',
  charcoal: '#3a3a44',
  cream: '#efe3cc',
};

/** Fixed secondary garment and detail colours (not customisable). */
export const AVATAR_FIXED = {
  denim: '#3e5c8a',
  trousers: '#2f2d36',
  joggers: '#4a4752',
  shoes: '#3a2a2a',
  sole: '#f4efe8',
  eye: '#2a1f26',
  badgeGuide: '#c9a15b',
  badgeVisitor: '#fbf6ee',
  badgeHeart: '#e0607e',
} as const;

/** `--avatar-skin-blush: rgba(229, 143, 176, 0.32)`: cheek discs. */
export const SKIN_BLUSH = { hex: '#e58fb0', rgb: [229, 143, 176], alpha: 0.32 } as const;

/** Brass used for the Guide badge's outer ring; `--color-brass-deep`. */
export const BADGE_RING_BRASS = '#9c7637';
