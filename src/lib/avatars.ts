import type { AvatarConfig, AvatarGender } from '@contract';
import { AVATAR_GENDERS, AVATAR_OPTIONS, avatarGender } from '@contract';
import {
  BODY_TYPE_LABELS,
  FACIAL_HAIR_LABELS,
  GENDER_LABELS,
  HAIR_COLOR_LABELS,
  HAIR_STYLE_LABELS,
  HEIGHT_LABELS,
  OUTFIT_COLOR_LABELS,
  OUTFIT_STYLE_LABELS,
  SKIN_LABELS,
} from '@/domain/characters/avatarOptions';

/**
 * The builder's view of the avatar options. The labels, defaults and the accessible description
 * live in `src/domain/characters/avatarOptions.ts`, the single source of truth shared with the
 * scene's avatar kit; this file only re-exports them under the builder's names and adds the few
 * helpers that are about the builder's controls.
 */
export {
  describeAvatar,
  DEFAULT_GUIDE_APPEARANCE as DEFAULT_GUIDE_AVATAR,
  DEFAULT_VISITOR_APPEARANCE as DEFAULT_VISITOR_AVATAR,
} from '@/domain/characters/avatarOptions';

/** The role a character plays. The Guide resembles the Creator; the Visitor resembles the recipient. */
export type AvatarRole = 'guide' | 'visitor';

/**
 * The options the builder lets the Creator change (accessories are Release 2).
 * `gender` is one of them, but it is optional in the contract and its ids live in
 * `AVATAR_GENDERS`, not `AVATAR_OPTIONS` (ADR 0020).
 */
export type AvatarOptionKey = Exclude<keyof AvatarConfig, 'v' | 'glasses' | 'hat'>;

/** Display text and accessible names (design spec 9.2), keyed by option. */
export const AVATAR_LABELS = {
  gender: GENDER_LABELS,
  skinTone: SKIN_LABELS,
  hairStyle: HAIR_STYLE_LABELS,
  hairColor: HAIR_COLOR_LABELS,
  outfitStyle: OUTFIT_STYLE_LABELS,
  outfitColor: OUTFIT_COLOR_LABELS,
  bodyType: BODY_TYPE_LABELS,
  height: HEIGHT_LABELS,
  facialHair: FACIAL_HAIR_LABELS,
} as const satisfies { [K in AvatarOptionKey]: Readonly<Record<string, string>> };

/** Option ids offered by the builder for each option, in display order. */
export function optionIds<K extends AvatarOptionKey>(key: K): ReadonlyArray<AvatarConfig[K]> {
  if (key === 'gender') return AVATAR_GENDERS as unknown as ReadonlyArray<AvatarConfig[K]>;
  return (AVATAR_OPTIONS as Record<string, ReadonlyArray<unknown>>)[
    key
  ] as unknown as ReadonlyArray<AvatarConfig[K]>;
}

export function avatarOptionLabel<K extends AvatarOptionKey>(key: K, id: AvatarConfig[K]): string {
  const table = AVATAR_LABELS[key] as Readonly<Record<string, string>>;
  return table[id as string] ?? String(id);
}

/** The Gender choice shown for a character: a missing or unknown value reads as Neutral. */
export function selectedGender(config: AvatarConfig): AvatarGender {
  return avatarGender(config);
}

/**
 * Two avatars are equal when every option matches. A missing `gender` equals `'neutral'` and
 * differs from `'feminine'` (ADR 0020: read it through `avatarGender`, never directly).
 */
export function avatarsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  if (avatarGender(a) !== avatarGender(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof AvatarConfig>;
  keys.delete('gender');
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
