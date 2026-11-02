/**
 * ADR 0021: optional `faceShape` and `outfitPattern` on AvatarConfig, following the ADR 0020
 * pattern (optional, read through an accessor, missing means today's look, no version bump).
 */
import { describe, expect, it } from 'vitest';
import {
  AVATAR_FACE_SHAPES,
  AVATAR_OPTIONAL_DEFAULTS,
  AVATAR_OPTIONAL_OPTIONS,
  AVATAR_OPTIONS,
  AVATAR_OUTFIT_PATTERNS,
  CONTRACT_VERSION,
  DEFAULT_AVATAR_FACE_SHAPE,
  DEFAULT_AVATAR_OUTFIT_PATTERN,
  avatarFaceShape,
  avatarOutfitPattern,
  isAvatarFaceShape,
  isAvatarOptionalValue,
  isAvatarOutfitPattern,
  withAvatarDefaults,
  type AvatarConfig,
} from '@contract';
import { validateAvatar, validateDocument } from '../../../supabase/functions/_shared/validate';
import {
  DEFAULT_GUIDE_AVATAR,
  DEFAULT_VISITOR_AVATAR,
  avatarsEqual,
  describeAvatar,
  optionIds,
} from '@/lib/avatars';
import { OUTFIT_STYLE_LABELS } from '@/domain/characters/avatarOptions';

const BAD_VALUES = [null, '', 'Oval', 'OVAL', 'triangle', 'striped', 1, true, {}, []];

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    v: 1,
    gender: 'neutral',
    faceShape: 'oval',
    outfitPattern: 'plain',
    skinTone: 'skin-03',
    hairStyle: 'bob',
    hairColor: 'brown',
    outfitStyle: 'hoodie',
    outfitColor: 'teal',
    bodyType: 'regular',
    height: 'medium',
    facialHair: 'none',
    glasses: 'none',
    hat: 'none',
    ...overrides,
  };
}

/** An avatar as stored before v0.5: no faceShape and no outfitPattern. */
function legacy(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  const { faceShape: _f, outfitPattern: _p, ...rest } = avatar(overrides);
  return rest;
}

describe('contract: face shape and outfit pattern ids (ADR 0021)', () => {
  it('lists the ids in display order, with the default first', () => {
    expect(AVATAR_FACE_SHAPES).toEqual(['oval', 'round', 'square', 'heart', 'long']);
    expect(AVATAR_OUTFIT_PATTERNS).toEqual(['plain', 'stripes', 'checks', 'dots']);
    expect(DEFAULT_AVATAR_FACE_SHAPE).toBe('oval');
    expect(DEFAULT_AVATAR_OUTFIT_PATTERN).toBe('plain');
  });

  it('keeps the optional keys out of AVATAR_OPTIONS, whose keys are all required', () => {
    expect(Object.keys(AVATAR_OPTIONS)).not.toContain('faceShape');
    expect(Object.keys(AVATAR_OPTIONS)).not.toContain('outfitPattern');
    expect(Object.keys(AVATAR_OPTIONAL_OPTIONS)).toEqual(['gender', 'faceShape', 'outfitPattern']);
    expect(AVATAR_OPTIONAL_DEFAULTS).toEqual({
      gender: 'neutral',
      faceShape: 'oval',
      outfitPattern: 'plain',
    });
  });

  it('keeps the six v1.0 outfit styles first and unchanged, and appends six (Q-30)', () => {
    expect(AVATAR_OPTIONS.outfitStyle.slice(0, 6)).toEqual([
      'tee-jeans',
      'hoodie',
      'shirt-trousers',
      'dress',
      'suit',
      'jumpsuit',
    ]);
    expect(AVATAR_OPTIONS.outfitStyle.slice(6)).toEqual([
      'sweater',
      'overalls',
      'coat',
      'tracksuit',
      'cardigan',
      'tunic',
    ]);
    expect(new Set(AVATAR_OPTIONS.outfitStyle).size).toBe(12);
  });

  it('needs no contract version bump', () => {
    expect(CONTRACT_VERSION).toBe(1);
  });
});

describe('contract: accessors and guards', () => {
  it('accepts every listed id', () => {
    for (const id of AVATAR_FACE_SHAPES) {
      expect(isAvatarFaceShape(id)).toBe(true);
      expect(isAvatarOptionalValue('faceShape', id)).toBe(true);
      expect(avatarFaceShape({ faceShape: id })).toBe(id);
    }
    for (const id of AVATAR_OUTFIT_PATTERNS) {
      expect(isAvatarOutfitPattern(id)).toBe(true);
      expect(isAvatarOptionalValue('outfitPattern', id)).toBe(true);
      expect(avatarOutfitPattern({ outfitPattern: id })).toBe(id);
    }
  });

  it('reads missing values as today’s look', () => {
    expect(avatarFaceShape({})).toBe('oval');
    expect(avatarOutfitPattern({})).toBe('plain');
    expect(avatarFaceShape(legacy())).toBe('oval');
    expect(avatarOutfitPattern(legacy())).toBe('plain');
  });

  it.each(BAD_VALUES)('maps %j to the default on read, and the guard rejects it', (bad) => {
    expect(isAvatarFaceShape(bad)).toBe(false);
    expect(isAvatarOutfitPattern(bad)).toBe(false);
    expect(avatarFaceShape({ faceShape: bad })).toBe('oval');
    expect(avatarOutfitPattern({ outfitPattern: bad })).toBe('plain');
  });

  it('does not accept one field’s ids for the other', () => {
    expect(isAvatarFaceShape('stripes')).toBe(false);
    expect(isAvatarOutfitPattern('round')).toBe(false);
    expect(isAvatarOptionalValue('gender', 'oval')).toBe(false);
  });

  it('withAvatarDefaults fills every optional key and keeps everything else', () => {
    const { gender: _g, ...noGender } = legacy({ hairStyle: 'afro' });
    const filled = withAvatarDefaults(noGender);
    expect(filled).toEqual({
      ...noGender,
      gender: 'neutral',
      faceShape: 'oval',
      outfitPattern: 'plain',
    });
    const chosen = avatar({ gender: 'feminine', faceShape: 'heart', outfitPattern: 'dots' });
    expect(withAvatarDefaults(chosen)).toEqual(chosen);
    // An unrecognised stored value is never passed on.
    const odd = { ...legacy(), faceShape: 'triangle' } as unknown as AvatarConfig;
    expect(withAvatarDefaults(odd).faceShape).toBe('oval');
    // The input is not modified.
    expect('faceShape' in noGender).toBe(false);
  });
});

describe('validateAvatar: face shape and outfit pattern', () => {
  it('accepts every id and keeps the value', () => {
    for (const faceShape of AVATAR_FACE_SHAPES) {
      for (const outfitPattern of AVATAR_OUTFIT_PATTERNS) {
        const input = avatar({ faceShape, outfitPattern, outfitStyle: 'dress' });
        const result = validateAvatar(input, 'a');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(input);
      }
    }
  });

  it('accepts a pre-v0.5 avatar and writes the defaults explicitly', () => {
    const result = validateAvatar(legacy(), 'a');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(avatar());
      expect(result.value.faceShape).toBe('oval');
      expect(result.value.outfitPattern).toBe('plain');
    }
    const explicitUndefined = validateAvatar(
      { ...legacy(), faceShape: undefined, outfitPattern: undefined },
      'a',
    );
    expect(explicitUndefined.ok && explicitUndefined.value.faceShape).toBe('oval');
  });

  it('accepts a pre-v0.3 avatar (no optional keys at all)', () => {
    const { gender: _g, ...oldest } = legacy();
    const result = validateAvatar(oldest, 'a');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(avatar());
  });

  it.each(BAD_VALUES)('rejects faceShape %j without echoing it', (bad) => {
    const result = validateAvatar({ ...avatar(), faceShape: bad }, 'a');
    expect(result).toEqual({
      ok: false,
      field: 'a.faceShape',
      message: 'Choose one of the available options.',
    });
  });

  it.each(BAD_VALUES)('rejects outfitPattern %j without echoing it', (bad) => {
    const result = validateAvatar({ ...avatar(), outfitPattern: bad }, 'a');
    expect(result).toEqual({
      ok: false,
      field: 'a.outfitPattern',
      message: 'Choose one of the available options.',
    });
  });

  it('still rejects keys that are not in the contract', () => {
    for (const key of ['outfit', 'face', 'pattern', 'outfitPatternColor']) {
      const result = validateAvatar({ ...avatar(), [key]: 'x' }, 'a');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.field).toBe(`a.${key}`);
    }
  });

  it('reports the document path for each character', () => {
    const doc = {
      title: '',
      visitorName: 'Sam',
      guideName: 'Alex',
      openingGreeting: '',
      closingMessage: '',
      theme: 'default',
      visitorAvatar: avatar(),
      guideAvatar: avatar(),
      photos: [{ photoId: '11111111-1111-4111-8111-111111111111', caption: '' }],
    };
    const visitor = validateDocument({
      ...doc,
      visitorAvatar: { ...avatar(), outfitPattern: 'tartan' },
    });
    expect(visitor.ok === false && visitor.field).toBe('document.visitorAvatar.outfitPattern');
    const guide = validateDocument({ ...doc, guideAvatar: { ...avatar(), faceShape: 'diamond' } });
    expect(guide.ok === false && guide.field).toBe('document.guideAvatar.faceShape');
  });
});

describe('outfit styles added in v0.5 (FR-97, Q-30)', () => {
  it('the validator accepts every style, old and new, with every pattern', () => {
    for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
      for (const outfitPattern of AVATAR_OUTFIT_PATTERNS) {
        const result = validateAvatar(avatar({ outfitStyle, outfitPattern }), 'a');
        expect(result.ok, `${outfitStyle}/${outfitPattern}`).toBe(true);
      }
    }
    const bad = validateAvatar({ ...avatar(), outfitStyle: 'kilt' }, 'a');
    expect(bad.ok === false && bad.field).toBe('a.outfitStyle');
  });

  it('every style has a label and a description phrase that never names a wearer', () => {
    for (const id of AVATAR_OPTIONS.outfitStyle) {
      const label = OUTFIT_STYLE_LABELS[id];
      expect(label, id).toBeTruthy();
      expect(label).not.toMatch(/\b(wo)?m[ae]n'?s?\b|\bladies\b|\bgirls?\b|\bboys?\b/i);
      expect(describeAvatar(avatar({ outfitStyle: id }))).toContain('teal');
    }
  });

  it('uses the design spec v2.0 labels and description words (12.8.2 G)', () => {
    const fresh = AVATAR_OPTIONS.outfitStyle.slice(6);
    expect(fresh.map((id) => OUTFIT_STYLE_LABELS[id])).toEqual([
      'Sweater',
      'Overalls',
      'Coat',
      'Tracksuit',
      'Cardigan',
      'Tunic',
    ]);
    expect(
      fresh.map((id) =>
        describeAvatar(avatar({ outfitStyle: id }))
          .split(', ')
          .pop(),
      ),
    ).toEqual([
      'teal sweater and trousers.',
      'teal overalls and cream tee.',
      'teal coat.',
      'teal tracksuit.',
      'teal cardigan.',
      'teal tunic and trousers.',
    ]);
  });

  it('the builder offers all twelve styles now that the kit builds them (02/11/2026)', () => {
    // The gate (OUTFIT_STYLES_PENDING_KIT) is empty: the technical-artist built the six garments.
    expect(optionIds('outfitStyle')).toEqual([...AVATAR_OPTIONS.outfitStyle]);
    expect(optionIds('outfitStyle')).toHaveLength(12);
  });
});

describe('builder defaults and equality', () => {
  it('both default appearances carry today’s look explicitly', () => {
    for (const d of [DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR]) {
      expect(d.faceShape).toBe('oval');
      expect(d.outfitPattern).toBe('plain');
    }
  });

  it('treats a missing optional key as equal to its default only', () => {
    const { faceShape: _f, outfitPattern: _p, ...old } = DEFAULT_GUIDE_AVATAR;
    expect(avatarsEqual(old, DEFAULT_GUIDE_AVATAR)).toBe(true);
    expect(avatarsEqual(old, { ...DEFAULT_GUIDE_AVATAR, faceShape: 'round' })).toBe(false);
    expect(avatarsEqual(old, { ...DEFAULT_GUIDE_AVATAR, outfitPattern: 'checks' })).toBe(false);
    expect(
      avatarsEqual(
        { ...DEFAULT_GUIDE_AVATAR, outfitPattern: 'dots' },
        { ...DEFAULT_GUIDE_AVATAR, outfitPattern: 'dots' },
      ),
    ).toBe(true);
  });
});
