import type { AvatarConfig, AvatarGender, AvatarOptionalKey } from '@contract';
import {
  AVATAR_GENDERS,
  AVATAR_OPTIONAL_DEFAULTS,
  AVATAR_OPTIONAL_OPTIONS,
  AVATAR_OPTIONS,
  avatarGender,
  isAvatarOptionalValue,
} from '@contract';
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
 * `faceShape` and `outfitPattern` (ADR 0021) are in the data model but have no builder control
 * yet; the frontend-developer removes them from this exclusion when adding the controls, with
 * their labels in AVATAR_LABELS and their ids in `optionIds`.
 */
export type AvatarOptionKey = Exclude<
  keyof AvatarConfig,
  'v' | 'glasses' | 'hat' | 'faceShape' | 'outfitPattern'
>;

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

/**
 * Outfit styles that are valid in the contract (ADR 0021) but not yet built by the avatar kit,
 * which renders them as the jumpsuit until their garments land. The builder does not offer them
 * until then. Empty since 02/11/2026: the technical-artist built all six (sweater, overalls, coat,
 * tracksuit, cardigan, tunic). Stored and restored values were always accepted: this only hides tiles.
 */
const OUTFIT_STYLES_PENDING_KIT: ReadonlySet<string> = new Set<string>();

/** Option ids offered by the builder for each option, in display order. */
export function optionIds<K extends AvatarOptionKey>(key: K): ReadonlyArray<AvatarConfig[K]> {
  if (key === 'gender') return AVATAR_GENDERS as unknown as ReadonlyArray<AvatarConfig[K]>;
  if (key === 'outfitStyle') {
    return AVATAR_OPTIONS.outfitStyle.filter(
      (id) => !OUTFIT_STYLES_PENDING_KIT.has(id),
    ) as unknown as ReadonlyArray<AvatarConfig[K]>;
  }
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

/** The value shown and rendered for an optional key: missing or unknown reads as the default. */
function optionalValue(config: AvatarConfig, key: AvatarOptionalKey): string {
  const value = config[key];
  return isAvatarOptionalValue(key, value) ? (value as string) : AVATAR_OPTIONAL_DEFAULTS[key];
}

const OPTIONAL_KEYS = Object.keys(AVATAR_OPTIONAL_OPTIONS) as AvatarOptionalKey[];

/**
 * Two avatars are equal when every option matches. A missing optional key equals its default
 * (`gender` 'neutral', `faceShape` 'oval', `outfitPattern` 'plain') and differs from any other
 * value (ADR 0020, ADR 0021: read them through the accessors, never directly).
 */
export function avatarsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  for (const key of OPTIONAL_KEYS) {
    if (optionalValue(a, key) !== optionalValue(b, key)) return false;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof AvatarConfig>;
  for (const key of OPTIONAL_KEYS) keys.delete(key);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
