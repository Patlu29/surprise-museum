import { describe, expect, it } from 'vitest';
import {
  BODY_TYPE_LABELS,
  DEFAULT_GUIDE_APPEARANCE,
  DEFAULT_VISITOR_APPEARANCE,
  GENDER_LABELS,
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
    expect(neutral).toBe(
      'Sam: medium height, regular build, bob brown hair, coral jumpsuit.',
    );
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
