import type { AvatarConfig, AvatarGender, AvatarOptionalKey } from '@contract';
import {
  AVATAR_OPTIONAL_DEFAULTS,
  AVATAR_OPTIONAL_OPTIONS,
  AVATAR_OPTIONS,
  avatarGender,
  isAvatarOptionalValue,
} from '@contract';
import {
  BODY_TYPE_LABELS,
  FACE_SHAPE_LABELS,
  FACIAL_HAIR_LABELS,
  GENDER_LABELS,
  HAIR_COLOR_LABELS,
  HAIR_STYLE_LABELS,
  HEIGHT_LABELS,
  OUTFIT_COLOR_LABELS,
  OUTFIT_PATTERN_LABELS,
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
  FACE_SHAPE_LABELS,
  OUTFIT_PATTERN_LABELS,
} from '@/domain/characters/avatarOptions';

/** The role a character plays. The Guide resembles the Creator; the Visitor resembles the recipient. */
export type AvatarRole = 'guide' | 'visitor';

/**
 * The options the builder lets the Creator change (accessories are Release 2).
 * `gender` (ADR 0020), `faceShape` and `outfitPattern` (ADR 0021) are among them, but they are
 * optional in the contract and their ids live in `AVATAR_OPTIONAL_OPTIONS`, not `AVATAR_OPTIONS`.
 * So `AvatarConfig[K]` includes `undefined` for those three keys: read the shown value with
 * `selectedOptionValue`, never `config[key]` directly.
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
  faceShape: FACE_SHAPE_LABELS,
  outfitPattern: OUTFIT_PATTERN_LABELS,
} as const satisfies { [K in AvatarOptionKey]: Readonly<Record<string, string>> };

/**
 * Outfit styles that are valid in the contract (ADR 0021) but not yet built by the avatar kit,
 * which renders them as the jumpsuit until their garments land. The builder does not offer them
 * until then. Empty since 02/11/2026: the technical-artist built all six (sweater, overalls, coat,
 * tracksuit, cardigan, tunic). Stored and restored values were always accepted: this only hides tiles.
 */
const OUTFIT_STYLES_PENDING_KIT: ReadonlySet<string> = new Set<string>();

function isOptionalKey(key: string): key is AvatarOptionalKey {
  return Object.prototype.hasOwnProperty.call(AVATAR_OPTIONAL_OPTIONS, key);
}

/**
 * Option ids offered by the builder for each option, in display order. The optional keys
 * (`gender`, `faceShape`, `outfitPattern`) come from `AVATAR_OPTIONAL_OPTIONS`, the rest from
 * `AVATAR_OPTIONS`. The result never contains `undefined`.
 */
export function optionIds<K extends AvatarOptionKey>(
  key: K,
): ReadonlyArray<NonNullable<AvatarConfig[K]>> {
  type Ids = ReadonlyArray<NonNullable<AvatarConfig[K]>>;
  if (isOptionalKey(key)) return AVATAR_OPTIONAL_OPTIONS[key] as unknown as Ids;
  if (key === 'outfitStyle') {
    return AVATAR_OPTIONS.outfitStyle.filter(
      (id) => !OUTFIT_STYLES_PENDING_KIT.has(id),
    ) as unknown as Ids;
  }
  return (AVATAR_OPTIONS as Record<string, ReadonlyArray<unknown>>)[key] as unknown as Ids;
}

export function avatarOptionLabel<K extends AvatarOptionKey>(
  key: K,
  id: NonNullable<AvatarConfig[K]>,
): string {
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

/**
 * The selected id shown in the builder for any option. For the optional keys (`gender`,
 * `faceShape`, `outfitPattern`) a missing or unknown value reads as its default (Neutral, Oval,
 * Plain), as ADR 0020 and ADR 0021 require; the required keys are returned as stored.
 */
export function selectedOptionValue<K extends AvatarOptionKey>(
  config: AvatarConfig,
  key: K,
): NonNullable<AvatarConfig[K]> {
  if (isOptionalKey(key)) return optionalValue(config, key) as NonNullable<AvatarConfig[K]>;
  return config[key] as NonNullable<AvatarConfig[K]>;
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
