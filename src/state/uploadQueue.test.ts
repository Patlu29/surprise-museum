import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '@contract';
import { ApiRequestError, setApi, type MuseumApi } from '@/lib/apiPort';
import { MediaError, type ProcessedPhoto } from '@/media';
import { useBuilderStore } from './builderStore';
import {
  addFiles,
  configureUploads,
  discardDraft,
  MSG_HEIC,
  MSG_PHOTO_LIMIT,
  removePhoto,
  replacePhoto,
  retryPhoto,
} from './uploadQueue';

const EDIT_TOKEN = 'E'.repeat(43);

function processed(): ProcessedPhoto {
  return {
    full: new Blob(['full-bytes']),
    wall: new Blob(['wall']),
    lqip: 'data:image/jpeg;base64,AA==',
    width: 2048,
    height: 1536,
    wallWidth: 1024,
    wallHeight: 768,
    sourceKind: 'jpeg',
  };
}

/** A file that starts with the JPEG magic number, so the real content check accepts it. */
function file(name: string, size = 1000): File {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([bytes], name, { type: 'image/jpeg' });
}

interface FakeApi extends MuseumApi {
  calls: string[];
  failUploadsOnce: boolean;
}

function makeApi(): FakeApi {
  let reserved = 0;
  const api: FakeApi = {
    calls: [],
    failUploadsOnce: false,
    async createMuseum() {
      api.calls.push('create');
      await Promise.resolve();
      return { editToken: EDIT_TOKEN, draftExpiresAt: '' };
    },
    async getMuseum() {
      throw new Error('unused');
    },
    async manageGet() {
      throw new Error('unused');
    },
    async reservePhoto() {
      api.calls.push('reserve');
      reserved += 1;
      return {
        photoId: `photo-${reserved}`,
        full: { signedUrl: `full-${reserved}` },
        wall: { signedUrl: `wall-${reserved}` },
        expiresAt: '',
      };
    },
    async renewUpload(_token, photoId) {
      api.calls.push(`renew:${photoId}`);
      return {
        photoId,
        full: { signedUrl: `full-${photoId}` },
        wall: { signedUrl: `wall-${photoId}` },
        expiresAt: '',
      };
    },
    async confirmPhoto(_token, input) {
      api.calls.push(`confirm:${input.photoId}`);
      return { photoId: input.photoId, status: 'ready' };
    },
    async removePhoto(_token, photoId) {
      api.calls.push(`remove:${photoId}`);
      return { photoId, removed: true };
    },
    async publish() {
      throw new Error('unused');
    },
    async deleteMuseum() {
      throw new Error('unused');
    },
    async uploadPhotoFile(_url, _blob, onProgress) {
      if (api.failUploadsOnce) {
        api.failUploadsOnce = false;
        throw new ApiRequestError('network', 'offline');
      }
      onProgress(0.5);
      onProgress(1);
    },
  };
  return api;
}

const photos = () => useBuilderStore.getState().photos;
const settled = () => photos().every((p) => p.status === 'ready' || p.status === 'failed');

describe('uploadQueue', () => {
  let api: FakeApi;
  let urlCounter = 0;
  const revoked: string[] = [];

  beforeEach(() => {
    discardDraft();
    api = makeApi();
    setApi(api);
    urlCounter = 0;
    revoked.length = 0;
    configureUploads({
      process: async () => processed(),
      backendConfigured: () => true,
      createObjectUrl: () => `blob:${(urlCounter += 1)}`,
      revokeObjectUrl: (url) => revoked.push(url),
    });
  });

  afterEach(() => {
    discardDraft();
    configureUploads();
  });

  it('processes, uploads and confirms each photo, creating the draft only once', async () => {
    await addFiles([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    await vi.waitFor(() => expect(photos().length === 3 && settled()).toBe(true));

    expect(photos().map((p) => p.status)).toEqual(['ready', 'ready', 'ready']);
    expect(photos().every((p) => p.photoId !== null && p.processed)).toBe(true);
    expect(api.calls.filter((call) => call === 'create')).toHaveLength(1);
    expect(api.calls.filter((call) => call === 'reserve')).toHaveLength(3);
    expect(api.calls.filter((call) => call.startsWith('confirm'))).toHaveLength(3);
    expect(useBuilderStore.getState().editToken).toBe(EDIT_TOKEN);
    expect(photos()[0]).toMatchObject({ width: 2048, height: 1536, progress: 1, error: null });
  });

  it('keeps the order the files were picked in', async () => {
    await addFiles([file('first.jpg'), file('second.jpg')]);
    expect(photos().map((p) => p.fileName)).toEqual(['first.jpg', 'second.jpg']);
    await vi.waitFor(() => expect(settled()).toBe(true));
  });

  it('lists rejected files with a reason and carries on with the valid ones (FR-3)', async () => {
    configureUploads({
      process: async () => processed(),
      validate: async (f) =>
        f.name.endsWith('.pdf')
          ? { ok: false, reason: 'It is not a JPEG, PNG, WebP or HEIC photo.' }
          : { ok: true, kind: 'jpeg' },
      backendConfigured: () => true,
      createObjectUrl: () => 'blob:x',
      revokeObjectUrl: () => undefined,
    });
    await addFiles([file('a.jpg'), file('notes.pdf')]);
    await vi.waitFor(() => expect(settled()).toBe(true));
    expect(photos()).toHaveLength(1);
    expect(useBuilderStore.getState().rejections).toEqual([
      expect.objectContaining({
        fileName: 'notes.pdf',
        reason: 'It is not a JPEG, PNG, WebP or HEIC photo.',
      }),
    ]);
  });

  it('refuses a 21st photo and says why', async () => {
    configureUploads({
      process: async () => processed(),
      backendConfigured: () => false,
      createObjectUrl: () => 'blob:x',
      revokeObjectUrl: () => undefined,
    });
    await addFiles(Array.from({ length: LIMITS.maxPhotos }, (_, i) => file(`p${i}.jpg`)));
    await addFiles([file('extra.jpg')]);
    expect(photos()).toHaveLength(LIMITS.maxPhotos);
    expect(useBuilderStore.getState().rejections).toEqual([
      expect.objectContaining({ fileName: 'extra.jpg', reason: MSG_PHOTO_LIMIT }),
    ]);
    await vi.waitFor(() => expect(settled()).toBe(true));
  });

  it('retries only the photo that failed, reusing its reserved slot (FR-4)', async () => {
    api.failUploadsOnce = true;
    await addFiles([file('a.jpg')]);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('failed'));
    expect(photos()[0]).toMatchObject({
      errorKind: 'network',
      error: 'Upload failed: check your connection.',
    });
    const photoId = photos()[0]?.photoId;
    expect(photoId).toBeTruthy();

    retryPhoto(photos()[0]?.localId as string);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('ready'));
    expect(api.calls).toContain(`renew:${photoId}`);
    expect(api.calls.filter((call) => call === 'reserve')).toHaveLength(1);
  });

  it('turns a rejected-image reply into a clear message and frees the slot', async () => {
    api.confirmPhoto = async () => {
      throw new ApiRequestError('invalid_image', 'bad', { status: 422 });
    };
    await addFiles([file('a.jpg')]);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('failed'));
    expect(photos()[0]).toMatchObject({ errorKind: 'rejected', photoId: null });
  });

  it('fails a photo that cannot be read, with the HEIC wording, and can retry processing', async () => {
    let attempts = 0;
    configureUploads({
      process: async () => {
        attempts += 1;
        if (attempts === 1) throw new MediaError('heic-failed', 'x', 'heic');
        return processed();
      },
      backendConfigured: () => true,
      createObjectUrl: () => 'blob:x',
      revokeObjectUrl: () => undefined,
    });
    await addFiles([file('a.heic')]);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('failed'));
    expect(photos()[0]).toMatchObject({ error: MSG_HEIC, errorKind: 'heic', processed: false });

    // A HEIC that cannot be opened is not fixed by retrying, but a transient failure is.
    useBuilderStore.getState().patchPhoto(photos()[0]?.localId as string, { errorKind: 'other' });
    retryPhoto(photos()[0]?.localId as string);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('ready'));
    expect(attempts).toBe(2);
  });

  it('removes a photo, frees its blobs and tells the server', async () => {
    await addFiles([file('a.jpg'), file('b.jpg')]);
    await vi.waitFor(() => expect(photos().length === 2 && settled()).toBe(true));
    const removed = photos()[0];
    removePhoto(removed?.localId as string);
    expect(photos()).toHaveLength(1);
    expect(revoked).toEqual(expect.arrayContaining([removed?.wallUrl, removed?.fullUrl]));
    await vi.waitFor(() => expect(api.calls).toContain(`remove:${removed?.photoId}`));
  });

  it('replaces a photo but keeps its caption and position (US-3)', async () => {
    await addFiles([file('a.jpg'), file('b.jpg')]);
    await vi.waitFor(() => expect(photos().length === 2 && settled()).toBe(true));
    useBuilderStore.getState().setCaption(photos()[0]?.localId as string, 'Our first day');
    const id = photos()[0]?.localId as string;

    expect(await replacePhoto(id, file('new.jpg'))).toBe(true);
    await vi.waitFor(() => expect(settled()).toBe(true));
    expect(photos()[0]).toMatchObject({
      localId: id,
      fileName: 'new.jpg',
      caption: 'Our first day',
      status: 'ready',
    });
    expect(photos()).toHaveLength(2);
  });

  it('works without a backend: photos are ready locally and no request is made', async () => {
    configureUploads({
      process: async () => processed(),
      backendConfigured: () => false,
      createObjectUrl: () => 'blob:x',
      revokeObjectUrl: () => undefined,
    });
    await addFiles([file('a.jpg')]);
    await vi.waitFor(() => expect(photos()[0]?.status).toBe('ready'));
    expect(photos()[0]?.photoId).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('discarding the draft clears photos and the edit token', async () => {
    await addFiles([file('a.jpg')]);
    await vi.waitFor(() => expect(settled()).toBe(true));
    discardDraft();
    expect(photos()).toHaveLength(0);
    expect(useBuilderStore.getState().editToken).toBeNull();
  });
});
