import { describe, expect, it } from 'vitest';
import type { AvatarConfig, MuseumDocument } from '@contract';
import { ApiRequestError } from '@/lib/apiPort';
import { createMockApi, type MockMuseumApi } from '../mockClient';
import { deriveShareToken } from '../shared';
import {
  buildJpeg,
  EXIF,
  JFIF,
  lqipDataUrl,
} from '../../../supabase/functions/_shared/testing/jpegFixtures';

const avatar = (overrides: Partial<AvatarConfig> = {}): AvatarConfig => ({
  v: 1,
  skinTone: 'skin-02',
  hairStyle: 'bun',
  hairColor: 'black',
  outfitStyle: 'dress',
  outfitColor: 'coral',
  bodyType: 'curvy',
  height: 'tall',
  facialHair: 'none',
  glasses: 'none',
  hat: 'none',
  ...overrides,
});

const jpeg = (width: number, height: number, before?: number[][]) =>
  new Blob([buildJpeg({ width, height, ...(before ? { before } : {}) })], { type: 'image/jpeg' });

function documentFor(ids: string[], overrides: Partial<MuseumDocument> = {}): MuseumDocument {
  return {
    title: '',
    visitorName: 'Sam',
    guideName: 'Alex',
    openingGreeting: '',
    closingMessage: 'Happy birthday',
    theme: 'default',
    visitorAvatar: avatar(),
    guideAvatar: avatar({ facialHair: 'goatee' }),
    photos: ids.map((photoId, i) => ({ photoId, caption: `Caption ${i}` })),
    ...overrides,
  };
}

async function addPhoto(api: MockMuseumApi, editToken: string, size = { w: 2048, h: 1536 }) {
  const ticket = await api.reservePhoto(editToken);
  const progress: number[] = [];
  await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(size.w, size.h), (f) => progress.push(f));
  await api.uploadPhotoFile(
    ticket.wall.signedUrl,
    jpeg(Math.round(size.w / 2), Math.round(size.h / 2)),
    () => undefined,
  );
  await api.confirmPhoto(editToken, {
    photoId: ticket.photoId,
    width: size.w,
    height: size.h,
    lqip: lqipDataUrl(),
  });
  return { photoId: ticket.photoId, progress };
}

const code = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiRequestError);
  return (error as ApiRequestError).code;
};

describe('mock API: the whole creator and visitor journey', () => {
  it('creates, uploads, publishes, visits, edits and deletes', async () => {
    const api = createMockApi();
    const { editToken, draftExpiresAt } = await api.createMuseum();
    expect(editToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(draftExpiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    const first = await addPhoto(api, editToken);
    const second = await addPhoto(api, editToken, { w: 1200, h: 1600 });
    expect(first.progress.at(-1)).toBe(1);
    expect(first.progress).toEqual([...first.progress].sort((a, b) => a - b));

    const draft = await api.manageGet(editToken);
    expect(draft).toMatchObject({ status: 'draft', shareToken: null, document: null });
    expect(draft.photos).toHaveLength(2);

    const shareToken = await deriveShareToken(editToken);
    await expect(code(api.getMuseum(shareToken))).resolves.toBe('not_found');

    const published = await api.publish(editToken, documentFor([second.photoId, first.photoId]));
    expect(published.shareToken).toBe(shareToken);
    expect(
      new Date(published.expiresAt).getTime() - new Date(published.publishedAt).getTime(),
    ).toBe(90 * 86_400_000);

    const { museum, urlsExpireAt } = await api.getMuseum(shareToken);
    expect(museum.visitorName).toBe('Sam');
    expect(museum.guideAvatar.facialHair).toBe('goatee');
    expect(museum.photos.map((p) => [p.id, p.position, p.caption, p.width, p.height])).toEqual([
      [second.photoId, 0, 'Caption 0', 1200, 1600],
      [first.photoId, 1, 'Caption 1', 2048, 1536],
    ]);
    expect(museum.photos[0]?.wallUrl).toBeTruthy();
    expect(museum.photos[0]?.wallUrl).not.toBe(museum.photos[0]?.fullUrl);
    expect(new Date(urlsExpireAt).getTime()).toBeGreaterThan(Date.now());

    const edit = await api.manageGet(editToken);
    expect(edit.status).toBe('published');
    expect(edit.shareToken).toBe(shareToken);
    expect(edit.document?.photos.map((p) => p.photoId)).toEqual([second.photoId, first.photoId]);

    // Re-publish with one photo dropped.
    await api.publish(editToken, documentFor([first.photoId], { closingMessage: 'Edited' }));
    expect((await api.getMuseum(shareToken)).museum.photos).toHaveLength(1);
    expect((await api.getMuseum(shareToken)).museum.closingMessage).toBe('Edited');

    await expect(api.deleteMuseum(editToken)).resolves.toEqual({ deleted: true });
    await expect(code(api.getMuseum(shareToken))).resolves.toBe('not_found');
    await expect(code(api.manageGet(editToken))).resolves.toBe('not_found');
  });
});

describe('mock API follows the server rules', () => {
  it('returns one not_found for malformed, unknown, draft and deleted links', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const messages = new Set<string>();
    for (const token of ['x', 'x'.repeat(24), await deriveShareToken(editToken)]) {
      const error = await api.getMuseum(token).catch((e: unknown) => e as ApiRequestError);
      expect(error).toMatchObject({ code: 'not_found', status: 404 });
      messages.add((error as ApiRequestError).message);
    }
    for (const token of ['short', 'x'.repeat(43)]) {
      const error = await api.manageGet(token).catch((e: unknown) => e as ApiRequestError);
      expect(error).toMatchObject({ code: 'not_found', status: 404 });
      messages.add((error as ApiRequestError).message);
    }
    expect(messages.size).toBe(1);
  });

  it('expires drafts after 7 days and published museums after 90', async () => {
    let now = Date.parse('2026-10-28T00:00:00Z');
    const api = createMockApi({ now: () => now });
    const draft = await api.createMuseum();
    const live = await api.createMuseum();
    const photo = await addPhoto(api, live.editToken);
    const { shareToken } = await api.publish(live.editToken, documentFor([photo.photoId]));

    now += 8 * 86_400_000;
    await expect(code(api.manageGet(draft.editToken))).resolves.toBe('not_found');
    await expect(api.getMuseum(shareToken)).resolves.toBeTruthy();
    now += 83 * 86_400_000;
    await expect(code(api.getMuseum(shareToken))).resolves.toBe('not_found');
    await expect(code(api.manageGet(live.editToken))).resolves.toBe('not_found');
  });

  it('does not extend retention when re-publishing', async () => {
    let now = Date.parse('2026-10-28T00:00:00Z');
    const api = createMockApi({ now: () => now });
    const { editToken } = await api.createMuseum();
    const photo = await addPhoto(api, editToken);
    const first = await api.publish(editToken, documentFor([photo.photoId]));
    now += 10 * 86_400_000;
    const second = await api.publish(editToken, documentFor([photo.photoId]));
    expect(second.expiresAt).toBe(first.expiresAt);
    expect(second.publishedAt).toBe(first.publishedAt);
  });

  it('enforces 20 photos and 100 reservations', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const tickets = [];
    for (let i = 0; i < 20; i++) tickets.push(await api.reservePhoto(editToken));
    await expect(code(api.reservePhoto(editToken))).resolves.toBe('photo_limit');
    // 80 more reservations by churning one slot, then the lifetime quota applies.
    for (let i = 0; i < 80; i++) {
      await api.removePhoto(editToken, tickets[0]!.photoId);
      tickets[0] = await api.reservePhoto(editToken);
    }
    await api.removePhoto(editToken, tickets[0]!.photoId);
    await expect(code(api.reservePhoto(editToken))).resolves.toBe('upload_quota');
  });

  it('validates the document like the server', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const photo = await addPhoto(api, editToken);
    const bad = await api
      .publish(editToken, documentFor([photo.photoId], { visitorName: '' }))
      .catch((e: unknown) => e as ApiRequestError);
    expect(bad).toMatchObject({ code: 'bad_request', field: 'document.visitorName', status: 400 });
    expect(
      await api.publish(editToken, documentFor([])).catch((e: unknown) => e as ApiRequestError),
    ).toMatchObject({ code: 'bad_request', field: 'document.photos' });
    expect(
      await api
        .publish(
          editToken,
          documentFor([photo.photoId], { visitorAvatar: avatar({ facialHair: 'stubble' }) }),
        )
        .catch((e: unknown) => e as ApiRequestError),
    ).toMatchObject({
      field: 'document.visitorAvatar.facialHair',
    });
    expect((await api.manageGet(editToken)).status).toBe('draft');
  });

  it('refuses to publish a photo that is not ready or belongs to someone else', async () => {
    const api = createMockApi();
    const a = await api.createMuseum();
    const b = await api.createMuseum();
    const mine = await addPhoto(api, a.editToken);
    const theirs = await addPhoto(api, b.editToken);
    const pending = await api.reservePhoto(a.editToken);
    expect(
      await api
        .publish(a.editToken, documentFor([mine.photoId, pending.photoId]))
        .catch((e: unknown) => e as ApiRequestError),
    ).toMatchObject({ code: 'conflict', field: 'document.photos[1].photoId' });
    await expect(code(api.publish(a.editToken, documentFor([theirs.photoId])))).resolves.toBe(
      'conflict',
    );
    await expect(code(api.renewUpload(a.editToken, theirs.photoId))).resolves.toBe('not_found');
  });

  it('removes photos idempotently, but not photos in the published museum', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const one = await addPhoto(api, editToken);
    const two = await addPhoto(api, editToken);
    await expect(api.removePhoto(editToken, two.photoId)).resolves.toEqual({
      photoId: two.photoId,
      removed: true,
    });
    await expect(api.removePhoto(editToken, two.photoId)).resolves.toEqual({
      photoId: two.photoId,
      removed: true,
    });
    expect((await api.manageGet(editToken)).photos).toHaveLength(1);
    await api.publish(editToken, documentFor([one.photoId]));
    await expect(code(api.removePhoto(editToken, one.photoId))).resolves.toBe('conflict');
  });

  it('renews an upload for a pending photo only', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const pending = await api.reservePhoto(editToken);
    const renewed = await api.renewUpload(editToken, pending.photoId);
    expect(renewed.photoId).toBe(pending.photoId);
    expect(renewed.full.signedUrl).not.toBe(pending.full.signedUrl);
    const ready = await addPhoto(api, editToken);
    await expect(code(api.renewUpload(editToken, ready.photoId))).resolves.toBe('conflict');
  });
});

describe('mock API checks photos like confirm-photo', () => {
  async function pendingPhoto(api: MockMuseumApi) {
    const { editToken } = await api.createMuseum();
    return { editToken, ticket: await api.reservePhoto(editToken) };
  }
  const confirm = (
    api: MockMuseumApi,
    editToken: string,
    photoId: string,
    w = 800,
    h = 600,
    lqip = lqipDataUrl(),
  ) => api.confirmPhoto(editToken, { photoId, width: w, height: h, lqip });

  it('rejects a photo that still has EXIF and discards it so the Creator can retry', async () => {
    const api = createMockApi();
    const { editToken, ticket } = await pendingPhoto(api);
    await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800, 600, [JFIF, EXIF]), () => undefined);
    await api.uploadPhotoFile(ticket.wall.signedUrl, jpeg(800, 600), () => undefined);
    const error = await confirm(api, editToken, ticket.photoId).catch(
      (e: unknown) => e as ApiRequestError,
    );
    expect(error).toMatchObject({ code: 'invalid_image', status: 422, field: 'full' });
    // Objects are gone: confirming again says the upload is missing, then a retry works.
    await expect(code(confirm(api, editToken, ticket.photoId))).resolves.toBe('conflict');
    const again = await api.renewUpload(editToken, ticket.photoId);
    await api.uploadPhotoFile(again.full.signedUrl, jpeg(800, 600), () => undefined);
    await api.uploadPhotoFile(again.wall.signedUrl, jpeg(800, 600), () => undefined);
    await expect(confirm(api, editToken, ticket.photoId)).resolves.toEqual({
      photoId: ticket.photoId,
      status: 'ready',
    });
    await expect(confirm(api, editToken, ticket.photoId)).resolves.toEqual({
      photoId: ticket.photoId,
      status: 'ready',
    });
  });

  it('rejects wrong declared sizes, mismatched renditions, oversize dimensions and non-JPEG data', async () => {
    const api = createMockApi();
    const { editToken, ticket } = await pendingPhoto(api);
    const put = async (full: Blob, wall: Blob) => {
      const t = await api.renewUpload(editToken, ticket.photoId);
      await api.uploadPhotoFile(t.full.signedUrl, full, () => undefined);
      await api.uploadPhotoFile(t.wall.signedUrl, wall, () => undefined);
    };
    await put(jpeg(800, 600), jpeg(800, 600));
    await expect(code(confirm(api, editToken, ticket.photoId, 799, 600))).resolves.toBe(
      'invalid_image',
    );
    await put(jpeg(800, 600), jpeg(300, 600));
    await expect(code(confirm(api, editToken, ticket.photoId))).resolves.toBe('invalid_image');
    await put(jpeg(2048, 1536), jpeg(2048, 1536));
    await expect(code(confirm(api, editToken, ticket.photoId, 2048, 1536))).resolves.toBe(
      'invalid_image',
    );
    await put(new Blob(['<svg/>']), jpeg(800, 600));
    await expect(code(confirm(api, editToken, ticket.photoId))).resolves.toBe('invalid_image');
  });

  it('rejects a bad placeholder as a bad request and a missing upload as a conflict', async () => {
    const api = createMockApi();
    const { editToken, ticket } = await pendingPhoto(api);
    await expect(code(confirm(api, editToken, ticket.photoId))).resolves.toBe('conflict');
    await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800, 600), () => undefined);
    await api.uploadPhotoFile(ticket.wall.signedUrl, jpeg(800, 600), () => undefined);
    const bad = await confirm(
      api,
      editToken,
      ticket.photoId,
      800,
      600,
      'data:image/jpeg;base64,AAAA',
    ).catch((e: unknown) => e as ApiRequestError);
    expect(bad).toMatchObject({ code: 'bad_request', field: 'lqip' });
  });

  it('can skip image checks for tests that upload placeholder data', async () => {
    const api = createMockApi({ verifyImages: false });
    const { editToken, ticket } = await pendingPhoto(api);
    await api.uploadPhotoFile(ticket.full.signedUrl, new Blob(['x']), () => undefined);
    await api.uploadPhotoFile(ticket.wall.signedUrl, new Blob(['x']), () => undefined);
    await expect(confirm(api, editToken, ticket.photoId)).resolves.toMatchObject({
      status: 'ready',
    });
  });

  it('refuses unknown or expired upload URLs and files over 2 MiB, as Storage does', async () => {
    let now = Date.parse('2026-10-28T00:00:00Z');
    const api = createMockApi({ now: () => now });
    const { ticket } = await pendingPhoto(api);
    const refused = async (url: string, blob = jpeg(8, 8)) =>
      await api
        .uploadPhotoFile(url, blob, () => undefined)
        .catch((e: unknown) => e as ApiRequestError);
    expect(
      await refused('mock://upload/00000000-0000-4000-8000-000000000000/full?t=x'),
    ).toMatchObject({ status: 403 });
    expect(await refused('https://elsewhere.example/x')).toMatchObject({ status: 403 });
    expect(
      await refused(ticket.full.signedUrl, new Blob([new Uint8Array(2 * 1024 * 1024 + 1)])),
    ).toMatchObject({ status: 413 });
    now += 3 * 3600_000;
    expect(await refused(ticket.full.signedUrl)).toMatchObject({ status: 403 });
  });
});

describe('mock API plumbing', () => {
  it('honours cancellation and simulated latency', async () => {
    const api = createMockApi({ latencyMs: 30 });
    const controller = new AbortController();
    const pending = api.createMuseum(controller.signal);
    controller.abort();
    await expect(code(pending)).resolves.toBe('aborted');
    const aborted = new AbortController();
    aborted.abort();
    await expect(code(api.createMuseum(aborted.signal))).resolves.toBe('aborted');
    const started = Date.now();
    await api.createMuseum();
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });

  it('reset() forgets everything', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    await api.reset();
    await expect(code(api.manageGet(editToken))).resolves.toBe('not_found');
    expect(api.kind).toBe('mock');
  });

  it('keeps museums separate', async () => {
    const api = createMockApi();
    const a = await api.createMuseum();
    const b = await api.createMuseum();
    expect(a.editToken).not.toBe(b.editToken);
    const photo = await addPhoto(api, a.editToken);
    expect((await api.manageGet(b.editToken)).photos).toHaveLength(0);
    expect((await api.manageGet(a.editToken)).photos.map((p) => p.id)).toEqual([photo.photoId]);
  });
});
