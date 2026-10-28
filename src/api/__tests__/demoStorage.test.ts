import { describe, expect, it } from 'vitest';
import {
  createAutoDemoStorage,
  createIndexedDbStorage,
  createLocalStorageStorage,
  createMemoryStorage,
  DemoStorageFullError,
  NAMESPACE,
  type DemoStorage,
} from '../demoStorage';
import { FakeIdbFactory, FakeLocalStorage } from './fakes';

const asIdb = (f: FakeIdbFactory) => f as unknown as IDBFactory;
const asLs = (l: FakeLocalStorage) => l as unknown as Storage;
const jpegLike = (...bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
const bytesOf = async (blob: Blob | null) =>
  blob ? [...new Uint8Array(await blob.arrayBuffer())] : null;

const backends: Array<[string, () => Promise<DemoStorage>]> = [
  ['memory', async () => createMemoryStorage()],
  ['localStorage', async () => createLocalStorageStorage(asLs(new FakeLocalStorage()))],
  ['IndexedDB', async () => createIndexedDbStorage(asIdb(new FakeIdbFactory()))],
];

describe.each(backends)('DemoStorage contract: %s', (_name, make) => {
  it('starts empty and round-trips state', async () => {
    const storage = await make();
    expect(await storage.loadState()).toBeNull();
    await storage.saveState('{"v":1}');
    expect(await storage.loadState()).toBe('{"v":1}');
    await storage.saveState('{"v":2}');
    expect(await storage.loadState()).toBe('{"v":2}');
  });

  it('round-trips binary photo data and its type, and reports missing keys as null', async () => {
    const storage = await make();
    await storage.putBlob('a/full', jpegLike(0, 1, 254, 255, 128));
    const back = await storage.getBlob('a/full');
    expect(await bytesOf(back)).toEqual([0, 1, 254, 255, 128]);
    expect(back?.type).toBe('image/jpeg');
    expect(await storage.getBlob('a/wall')).toBeNull();
  });

  it('handles a photo-sized blob', async () => {
    const storage = await make();
    const big = new Uint8Array(300_000).map((_, i) => i % 251);
    await storage.putBlob('big', new Blob([big], { type: 'image/jpeg' }));
    expect(await bytesOf(await storage.getBlob('big'))).toEqual([...big]);
  });

  it('deletes blobs, ignoring keys that are not there', async () => {
    const storage = await make();
    await storage.putBlob('x', jpegLike(1));
    await storage.putBlob('y', jpegLike(2));
    await storage.deleteBlobs(['x', 'nope']);
    expect(await storage.getBlob('x')).toBeNull();
    expect(await bytesOf(await storage.getBlob('y'))).toEqual([2]);
  });

  it('clear removes the state and every blob', async () => {
    const storage = await make();
    await storage.saveState('s');
    await storage.putBlob('x', jpegLike(1));
    await storage.clear();
    expect(await storage.loadState()).toBeNull();
    expect(await storage.getBlob('x')).toBeNull();
  });

  it('reports its kind and a positive capacity', async () => {
    const info = await (await make()).info();
    expect(['memory', 'localstorage', 'indexeddb']).toContain(info.kind);
    expect(info.capacityBytes).toBeGreaterThan(1_000_000);
  });
});

describe('persistence across "reloads"', () => {
  it('IndexedDB data is still there for a new storage object on the same browser profile', async () => {
    const factory = new FakeIdbFactory();
    const first = await createIndexedDbStorage(asIdb(factory));
    await first.saveState('kept');
    await first.putBlob('p/full', jpegLike(9, 9));
    const second = await createIndexedDbStorage(asIdb(factory));
    expect(await second.loadState()).toBe('kept');
    expect(await bytesOf(await second.getBlob('p/full'))).toEqual([9, 9]);
  });

  it('localStorage data survives too', async () => {
    const ls = new FakeLocalStorage();
    await createLocalStorageStorage(asLs(ls)).saveState('kept');
    expect(await createLocalStorageStorage(asLs(ls)).loadState()).toBe('kept');
  });
});

describe('capacity and failure', () => {
  it('localStorage reports a full quota as DemoStorageFullError', async () => {
    const storage = createLocalStorageStorage(asLs(new FakeLocalStorage(500)));
    await expect(storage.putBlob('big', new Blob([new Uint8Array(2000)]))).rejects.toBeInstanceOf(
      DemoStorageFullError,
    );
    await expect(storage.saveState('x'.repeat(600))).rejects.toBeInstanceOf(DemoStorageFullError);
  });

  it('IndexedDB reports a quota error as DemoStorageFullError, and other errors unchanged', async () => {
    const factory = new FakeIdbFactory();
    const storage = await createIndexedDbStorage(asIdb(factory));
    factory.failWritesWith = 'QuotaExceededError';
    await expect(storage.putBlob('x', jpegLike(1))).rejects.toBeInstanceOf(DemoStorageFullError);
    await expect(storage.saveState('s')).rejects.toBeInstanceOf(DemoStorageFullError);
    factory.failWritesWith = 'SomethingElse';
    await expect(storage.saveState('s')).rejects.not.toBeInstanceOf(DemoStorageFullError);
  });

  it('localStorage clear leaves other sites keys alone', async () => {
    const ls = new FakeLocalStorage();
    ls.setItem('theme', 'dark');
    const storage = createLocalStorageStorage(asLs(ls));
    await storage.saveState('s');
    await storage.putBlob('x', jpegLike(1));
    await storage.clear();
    expect(ls.keys()).toEqual(['theme']);
    expect(ls.keys().some((k) => k.startsWith(NAMESPACE))).toBe(false);
  });
});

describe('createAutoDemoStorage', () => {
  it('prefers IndexedDB', async () => {
    const storage = createAutoDemoStorage({
      indexedDB: asIdb(new FakeIdbFactory()),
      localStorage: asLs(new FakeLocalStorage()),
    });
    expect((await storage.info()).kind).toBe('indexeddb');
    await storage.saveState('s');
    expect(await storage.loadState()).toBe('s');
  });

  it('falls back to localStorage when IndexedDB cannot be opened', async () => {
    const factory = new FakeIdbFactory();
    factory.failOpen = true;
    const ls = new FakeLocalStorage();
    const storage = createAutoDemoStorage({ indexedDB: asIdb(factory), localStorage: asLs(ls) });
    expect((await storage.info()).kind).toBe('localstorage');
    await storage.saveState('s');
    expect(ls.getItem(`${NAMESPACE}:state`)).toBe('s');
  });

  it('falls back to localStorage when IndexedDB opens but refuses writes', async () => {
    const factory = new FakeIdbFactory();
    factory.failWritesWith = 'UnknownError';
    const storage = createAutoDemoStorage({
      indexedDB: asIdb(factory),
      localStorage: asLs(new FakeLocalStorage()),
    });
    expect((await storage.info()).kind).toBe('localstorage');
  });

  it('falls back to memory when neither is usable, and when there is no browser at all', async () => {
    const failing = new FakeIdbFactory();
    failing.failOpen = true;
    const blocked = new FakeLocalStorage(0);
    expect(
      (
        await createAutoDemoStorage({
          indexedDB: asIdb(failing),
          localStorage: asLs(blocked),
        }).info()
      ).kind,
    ).toBe('memory');
    expect((await createAutoDemoStorage({}).info()).kind).toBe('memory');
  });

  it('keeps an existing IndexedDB state when it probes the database', async () => {
    const factory = new FakeIdbFactory();
    const first = await createIndexedDbStorage(asIdb(factory));
    await first.saveState('existing');
    const auto = createAutoDemoStorage({ indexedDB: asIdb(factory) });
    expect(await auto.loadState()).toBe('existing');
  });
});

describe('lock', () => {
  it('runs critical sections one at a time on a shared memory store', async () => {
    const storage = createMemoryStorage();
    const events: string[] = [];
    const section = (name: string) =>
      storage.lock(async () => {
        events.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, 5));
        events.push(`${name}:end`);
      });
    await Promise.all([section('a'), section('b'), section('c')]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('keeps working after a section throws', async () => {
    const storage = createMemoryStorage();
    await expect(storage.lock(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    await expect(storage.lock(async () => 'fine')).resolves.toBe('fine');
  });
});
