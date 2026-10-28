import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, LIMITS, type AvatarConfig, type MuseumDocument } from '@contract';
import { lqipDataUrl } from '../../../supabase/functions/_shared/testing/jpegFixtures';
import {
  codePointLength,
  isUuid,
  parseGetMuseumRequest,
  parseManageRequest,
  proportionsMatch,
  validateAvatar,
  validateDimension,
  validateDocument,
  validateLqip,
  validateText,
} from '../../../supabase/functions/_shared/validate';

const EDIT = 'A'.repeat(43);
const PHOTO_A = '11111111-1111-4111-8111-111111111111';
const PHOTO_B = '22222222-2222-4222-8222-222222222222';

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    v: 1,
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

function doc(overrides: Record<string, unknown> = {}): unknown {
  return {
    title: 'For Sam',
    visitorName: 'Sam',
    guideName: 'Alex',
    openingGreeting: '',
    closingMessage: 'Love you',
    theme: 'default',
    visitorAvatar: avatar(),
    guideAvatar: avatar({ facialHair: 'full-beard' }),
    photos: [{ photoId: PHOTO_A, caption: 'Day one' }],
    ...overrides,
  };
}

const failure = (result: { ok: boolean; field?: string }) => (result.ok ? null : result.field);

describe('validateText', () => {
  const rules = { field: 'f', label: 'Text', min: 1, max: 5, multiline: false };

  it('trims and counts code points, not UTF-16 units', () => {
    expect(validateText('  abc  ', rules)).toEqual({ ok: true, value: 'abc' });
    expect(validateText('😀😀😀😀😀', rules).ok).toBe(true); // 5 code points, 10 units
    expect(validateText('😀😀😀😀😀😀', rules).ok).toBe(false);
    expect(codePointLength('a😀é')).toBe(3);
  });

  it('keeps accents and emoji exactly as typed', () => {
    expect(validateText('Zoë❤️', { ...rules, max: 24 })).toEqual({ ok: true, value: 'Zoë❤️' });
  });

  it('enforces required and maximum length with messages that do not echo input', () => {
    const empty = validateText('   ', rules);
    expect(empty).toEqual({ ok: false, field: 'f', message: 'Text is required.' });
    const long = validateText('secretsecret', rules);
    expect(long.ok).toBe(false);
    expect(JSON.stringify(long)).not.toContain('secretsecret');
    expect(validateText('', { ...rules, min: 0 }).ok).toBe(true);
    expect(validateText(42, rules).ok).toBe(false);
    expect(validateText(undefined, rules).ok).toBe(false);
  });

  it('rejects control characters, bidi overrides, lone surrogates and NUL', () => {
    for (const bad of ['a\u0000b', 'a\u0007b', 'a‮b', 'a b', 'a\u0085b', 'a\ud800b', 'a\udc00b']) {
      expect(validateText(bad, { ...rules, max: 99 }).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('only allows line breaks where the field is multiline, and normalises them', () => {
    expect(validateText('a\nb', { ...rules, max: 9 }).ok).toBe(false);
    expect(validateText('a\tb', { ...rules, max: 9 }).ok).toBe(false);
    expect(validateText('a\r\nb\rc', { ...rules, max: 9, multiline: true })).toEqual({
      ok: true,
      value: 'a\nb\nc',
    });
    expect(validateText('a\n\n\n\n\n\nb', { ...rules, max: 20, multiline: true })).toEqual({
      ok: true,
      value: 'a\n\n\nb',
    });
  });
});

describe('validateAvatar', () => {
  it('accepts every option listed in the contract', () => {
    for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof typeof AVATAR_OPTIONS>) {
      for (const option of AVATAR_OPTIONS[key]) {
        const role = key === 'facialHair' ? 'guide' : 'visitor';
        expect(validateAvatar(avatar({ [key]: option }), 'a', role).ok, `${key}=${option}`).toBe(
          true,
        );
      }
    }
  });

  it('rejects unknown options, unknown keys, missing keys, a wrong version and non-objects', () => {
    expect(failure(validateAvatar(avatar({ hairStyle: 'mohawk' as never }), 'a', 'guide'))).toBe(
      'a.hairStyle',
    );
    expect(failure(validateAvatar({ ...avatar(), cape: 'red' }, 'a', 'guide'))).toBe('a.cape');
    const { hat: _hat, ...missing } = avatar();
    expect(failure(validateAvatar(missing, 'a', 'guide'))).toBe('a.hat');
    expect(failure(validateAvatar({ ...avatar(), v: 2 }, 'a', 'guide'))).toBe('a.v');
    expect(validateAvatar(null, 'a', 'guide').ok).toBe(false);
    expect(validateAvatar([], 'a', 'guide').ok).toBe(false);
    expect(failure(validateAvatar(avatar({ skinTone: 7 as never }), 'a', 'guide'))).toBe(
      'a.skinTone',
    );
  });

  it('allows facial hair for the Guide only (FR-14)', () => {
    expect(validateAvatar(avatar({ facialHair: 'goatee' }), 'a', 'guide').ok).toBe(true);
    expect(failure(validateAvatar(avatar({ facialHair: 'goatee' }), 'a', 'visitor'))).toBe(
      'a.facialHair',
    );
  });

  it('copies only known keys, so prototype pollution payloads do nothing', () => {
    const polluted = JSON.parse('{"__proto__":{"admin":true}}') as Record<string, unknown>;
    const result = validateAvatar({ ...avatar(), ...polluted }, 'a', 'guide');
    expect(result.ok).toBe(false);
  });
});

describe('validateDocument', () => {
  it('accepts a full document and normalises text', () => {
    const result = validateDocument(
      doc({
        visitorName: '  Sam  ',
        closingMessage: 'a\r\nb',
        photos: [{ photoId: PHOTO_A.toUpperCase(), caption: ' hi ' }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.visitorName).toBe('Sam');
      expect(result.value.closingMessage).toBe('a\nb');
      expect(result.value.photos).toEqual([{ photoId: PHOTO_A, caption: 'hi' }]);
    }
  });

  it('allows an empty title, greeting, closing message and caption', () => {
    const result = validateDocument(
      doc({
        title: '',
        openingGreeting: '',
        closingMessage: '',
        photos: [{ photoId: PHOTO_A, caption: '' }],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('applies the documented limits at their boundaries', () => {
    const at = (field: string, length: number) =>
      validateDocument(doc({ [field]: 'x'.repeat(length) })).ok;
    expect(at('title', LIMITS.titleMaxChars)).toBe(true);
    expect(at('title', LIMITS.titleMaxChars + 1)).toBe(false);
    expect(at('visitorName', LIMITS.nameMaxChars)).toBe(true);
    expect(at('visitorName', LIMITS.nameMaxChars + 1)).toBe(false);
    expect(at('guideName', LIMITS.nameMaxChars + 1)).toBe(false);
    expect(at('openingGreeting', LIMITS.greetingMaxChars)).toBe(true);
    expect(at('openingGreeting', LIMITS.greetingMaxChars + 1)).toBe(false);
    expect(at('closingMessage', LIMITS.closingMessageMaxChars)).toBe(true);
    expect(at('closingMessage', LIMITS.closingMessageMaxChars + 1)).toBe(false);
    const caption = (n: number) =>
      validateDocument(doc({ photos: [{ photoId: PHOTO_A, caption: 'x'.repeat(n) }] })).ok;
    expect(caption(LIMITS.captionMaxChars)).toBe(true);
    expect(caption(LIMITS.captionMaxChars + 1)).toBe(false);
  });

  it('requires names, reports the failing field as a JSON path', () => {
    expect(failure(validateDocument(doc({ visitorName: '' })))).toBe('document.visitorName');
    expect(failure(validateDocument(doc({ guideName: undefined })))).toBe('document.guideName');
    expect(failure(validateDocument(doc({ theme: 'neon' })))).toBe('document.theme');
    expect(failure(validateDocument(doc({ guideAvatar: avatar({ hat: 'crown' as never }) })))).toBe(
      'document.guideAvatar.hat',
    );
    expect(
      failure(validateDocument(doc({ visitorAvatar: avatar({ facialHair: 'stubble' }) }))),
    ).toBe('document.visitorAvatar.facialHair');
  });

  it('requires 1 to 20 unique, well-formed photos', () => {
    const photos = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        photoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        caption: '',
      }));
    expect(validateDocument(doc({ photos: photos(1) })).ok).toBe(true);
    expect(validateDocument(doc({ photos: photos(20) })).ok).toBe(true);
    expect(failure(validateDocument(doc({ photos: photos(21) })))).toBe('document.photos');
    expect(failure(validateDocument(doc({ photos: [] })))).toBe('document.photos');
    expect(failure(validateDocument(doc({ photos: 'nope' })))).toBe('document.photos');
    expect(failure(validateDocument(doc({ photos: [{ photoId: 'x', caption: '' }] })))).toBe(
      'document.photos[0].photoId',
    );
    expect(
      failure(
        validateDocument(
          doc({
            photos: [
              { photoId: PHOTO_A, caption: '' },
              { photoId: PHOTO_A.toUpperCase(), caption: '' },
            ],
          }),
        ),
      ),
    ).toBe('document.photos[1].photoId');
    expect(
      failure(validateDocument(doc({ photos: [{ photoId: PHOTO_A, caption: '', url: 'x' }] }))),
    ).toBe('document.photos[0].url');
    expect(failure(validateDocument(doc({ photos: [null] })))).toBe('document.photos[0]');
  });

  it('rejects unknown top-level fields and non-objects', () => {
    expect(failure(validateDocument(doc({ editToken: 'x' })))).toBe('document.editToken');
    expect(validateDocument(null).ok).toBe(false);
    expect(validateDocument('x').ok).toBe(false);
    expect(validateDocument([]).ok).toBe(false);
  });

  it('never echoes submitted values in messages', () => {
    const result = validateDocument(doc({ visitorName: 'N'.repeat(40) }));
    expect(JSON.stringify(result)).not.toContain('NNNN');
  });
});

describe('validateLqip and validateDimension', () => {
  it('accepts a JPEG data URL within the length limit', () => {
    expect(validateLqip(lqipDataUrl()).ok).toBe(true);
  });

  it('rejects the wrong type, bad base64, oversize and non-strings', () => {
    expect(validateLqip('data:image/png;base64,AAAA').ok).toBe(false);
    expect(validateLqip('data:image/jpeg;base64,').ok).toBe(false);
    expect(validateLqip('data:image/jpeg;base64,AAA').ok).toBe(false);
    expect(validateLqip('data:image/jpeg;base64,AA AA').ok).toBe(false);
    expect(validateLqip('data:image/jpeg;base64,' + 'A'.repeat(LIMITS.maxLqipChars)).ok).toBe(
      false,
    );
    expect(validateLqip('javascript:alert(1)').ok).toBe(false);
    expect(validateLqip(null).ok).toBe(false);
  });

  it('accepts whole numbers from 1 to 2048 only', () => {
    expect(validateDimension(1, 'w').ok).toBe(true);
    expect(validateDimension(2048, 'w').ok).toBe(true);
    for (const bad of [0, -1, 2049, 1.5, NaN, Infinity, '100', null])
      expect(validateDimension(bad, 'w').ok).toBe(false);
  });
});

describe('parseManageRequest', () => {
  it('treats a missing or malformed edit token as a bad link, before looking at anything else', () => {
    for (const body of [
      { action: 'get' },
      { action: 'nope', editToken: 'short' },
      { editToken: 42 },
      { action: 'get', editToken: 'a'.repeat(44) },
      { action: 'get', editToken: '!'.repeat(43) },
    ]) {
      expect(parseManageRequest(body)).toEqual({ ok: false, kind: 'bad_token' });
    }
    expect(parseManageRequest(null).ok).toBe(false);
    expect(parseManageRequest([]).ok).toBe(false);
  });

  it('parses every action', () => {
    expect(parseManageRequest({ action: 'get', editToken: EDIT })).toEqual({
      ok: true,
      value: { action: 'get', editToken: EDIT },
    });
    expect(parseManageRequest({ action: 'reserve-photo', editToken: EDIT }).ok).toBe(true);
    expect(parseManageRequest({ action: 'delete', editToken: EDIT }).ok).toBe(true);
    expect(
      parseManageRequest({
        action: 'renew-upload',
        editToken: EDIT,
        photoId: PHOTO_A.toUpperCase(),
      }),
    ).toEqual({
      ok: true,
      value: { action: 'renew-upload', editToken: EDIT, photoId: PHOTO_A },
    });
    expect(
      parseManageRequest({ action: 'remove-photo', editToken: EDIT, photoId: PHOTO_B }).ok,
    ).toBe(true);
    const confirm = parseManageRequest({
      action: 'confirm-photo',
      editToken: EDIT,
      photoId: PHOTO_A,
      width: 10,
      height: 8,
      lqip: lqipDataUrl(),
    });
    expect(confirm.ok).toBe(true);
    const publish = parseManageRequest({ action: 'publish', editToken: EDIT, document: doc() });
    expect(
      publish.ok && publish.value.action === 'publish' && publish.value.document.visitorName,
    ).toBe('Sam');
  });

  it('rejects unknown actions, extra fields, and bad fields with the field name', () => {
    const invalid = (body: unknown) => {
      const r = parseManageRequest(body);
      return !r.ok && r.kind === 'invalid' ? r.field : null;
    };
    expect(invalid({ action: 'explode', editToken: EDIT })).toBe('action');
    expect(invalid({ editToken: EDIT })).toBe('action');
    expect(invalid({ action: 'get', editToken: EDIT, admin: true })).toBe('admin');
    expect(invalid({ action: 'delete', editToken: EDIT, photoId: PHOTO_A })).toBe('photoId');
    expect(invalid({ action: 'renew-upload', editToken: EDIT })).toBe('photoId');
    expect(invalid({ action: 'remove-photo', editToken: EDIT, photoId: '../../etc' })).toBe(
      'photoId',
    );
    expect(
      invalid({
        action: 'confirm-photo',
        editToken: EDIT,
        photoId: PHOTO_A,
        width: 0,
        height: 8,
        lqip: lqipDataUrl(),
      }),
    ).toBe('width');
    expect(
      invalid({
        action: 'confirm-photo',
        editToken: EDIT,
        photoId: PHOTO_A,
        width: 8,
        height: 9999,
        lqip: lqipDataUrl(),
      }),
    ).toBe('height');
    expect(
      invalid({
        action: 'confirm-photo',
        editToken: EDIT,
        photoId: PHOTO_A,
        width: 8,
        height: 8,
        lqip: 'nope',
      }),
    ).toBe('lqip');
    expect(invalid({ action: 'publish', editToken: EDIT })).toBe('document');
    expect(
      invalid({ action: 'publish', editToken: EDIT, document: doc({ visitorName: '' }) }),
    ).toBe('document.visitorName');
  });
});

describe('other helpers', () => {
  it('parseGetMuseumRequest requires a string token and nothing else', () => {
    expect(parseGetMuseumRequest({ shareToken: 'abc' })).toEqual({
      ok: true,
      value: { shareToken: 'abc' },
    });
    expect(parseGetMuseumRequest({}).ok).toBe(false);
    expect(parseGetMuseumRequest({ shareToken: 1 }).ok).toBe(false);
    expect(parseGetMuseumRequest({ shareToken: 'a', extra: 1 }).ok).toBe(false);
    expect(parseGetMuseumRequest(null).ok).toBe(false);
  });

  it('isUuid accepts only canonical UUIDs', () => {
    expect(isUuid(PHOTO_A)).toBe(true);
    expect(isUuid(PHOTO_A.toUpperCase())).toBe(true);
    for (const bad of ['', 'x', PHOTO_A + 'a', `${PHOTO_A}/../x`, 42, null, undefined])
      expect(isUuid(bad)).toBe(false);
  });

  it('proportionsMatch allows rounding and rejects a different picture', () => {
    expect(proportionsMatch({ width: 2048, height: 1536 }, { width: 1024, height: 768 })).toBe(
      true,
    );
    expect(proportionsMatch({ width: 2047, height: 1535 }, { width: 1024, height: 768 })).toBe(
      true,
    );
    expect(proportionsMatch({ width: 1000, height: 1000 }, { width: 1000, height: 1000 })).toBe(
      true,
    );
    expect(proportionsMatch({ width: 2048, height: 1536 }, { width: 768, height: 1024 })).toBe(
      false,
    );
    expect(proportionsMatch({ width: 2048, height: 1536 }, { width: 1024, height: 512 })).toBe(
      false,
    );
  });

  it('exports a document type usable by callers', () => {
    const typed: MuseumDocument | null = null;
    expect(typed).toBeNull();
  });
});
