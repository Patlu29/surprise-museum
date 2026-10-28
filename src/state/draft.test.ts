import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR } from '@/lib/avatars';
import type { DraftFields, DraftPhoto } from './draft';
import {
  buildMuseumDocument,
  buildPreviewContent,
  createInitialFields,
  effectiveTitle,
  hasDraftContent,
  publishablePhotos,
  summarisePhotos,
  usablePhotos,
  validateDraft,
} from './draft';
import { createDraftPhoto } from './builderStore';

function photo(id: string, overrides: Partial<DraftPhoto> = {}): DraftPhoto {
  return {
    ...createDraftPhoto(id, `${id}.jpg`),
    photoId: `server-${id}`,
    status: 'ready',
    processed: true,
    width: 2048,
    height: 1536,
    lqip: 'data:image/jpeg;base64,AA==',
    wallUrl: `blob:wall-${id}`,
    fullUrl: `blob:full-${id}`,
    progress: 1,
    ...overrides,
  };
}

function fields(overrides: Partial<DraftFields> = {}): DraftFields {
  return { ...createInitialFields(), visitorName: 'Sophie', guideName: 'Tom', ...overrides };
}

const ok = (f: DraftFields, photos: DraftPhoto[], consent = true) => ({
  fields: f,
  photos,
  consent,
});

describe('validateDraft', () => {
  it('passes a complete draft in both modes', () => {
    expect(validateDraft(ok(fields(), [photo('a')]), 'preview')).toEqual([]);
    expect(validateDraft(ok(fields(), [photo('a')]), 'publish')).toEqual([]);
  });

  it('asks for a photo and both names, pointing at the right step', () => {
    const issues = validateDraft(ok(createInitialFields(), []), 'preview');
    expect(issues.map((issue) => [issue.id, issue.step])).toEqual([
      ['photos', 1],
      ['visitor-name', 2],
      ['guide-name', 2],
    ]);
  });

  it('treats a name of only spaces as missing', () => {
    const issues = validateDraft(ok(fields({ visitorName: '   ' }), [photo('a')]), 'preview');
    expect(issues.map((issue) => issue.id)).toEqual(['visitor-name']);
  });

  it('counts an emoji name as one character', () => {
    expect(
      validateDraft(ok(fields({ guideName: '😀'.repeat(24) }), [photo('a')]), 'preview'),
    ).toEqual([]);
  });

  it('needs the consent to publish, but not to preview (FR-56)', () => {
    expect(validateDraft(ok(fields(), [photo('a')], false), 'preview')).toEqual([]);
    expect(validateDraft(ok(fields(), [photo('a')], false), 'publish').map((i) => i.id)).toEqual([
      'consent',
    ]);
  });

  it('blocks publishing while photos are uploading or failed, but not preview', () => {
    const uploading = photo('b', { status: 'uploading', photoId: null });
    expect(validateDraft(ok(fields(), [photo('a'), uploading]), 'preview')).toEqual([]);
    expect(
      validateDraft(ok(fields(), [photo('a'), uploading]), 'publish').map((i) => i.id),
    ).toEqual(['photos-uploading']);
    const failed = photo('c', { status: 'failed', photoId: null });
    expect(validateDraft(ok(fields(), [photo('a'), failed]), 'publish').map((i) => i.id)).toEqual([
      'photos-failed',
    ]);
  });

  it('does not count a photo that never processed', () => {
    const broken = photo('a', { processed: false, status: 'failed' });
    expect(validateDraft(ok(fields(), [broken]), 'preview').map((i) => i.id)).toEqual(['photos']);
  });
});

describe('effectiveTitle', () => {
  it('uses the title, or "A museum for {name}" when blank (FR-7)', () => {
    expect(effectiveTitle('  Our year  ', 'Sophie')).toBe('Our year');
    expect(effectiveTitle('', 'Sophie')).toBe('A museum for Sophie');
    expect(effectiveTitle(' ', ' Zoë 😀 ')).toBe('A museum for Zoë 😀');
  });
});

describe('buildMuseumDocument', () => {
  it('sends ready photos in order with their captions, and clean text', () => {
    const photos = [
      photo('a', { caption: 'First\r\nline  ' }),
      photo('b', { status: 'uploading', photoId: null }),
      photo('c', { caption: '' }),
    ];
    const document = buildMuseumDocument(
      fields({ title: '  Our\nyear ', closingMessage: 'Love\r\nyou\u0007' }),
      photos,
    );
    expect(document.photos).toEqual([
      { photoId: 'server-a', caption: 'First\nline' },
      { photoId: 'server-c', caption: '' },
    ]);
    expect(document.title).toBe('Our year');
    expect(document.closingMessage).toBe('Love\nyou');
    expect(document.theme).toBe('default');
  });

  it('never gives the Visitor facial hair (v1)', () => {
    const document = buildMuseumDocument(
      fields({ visitorAvatar: { ...DEFAULT_VISITOR_AVATAR, facialHair: 'goatee' } }),
      [photo('a')],
    );
    expect(document.visitorAvatar.facialHair).toBe('none');
    expect(document.guideAvatar).toEqual(DEFAULT_GUIDE_AVATAR);
  });
});

describe('buildPreviewContent', () => {
  it('builds the same shape a published museum has, from local blobs', () => {
    const content = buildPreviewContent(fields(), [
      photo('a', { caption: 'Hi' }),
      photo('b', { photoId: null }),
    ]);
    expect(content.photos.map((p) => [p.id, p.position, p.wallUrl])).toEqual([
      ['server-a', 0, 'blob:wall-a'],
      ['b', 1, 'blob:wall-b'],
    ]);
    expect(content.photos[0]?.width).toBe(2048);
    expect(content.guideName).toBe('Tom');
  });

  it('leaves out photos that have no processed blobs', () => {
    const content = buildPreviewContent(fields(), [photo('a'), photo('x', { processed: false })]);
    expect(content.photos).toHaveLength(1);
  });
});

describe('draft helpers', () => {
  it('detects a draft worth protecting', () => {
    expect(hasDraftContent(createInitialFields(), [])).toBe(false);
    expect(hasDraftContent(fields({ visitorName: 'S' }), [])).toBe(true);
    expect(hasDraftContent(createInitialFields(), [photo('a')])).toBe(true);
    expect(
      hasDraftContent(
        { ...createInitialFields(), guideAvatar: { ...DEFAULT_GUIDE_AVATAR, hairStyle: 'afro' } },
        [],
      ),
    ).toBe(true);
  });

  it('filters and counts photos', () => {
    const photos = [
      photo('a'),
      photo('b', { status: 'uploading' }),
      photo('c', { status: 'failed', processed: false }),
    ];
    expect(usablePhotos(photos)).toHaveLength(2);
    expect(publishablePhotos(photos)).toHaveLength(1);
    expect(summarisePhotos(photos)).toEqual({ total: 3, ready: 1, busy: 1, failed: 1 });
  });
});
