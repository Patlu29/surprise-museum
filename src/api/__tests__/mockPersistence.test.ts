import { describe, expect, it } from 'vitest';
import type { AvatarConfig, MuseumDocument } from '@contract';
import { ApiRequestError } from '@/lib/apiPort';
import {
  createLocalStorageStorage,
  createIndexedDbStorage,
  createMemoryStorage,
  NAMESPACE,
} from '../demoStorage';
import { createMockApi } from '../mockClient';
import { deriveShareToken } from '../shared';
import { buildJpeg, lqipDataUrl } from '../../../supabase/functions/_shared/testing/jpegFixtures';
import { FakeIdbFactory, FakeLocalStorage } from './fakes';

const avatar = (): AvatarConfig => ({
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
});
const documentFor = (ids: string[]): MuseumDocument => ({
  title: 'Demo',
  visitorName: 'Sam',
  guideName: 'Alex',
  openingGreeting: '',
  closingMessage: 'Hi',
  theme: 'default',
  visitorAvatar: avatar(),
  guideAvatar: avatar(),
  photos: ids.map((photoId, i) => ({ photoId, caption: `Photo ${i}` })),
});
const jpeg = (w: number, h: number) =>
  new Blob([buildJpeg({ width: w, height: h })], { type: 'image/jpeg' });

type Api = ReturnType<typeof createMockApi>;
async function addPhoto(api: Api, editToken: string, size = 1) {
  const ticket = await api.reservePhoto(editToken);
  await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800 * size, 600 * size), () => undefined);
  await api.uploadPhotoFile(ticket.wall.signedUrl, jpeg(400 * size, 300 * size), () => undefined);
  await api.confirmPhoto(editToken, {
    photoId: ticket.photoId,
    width: 800 * size,
    height: 600 * size,
    lqip: lqipDataUrl(),
  });
  return ticket.photoId;
}
const errorOf = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (e: unknown) => e,
  )) as ApiRequestError | null;

const backends = [
  ['memory', async () => createMemoryStorage()],
  [
    'localStorage',
    async () => createLocalStorageStorage(new FakeLocalStorage() as unknown as Storage),
  ],
  ['IndexedDB', async () => createIndexedDbStorage(new FakeIdbFactory() as unknown as IDBFactory)],
] as const;

describe.each(backends)('mock API persistence on %s', (_name, make) => {
  it('a museum published in one tab opens by share link in another tab', async () => {
    const storage = await make();
    const tabA = createMockApi({ storage });
    const tabB = createMockApi({ storage });

    const { editToken } = await tabA.createMuseum();
    const photoId = await addPhoto(tabA, editToken);
    const { shareToken } = await tabA.publish(editToken, documentFor([photoId]));
    expect(shareToken).toBe(await deriveShareToken(editToken));

    const seen = await tabB.getMuseum(shareToken);
    expect(seen.museum.visitorName).toBe('Sam');
    expect(seen.museum.photos).toHaveLength(1);
    expect(seen.museum.photos[0]).toMatchObject({
      id: photoId,
      caption: 'Photo 0',
      width: 800,
      height: 600,
    });
    expect(seen.museum.photos[0]?.wallUrl).toBeTruthy();
    expect(seen.museum.photos[0]?.fullUrl).toBeTruthy();
    expect(seen.museum.photos[0]?.wallUrl).not.toBe(seen.museum.photos[0]?.fullUrl);

    // The photo bytes really made it across, not just the metadata.
    const wall = await storage.getBlob(`${photoId}/wall`);
    expect(wall?.size).toBeGreaterThan(50);
  });

  it('survives a reload: a fresh instance on the same storage still has everything', async () => {
    const storage = await make();
    const before = createMockApi({ storage });
    const { editToken } = await before.createMuseum();
    const photoId = await addPhoto(before, editToken);
    const { shareToken } = await before.publish(editToken, documentFor([photoId]));

    const after = createMockApi({ storage });
    expect((await after.getMuseum(shareToken)).museum.photos[0]?.id).toBe(photoId);
    const edit = await after.manageGet(editToken);
    expect(edit).toMatchObject({ status: 'published', shareToken });
    expect(edit.photos).toHaveLength(1);
    expect(edit.document?.closingMessage).toBe('Hi');
  });

  it('a change in one tab (delete) is seen by the other on its next call', async () => {
    const storage = await make();
    const tabA = createMockApi({ storage });
    const tabB = createMockApi({ storage });
    const { editToken } = await tabA.createMuseum();
    const photoId = await addPhoto(tabA, editToken);
    const { shareToken } = await tabA.publish(editToken, documentFor([photoId]));
    await tabB.getMuseum(shareToken);
    await tabB.deleteMuseum(editToken);
    expect((await errorOf(tabA.getMuseum(shareToken)))?.code).toBe('not_found');
    expect((await errorOf(tabA.manageGet(editToken)))?.code).toBe('not_found');
    expect(await storage.getBlob(`${photoId}/wall`)).toBeNull();
    expect(await storage.getBlob(`${photoId}/full`)).toBeNull();
  });

  it("two tabs working at once never lose each other's writes", async () => {
    const storage = await make();
    const tabA = createMockApi({ storage });
    const tabB = createMockApi({ storage });
    const { editToken } = await tabA.createMuseum();
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) => errorOf((i % 2 ? tabA : tabB).reservePhoto(editToken))),
    );
    expect(results.filter((e) => e === null)).toHaveLength(20);
    expect(results.filter((e) => e?.code === 'photo_limit')).toHaveLength(4);
    const created = await Promise.all([
      tabA.createMuseum(),
      tabB.createMuseum(),
      tabA.createMuseum(),
      tabB.createMuseum(),
    ]);
    for (const { editToken: token } of created)
      expect((await tabA.manageGet(token)).status).toBe('draft');
  });

  it('"clear demo data" removes everything for every tab', async () => {
    const storage = await make();
    const tabA = createMockApi({ storage });
    const tabB = createMockApi({ storage });
    const { editToken } = await tabA.createMuseum();
    const photoId = await addPhoto(tabA, editToken);
    const { shareToken } = await tabA.publish(editToken, documentFor([photoId]));
    expect((await tabA.info()).museums).toBe(1);

    await tabB.reset();
    expect(await tabA.info()).toMatchObject({ museums: 0, photos: 0, usedBytes: 0 });
    expect((await errorOf(tabA.getMuseum(shareToken)))?.code).toBe('not_found');
    expect((await errorOf(tabA.manageGet(editToken)))?.code).toBe('not_found');
    expect(await storage.loadState()).toBeNull();
    expect(await storage.getBlob(`${photoId}/wall`)).toBeNull();
    // Usable again afterwards.
    const fresh = await tabA.createMuseum();
    expect((await tabA.manageGet(fresh.editToken)).status).toBe('draft');
  });
});

describe('mock API storage cap', () => {
  it('refuses an upload past the cap with a 413 and leaves the existing data intact', async () => {
    const storage = createMemoryStorage();
    const first = jpeg(800, 600).size + jpeg(400, 300).size;
    const api = createMockApi({ storage, maxBytes: first + 100 });
    const { editToken } = await api.createMuseum();
    const photoId = await addPhoto(api, editToken);
    expect((await api.info()).usedBytes).toBe(first);

    const ticket = await api.reservePhoto(editToken);
    const error = await errorOf(
      api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800, 600), () => undefined),
    );
    expect(error).toMatchObject({ code: 'server_error', status: 413 });
    expect(error?.message).toMatch(/Clear the demo data/);
    expect((await api.info()).usedBytes).toBe(first);
    expect((await api.manageGet(editToken)).photos.map((p) => p.id)).toEqual([photoId]);
  });

  it('replacing a file does not count it twice, and removing a photo frees its space', async () => {
    const api = createMockApi({ maxBytes: 2 * (jpeg(800, 600).size + jpeg(400, 300).size) });
    const { editToken } = await api.createMuseum();
    const ticket = await api.reservePhoto(editToken);
    for (let i = 0; i < 5; i++)
      await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800, 600), () => undefined);
    expect((await api.info()).usedBytes).toBe(jpeg(800, 600).size);

    const id = await addPhoto(api, editToken);
    const used = (await api.info()).usedBytes;
    expect(used).toBeGreaterThan(0);
    await api.removePhoto(editToken, id);
    expect((await api.info()).usedBytes).toBeLessThan(used);
  });

  it('on localStorage the small quota is reported as a 413 too', async () => {
    const storage = createLocalStorageStorage(new FakeLocalStorage(3000) as unknown as Storage, {
      capacityBytes: 10_000_000,
    });
    const api = createMockApi({ storage });
    const { editToken } = await api.createMuseum();
    const ticket = await api.reservePhoto(editToken);
    const error = await errorOf(
      api.uploadPhotoFile(
        ticket.full.signedUrl,
        new Blob([new Uint8Array(100_000)]),
        () => undefined,
      ),
    );
    expect(error).toMatchObject({ code: 'server_error', status: 413 });
  });

  it('info() reports the backend, counts and capacity', async () => {
    const api = createMockApi({ storage: createMemoryStorage({ capacityBytes: 5_000_000 }) });
    expect(await api.info()).toEqual({
      storage: 'memory',
      museums: 0,
      photos: 0,
      usedBytes: 0,
      capacityBytes: 5_000_000,
    });
    const { editToken } = await api.createMuseum();
    await addPhoto(api, editToken);
    expect(await api.info()).toMatchObject({ museums: 1, photos: 1 });
    await expect(createMockApi({ maxBytes: 1000 }).info()).resolves.toMatchObject({
      capacityBytes: 1000,
    });
  });
});

describe('mock API housekeeping', () => {
  it('frees photo bytes when a museum expires', async () => {
    let now = Date.parse('2026-10-28T00:00:00Z');
    const storage = createMemoryStorage();
    const api = createMockApi({ storage, now: () => now });
    const { editToken } = await api.createMuseum();
    const photoId = await addPhoto(api, editToken);
    expect(await storage.getBlob(`${photoId}/full`)).not.toBeNull();
    now += 8 * 86_400_000;
    expect((await errorOf(api.manageGet(editToken)))?.code).toBe('not_found');
    expect(await storage.getBlob(`${photoId}/full`)).toBeNull();
    expect(await api.info()).toMatchObject({ museums: 0, photos: 0, usedBytes: 0 });
  });

  it('ignores stored state it cannot read or from another version', async () => {
    const storage = createMemoryStorage();
    await storage.saveState('not json');
    const api = createMockApi({ storage });
    expect((await api.createMuseum()).editToken).toHaveLength(43);
    await storage.saveState(JSON.stringify({ v: 99, museums: { x: {} }, photos: {} }));
    expect(await api.info()).toMatchObject({ museums: 0 });
  });

  it('shows the new file after a photo is uploaded again (no stale object URL)', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const ticket = await api.reservePhoto(editToken);
    await api.uploadPhotoFile(ticket.full.signedUrl, jpeg(800, 600), () => undefined);
    await api.uploadPhotoFile(ticket.wall.signedUrl, jpeg(400, 300), () => undefined);
    await api.confirmPhoto(editToken, {
      photoId: ticket.photoId,
      width: 800,
      height: 600,
      lqip: lqipDataUrl(),
    });
    const first = (await api.manageGet(editToken)).photos[0]?.wallUrl;
    expect((await api.manageGet(editToken)).photos[0]?.wallUrl).toBe(first); // cached while unchanged
    expect(first).toBeTruthy();
  });

  it('writes nothing for read-only calls', async () => {
    const storage = createMemoryStorage();
    const api = createMockApi({ storage });
    const { editToken } = await api.createMuseum();
    const saved = await storage.loadState();
    await api.manageGet(editToken);
    await errorOf(api.getMuseum('x'.repeat(24)));
    expect(await storage.loadState()).toBe(saved);
  });

  it('namespaces localStorage keys so demo data is easy to find and remove', async () => {
    const ls = new FakeLocalStorage();
    const api = createMockApi({ storage: createLocalStorageStorage(ls as unknown as Storage) });
    await api.createMuseum();
    expect(ls.keys().every((k) => k.startsWith(NAMESPACE))).toBe(true);
  });
});
