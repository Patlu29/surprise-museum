import type { AvatarConfig } from '@contract';
import { AVATAR_OPTIONS } from '@contract';
import {
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
} from '@/domain/characters/avatarOptions';

/**
 * The builder's view of the avatar options. The labels, defaults and the accessible description
 * live in `src/domain/characters/avatarOptions.ts`, the single source of truth shared with the
 * scene's avatar kit; this file only re-exports them under the builder's names and adds the few
 * helpers that are about the builder's controls.
 */
export { describeAvatar } from '@/domain/characters/avatarOptions';

/** The role a character plays. The Guide resembles the Creator; the Visitor resembles the recipient. */
export type AvatarRole = 'guide' | 'visitor';

/** The options the builder lets the Creator change (accessories are Release 2). */
export type AvatarOptionKey = Exclude<keyof AvatarConfig, 'v' | 'glasses' | 'hat'>;

/** Defaults for a new draft (design spec 9.3). */
export const DEFAULT_GUIDE_AVATAR: AvatarConfig = DEFAULT_GUIDE_APPEARANCE;
export const DEFAULT_VISITOR_AVATAR: AvatarConfig = DEFAULT_VISITOR_APPEARANCE;

/** Display text and accessible names (design spec 9.2), keyed by option. */
export const AVATAR_LABELS = {
  skinTone: SKIN_LABELS,
  hairStyle: HAIR_STYLE_LABELS,
  hairColor: HAIR_COLOR_LABELS,
  outfitStyle: OUTFIT_STYLE_LABELS,
  outfitColor: OUTFIT_COLOR_LABELS,
  bodyType: BODY_TYPE_LABELS,
  height: HEIGHT_LABELS,
  facialHair: FACIAL_HAIR_LABELS,
} as const satisfies { [K in AvatarOptionKey]: Readonly<Record<string, string>> };

/** Option ids offered by the builder for each option, in contract order. */
export function optionIds<K extends AvatarOptionKey>(key: K): ReadonlyArray<AvatarConfig[K]> {
  return AVATAR_OPTIONS[key] as unknown as ReadonlyArray<AvatarConfig[K]>;
}

export function avatarOptionLabel<K extends AvatarOptionKey>(key: K, id: AvatarConfig[K]): string {
  const table = AVATAR_LABELS[key] as Readonly<Record<string, string>>;
  return table[id as string] ?? String(id);
}

export function avatarsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  return (Object.keys(a) as Array<keyof AvatarConfig>).every((key) => a[key] === b[key]);
}
