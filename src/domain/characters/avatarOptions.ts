/**
 * Pure helpers over the avatar option ids: labels, defaults and the accessible description.
 * No three.js and no React. Lives in `src/domain/characters/` so the UI can import it (the UI may
 * not import `@/scene`); the avatar kit re-exports it, so there is one source of truth.
 *
 * Labels are from docs/design-spec.md, section 9.2. Ids come from the contract.
 */
import {
  avatarFaceShape,
  avatarGender,
  avatarOutfitPattern,
  type AvatarConfig,
  type AvatarFaceShape,
  type AvatarGender,
  type AvatarOutfitPattern,
} from '@contract';

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
  // v0.5 (FR-97, ADR 0021). Labels from design spec v2.0 (9.2, 12.8.2 G): they name the garment,
  // never the wearer (FR-99).
  sweater: 'Sweater',
  overalls: 'Overalls',
  coat: 'Coat',
  tracksuit: 'Tracksuit',
  cardigan: 'Cardigan',
  tunic: 'Tunic',
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
  // Design spec 9.2 (v1.1): ids unchanged; the text says where the shape is wider, so it can sit
  // under any gender.
  curvy: 'Wider hips',
  broad: 'Wider shoulders',
};

/** Design spec 9.2: display order is Woman, Man, Neutral. Ids are in the contract (ADR 0020). */
export const GENDER_LABELS: Readonly<Record<AvatarGender, string>> = {
  feminine: 'Woman',
  masculine: 'Man',
  neutral: 'Neutral',
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

/**
 * Face shape (FR-96, ADR 0021, design spec 9.2), in display order. Optional in the contract: a
 * missing or unknown value reads as Oval through `avatarFaceShape`. Labels name the shape, never
 * a person (FR-99).
 */
export const FACE_SHAPE_LABELS: Readonly<Record<AvatarFaceShape, string>> = {
  oval: 'Oval',
  round: 'Round',
  square: 'Square',
  heart: 'Heart',
  long: 'Long',
};

/**
 * Clothing pattern (FR-98, ADR 0021, design spec 9.2), in display order. Drawn in tints of the
 * outfit colour (Q-31). Optional in the contract: missing or unknown reads as Plain through
 * `avatarOutfitPattern`.
 */
export const OUTFIT_PATTERN_LABELS: Readonly<Record<AvatarOutfitPattern, string>> = {
  plain: 'Plain',
  stripes: 'Stripes',
  checks: 'Checks',
  dots: 'Dots',
};

/** Design spec 9.3. Defaults avoid assuming anyone's gender and keep the pair visibly different. */
export const DEFAULT_GUIDE_APPEARANCE: AvatarConfig = {
  v: 1,
  gender: 'neutral',
  // ADR 0021: today's head and flat outfit colour. Builder writes them explicitly.
  faceShape: 'oval',
  outfitPattern: 'plain',
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
  gender: 'neutral',
  // ADR 0021: today's head and flat outfit colour. Builder writes them explicitly.
  faceShape: 'oval',
  outfitPattern: 'plain',
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
  bob: (c) => `bob ${c} hair`,
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
  // Design spec v2.0, 12.8.2 G "Description words".
  sweater: (c) => `${c} sweater and trousers`,
  overalls: (c) => `${c} overalls and cream tee`,
  coat: (c) => `${c} coat`,
  tracksuit: (c) => `${c} tracksuit`,
  cardigan: (c) => `${c} cardigan`,
  tunic: (c) => `${c} tunic and trousers`,
};

/** Design spec 9.4: "slim build", "regular build", "wider hips", "wider shoulders". */
const BODY_PHRASE: Record<AvatarConfig['bodyType'], string> = {
  slim: 'slim build',
  regular: 'regular build',
  curvy: 'wider hips',
  broad: 'wider shoulders',
};

/**
 * Design spec 9.4 (v2.0): the pattern word sits between the colour and the garment, only when the
 * pattern is not Plain ("navy striped shirt and trousers", "coral spotted jumpsuit").
 */
const PATTERN_PHRASE: Record<AvatarOutfitPattern, string> = {
  plain: '',
  stripes: 'striped',
  checks: 'checked',
  dots: 'spotted',
};

/** The gender word appears only in the description of a non-Neutral choice (A-20). */
const GENDER_PHRASE: Record<Exclude<AvatarGender, 'neutral'>, string> = {
  feminine: 'woman',
  masculine: 'man',
};

/**
 * The live description for the customiser preview (design spec 9.4), for example
 * "Tom: man, medium height, regular build, square face, short crop dark brown hair, goatee,
 * navy striped shirt and trousers."
 * Face shape and pattern add words only when they are not the default (Oval, Plain), so a
 * character with today's look, or one saved before ADR 0021, reads exactly as before. Both are
 * read through the contract accessors, so a missing or unknown value reads as the default.
 * Pass an empty name to omit the prefix.
 */
export function describeAvatar(config: AvatarConfig, name = ''): string {
  const height = { short: 'shorter', medium: 'medium', tall: 'taller' }[config.height];
  const gender = avatarGender(config);
  const faceShape = avatarFaceShape(config);
  const pattern = PATTERN_PHRASE[avatarOutfitPattern(config)];
  const parts = [
    ...(gender === 'neutral' ? [] : [GENDER_PHRASE[gender]]),
    `${height} height`,
    BODY_PHRASE[config.bodyType],
    // Design spec 9.4 (v2.0): "{face shape} face" after the build, only when not Oval.
    ...(faceShape === 'oval' ? [] : [`${lower(FACE_SHAPE_LABELS[faceShape])} face`]),
    HAIR_PHRASE[config.hairStyle](lower(HAIR_COLOR_LABELS[config.hairColor])),
  ];
  // Template order (design spec 9.4): hair, then facial hair, then the outfit.
  if (config.facialHair !== 'none') parts.push(lower(FACIAL_HAIR_LABELS[config.facialHair]));
  const colour = lower(OUTFIT_COLOR_LABELS[config.outfitColor]);
  parts.push(OUTFIT_PHRASE[config.outfitStyle](pattern ? `${colour} ${pattern}` : colour));
  const body = parts.join(', ');
  return name ? `${name}: ${body}.` : `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}
