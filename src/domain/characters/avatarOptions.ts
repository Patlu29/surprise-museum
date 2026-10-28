/**
 * Pure helpers over the avatar option ids: labels, defaults and the accessible description.
 * No three.js and no React. Lives in `src/domain/characters/` so the UI can import it (the UI may
 * not import `@/scene`); the avatar kit re-exports it, so there is one source of truth.
 *
 * Labels are from docs/design-spec.md, section 9.2. Ids come from the contract.
 */
import type { AvatarConfig } from '@contract';

export const SKIN_LABELS: Readonly<Record<AvatarConfig['skinTone'], string>> = {
  'skin-01': 'Very light',
  'skin-02': 'Light',
  'skin-03': 'Light medium',
  'skin-04': 'Medium',
  'skin-05': 'Medium tan',
  'skin-06': 'Tan',
  'skin-07': 'Medium brown',
  'skin-08': 'Brown',
  'skin-09': 'Deep brown',
  'skin-10': 'Very deep',
};

export const HAIR_STYLE_LABELS: Readonly<Record<AvatarConfig['hairStyle'], string>> = {
  shaved: 'Shaved',
  buzz: 'Buzz cut',
  'short-crop': 'Short crop',
  'side-part': 'Side part',
  'curly-short': 'Short curls',
  bob: 'Bob',
  'long-straight': 'Long straight',
  'long-wavy': 'Long wavy',
  ponytail: 'Ponytail',
  bun: 'Bun',
  afro: 'Afro',
  braids: 'Braids',
};

export const HAIR_COLOR_LABELS: Readonly<Record<AvatarConfig['hairColor'], string>> = {
  black: 'Black',
  'dark-brown': 'Dark brown',
  brown: 'Brown',
  auburn: 'Auburn',
  ginger: 'Ginger',
  blonde: 'Blonde',
  platinum: 'Platinum',
  grey: 'Grey',
  white: 'White',
  pink: 'Pink',
  blue: 'Blue',
};

export const OUTFIT_STYLE_LABELS: Readonly<Record<AvatarConfig['outfitStyle'], string>> = {
  'tee-jeans': 'T-shirt and jeans',
  hoodie: 'Hoodie',
  'shirt-trousers': 'Shirt and trousers',
  dress: 'Dress',
  suit: 'Suit',
  jumpsuit: 'Jumpsuit',
};

export const OUTFIT_COLOR_LABELS: Readonly<Record<AvatarConfig['outfitColor'], string>> = {
  red: 'Red',
  coral: 'Coral',
  orange: 'Orange',
  mustard: 'Mustard',
  green: 'Green',
  teal: 'Teal',
  sky: 'Sky blue',
  navy: 'Navy',
  purple: 'Purple',
  pink: 'Pink',
  charcoal: 'Charcoal',
  cream: 'Cream',
};

export const BODY_TYPE_LABELS: Readonly<Record<AvatarConfig['bodyType'], string>> = {
  slim: 'Slim',
  regular: 'Regular',
  curvy: 'Curvy',
  broad: 'Broad',
};

export const HEIGHT_LABELS: Readonly<Record<AvatarConfig['height'], string>> = {
  short: 'Shorter (about 1.55 m)',
  medium: 'Medium (about 1.70 m)',
  tall: 'Taller (about 1.85 m)',
};

export const FACIAL_HAIR_LABELS: Readonly<Record<AvatarConfig['facialHair'], string>> = {
  none: 'None',
  stubble: 'Stubble',
  moustache: 'Moustache',
  goatee: 'Goatee',
  'full-beard': 'Full beard',
};

/** Design spec 9.3. Defaults avoid assuming anyone's gender and keep the pair visibly different. */
export const DEFAULT_GUIDE_APPEARANCE: AvatarConfig = {
  v: 1,
  skinTone: 'skin-04',
  hairStyle: 'short-crop',
  hairColor: 'dark-brown',
  outfitStyle: 'shirt-trousers',
  outfitColor: 'navy',
  bodyType: 'regular',
  height: 'medium',
  facialHair: 'none',
  glasses: 'none',
  hat: 'none',
};

export const DEFAULT_VISITOR_APPEARANCE: AvatarConfig = {
  v: 1,
  skinTone: 'skin-04',
  hairStyle: 'bob',
  hairColor: 'brown',
  outfitStyle: 'jumpsuit',
  outfitColor: 'coral',
  bodyType: 'regular',
  height: 'medium',
  facialHair: 'none',
  glasses: 'none',
  hat: 'none',
};

const lower = (s: string) => s.toLowerCase();

const HAIR_PHRASE: Record<AvatarConfig['hairStyle'], (colour: string) => string> = {
  shaved: () => 'a shaved head',
  buzz: (c) => `${c} buzz cut hair`,
  'short-crop': (c) => `short crop ${c} hair`,
  'side-part': (c) => `side-parted ${c} hair`,
  'curly-short': (c) => `short curly ${c} hair`,
  bob: (c) => `${c} bob hair`,
  'long-straight': (c) => `long straight ${c} hair`,
  'long-wavy': (c) => `long wavy ${c} hair`,
  ponytail: (c) => `${c} hair in a ponytail`,
  bun: (c) => `${c} hair in a bun`,
  afro: (c) => `${c} afro hair`,
  braids: (c) => `${c} braids`,
};

const OUTFIT_PHRASE: Record<AvatarConfig['outfitStyle'], (colour: string) => string> = {
  'tee-jeans': (c) => `${c} T-shirt and jeans`,
  hoodie: (c) => `${c} hoodie`,
  'shirt-trousers': (c) => `${c} shirt and trousers`,
  dress: (c) => `${c} dress`,
  suit: (c) => `${c} suit`,
  jumpsuit: (c) => `${c} jumpsuit`,
};

/**
 * The live description for the customiser preview (design spec 9.4), for example
 * "Tom: medium height, regular build, short crop dark brown hair, navy shirt and trousers."
 * Pass an empty name to omit the prefix.
 */
export function describeAvatar(config: AvatarConfig, name = ''): string {
  const height = { short: 'shorter', medium: 'medium', tall: 'taller' }[config.height];
  const parts = [
    `${height} height`,
    `${lower(BODY_TYPE_LABELS[config.bodyType])} build`,
    HAIR_PHRASE[config.hairStyle](lower(HAIR_COLOR_LABELS[config.hairColor])),
    OUTFIT_PHRASE[config.outfitStyle](lower(OUTFIT_COLOR_LABELS[config.outfitColor])),
  ];
  if (config.facialHair !== 'none') parts.push(lower(FACIAL_HAIR_LABELS[config.facialHair]));
  const body = parts.join(', ');
  return name ? `${name}: ${body}.` : `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}
