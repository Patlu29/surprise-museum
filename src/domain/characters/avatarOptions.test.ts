import { describe, expect, it } from 'vitest';
import { AVATAR_FACE_SHAPES, AVATAR_OUTFIT_PATTERNS, type AvatarConfig } from '@contract';
import {
  BODY_TYPE_LABELS,
  DEFAULT_GUIDE_APPEARANCE,
  DEFAULT_VISITOR_APPEARANCE,
  FACE_SHAPE_LABELS,
  GENDER_LABELS,
  OUTFIT_PATTERN_LABELS,
  describeAvatar,
} from './avatarOptions';

describe('gender in the avatar options (CR-1, design spec 9.4)', () => {
  it('labels the three genders in display order', () => {
    expect(Object.keys(GENDER_LABELS)).toEqual(['feminine', 'masculine', 'neutral']);
    expect(Object.values(GENDER_LABELS)).toEqual(['Woman', 'Man', 'Neutral']);
  });

  it('both default appearances are Neutral', () => {
    expect(DEFAULT_GUIDE_APPEARANCE.gender).toBe('neutral');
    expect(DEFAULT_VISITOR_APPEARANCE.gender).toBe('neutral');
  });

  it('uses the new body type labels with unchanged ids', () => {
    expect(BODY_TYPE_LABELS.curvy).toBe('Wider hips');
    expect(BODY_TYPE_LABELS.broad).toBe('Wider shoulders');
  });

  it('omits the gender word for Neutral and for a missing value', () => {
    const neutral = describeAvatar(DEFAULT_VISITOR_APPEARANCE, 'Sam');
    expect(neutral).toBe('Sam: medium height, regular build, bob brown hair, coral jumpsuit.');
    const { gender: _gender, ...legacy } = DEFAULT_VISITOR_APPEARANCE;
    expect(describeAvatar(legacy, 'Sam')).toBe(neutral);
  });

  it('prefixes man or woman only when chosen', () => {
    expect(
      describeAvatar(
        { ...DEFAULT_GUIDE_APPEARANCE, gender: 'masculine', facialHair: 'goatee' },
        'Tom',
      ),
    ).toBe(
      'Tom: man, medium height, regular build, short crop dark brown hair, goatee, navy shirt and trousers.',
    );
    expect(describeAvatar({ ...DEFAULT_GUIDE_APPEARANCE, gender: 'feminine' }, 'Ann')).toMatch(
      /^Ann: woman, medium height/,
    );
    expect(describeAvatar({ ...DEFAULT_GUIDE_APPEARANCE, gender: 'feminine' })).toMatch(
      /^Woman, medium height/,
    );
  });

  it('uses the body type phrases', () => {
    expect(describeAvatar({ ...DEFAULT_GUIDE_APPEARANCE, bodyType: 'curvy' })).toContain(
      'wider hips,',
    );
    expect(describeAvatar({ ...DEFAULT_GUIDE_APPEARANCE, bodyType: 'broad' })).toContain(
      'wider shoulders,',
    );
    expect(describeAvatar({ ...DEFAULT_GUIDE_APPEARANCE, bodyType: 'slim' })).toContain(
      'slim build,',
    );
  });
});

describe('face shape and pattern in the avatar options (CR-4, ADR 0021, design spec 9.2 and 9.4)', () => {
  it('labels every face shape and pattern in contract order', () => {
    expect(Object.keys(FACE_SHAPE_LABELS)).toEqual([...AVATAR_FACE_SHAPES]);
    expect(Object.values(FACE_SHAPE_LABELS)).toEqual(['Oval', 'Round', 'Square', 'Heart', 'Long']);
    expect(Object.keys(OUTFIT_PATTERN_LABELS)).toEqual([...AVATAR_OUTFIT_PATTERNS]);
    expect(Object.values(OUTFIT_PATTERN_LABELS)).toEqual(['Plain', 'Stripes', 'Checks', 'Dots']);
  });

  it('adds no words for the defaults, so existing descriptions stay exactly the same', () => {
    expect(describeAvatar(DEFAULT_GUIDE_APPEARANCE, 'Tom')).toBe(
      'Tom: medium height, regular build, short crop dark brown hair, navy shirt and trousers.',
    );
    expect(describeAvatar(DEFAULT_VISITOR_APPEARANCE, 'Sam')).toBe(
      'Sam: medium height, regular build, bob brown hair, coral jumpsuit.',
    );
    // Saved before ADR 0021: no faceShape and no outfitPattern keys at all.
    const { faceShape: _f, outfitPattern: _p, ...legacy } = DEFAULT_GUIDE_APPEARANCE;
    expect(describeAvatar(legacy, 'Tom')).toBe(describeAvatar(DEFAULT_GUIDE_APPEARANCE, 'Tom'));
  });

  it('reads an unknown stored value as the default (accessors, never the raw field)', () => {
    const odd = {
      ...DEFAULT_VISITOR_APPEARANCE,
      faceShape: 'triangle',
      outfitPattern: 'Plaid',
    } as unknown as AvatarConfig;
    expect(describeAvatar(odd, 'Sam')).toBe(describeAvatar(DEFAULT_VISITOR_APPEARANCE, 'Sam'));
  });

  it('says "{shape} face" after the build, only when the shape is not Oval', () => {
    const words: Record<string, string> = {
      round: 'round face',
      square: 'square face',
      heart: 'heart face',
      long: 'long face',
    };
    for (const [faceShape, phrase] of Object.entries(words)) {
      expect(
        describeAvatar(
          { ...DEFAULT_VISITOR_APPEARANCE, faceShape: faceShape as AvatarConfig['faceShape'] },
          'Sam',
        ),
      ).toBe(`Sam: medium height, regular build, ${phrase}, bob brown hair, coral jumpsuit.`);
    }
  });

  it('puts the pattern word between the colour and the garment, only when not Plain', () => {
    expect(describeAvatar({ ...DEFAULT_VISITOR_APPEARANCE, outfitPattern: 'stripes' })).toBe(
      'Medium height, regular build, bob brown hair, coral striped jumpsuit.',
    );
    expect(describeAvatar({ ...DEFAULT_VISITOR_APPEARANCE, outfitPattern: 'checks' })).toBe(
      'Medium height, regular build, bob brown hair, coral checked jumpsuit.',
    );
    expect(describeAvatar({ ...DEFAULT_VISITOR_APPEARANCE, outfitPattern: 'dots' })).toBe(
      'Medium height, regular build, bob brown hair, coral spotted jumpsuit.',
    );
    expect(
      describeAvatar({
        ...DEFAULT_VISITOR_APPEARANCE,
        outfitStyle: 'overalls',
        outfitPattern: 'dots',
      }),
    ).toContain('coral spotted overalls and cream tee.');
  });

  it('matches the design spec 9.4 example with gender, face shape, facial hair and pattern', () => {
    expect(
      describeAvatar(
        {
          ...DEFAULT_GUIDE_APPEARANCE,
          gender: 'masculine',
          faceShape: 'square',
          facialHair: 'goatee',
          outfitPattern: 'stripes',
        },
        'Tom',
      ),
    ).toBe(
      'Tom: man, medium height, regular build, square face, short crop dark brown hair, goatee, navy striped shirt and trousers.',
    );
  });
});
