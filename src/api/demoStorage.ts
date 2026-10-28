/**
 * Where the mock API keeps its data, so a demo museum survives a reload and is visible in a second
 * tab of the same browser. Three backends sit behind one small interface:
 *
 *   IndexedDB     preferred. Photo bytes are stored as binary data. Capacity 200 MiB.
 *   localStorage  fallback (IndexedDB blocked, for example in some private windows). Photo bytes
 *                 are base64 text, and browsers allow about 5 MB per site, so capacity is 3 MiB of
 *                 photo bytes: enough for a handful of photos, not a full museum.
 *   memory        last resort (neither is available, and in tests). Nothing persists.
 *
 * Everything is namespaced `surprise-museum-demo`, so `clear()` removes demo data and nothing else.
 * No tokens are stored: museums are keyed by SHA-256 hashes, like the server.
 */

export type DemoStorageKind = 'indexeddb' | 'localstorage' | 'memory';

export interface DemoStorageInfo {
  kind: DemoStorageKind;
  /** Most photo bytes this backend will hold. */
  capacityBytes: number;
}

export interface DemoStorage {
  info(): Promise<DemoStorageInfo>;
  /** The whole museum and photo index as JSON text, or null if nothing is stored. */
  loadState(): Promise<string | null>;
  saveState(json: string): Promise<void>;
  putBlob(key: string, blob: Blob): Promise<void>;
  getBlob(key: string): Promise<Blob | null>;
  deleteBlobs(keys: string[]): Promise<void>;
  /** Removes every demo record. */
  clear(): Promise<void>;
  /**
   * Runs `fn` while holding a lock shared by every tab (Web Locks API where the browser has it),
   * so two tabs cannot interleave a read-modify-write.
   */
  lock<T>(fn: () => Promise<T>): Promise<T>;
}

/** Thrown when the backend refuses a write because it is out of space. */
export class DemoStorageFullError extends Error {
  constructor() {
    super('Demo storage is full');
    this.name = 'DemoStorageFullError';
  }
}

export const NAMESPACE = 'surprise-museum-demo';
export const INDEXEDDB_CAPACITY_BYTES = 200 * 1024 * 1024;
export const LOCALSTORAGE_CAPACITY_BYTES = 3 * 1024 * 1024;
export const MEMORY_CAPACITY_BYTES = 200 * 1024 * 1024;

const LOCK_NAME = `${NAMESPACE}-lock`;

type LockManagerLike = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };

/** Web Locks where available, otherwise the work just runs (the in-tab queue still applies). */
function webLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  return locks ? locks.request(LOCK_NAME, fn) : fn();
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export interface MemoryStorageOptions {
  capacityBytes?: number;
}

export function createMemoryStorage(options: MemoryStorageOptions = {}): DemoStorage {
  let state: string | null = null;
  const blobs = new Map<string, Blob>();
  let tail: Promise<unknown> = Promise.resolve();
  return {
    info: () =>
      Promise.resolve({
        kind: 'memory',
        capacityBytes: options.capacityBytes ?? MEMORY_CAPACITY_BYTES,
      }),
    loadState: () => Promise.resolve(state),
    saveState: (json) => {
      state = json;
      return Promise.resolve();
    },
    putBlob: (key, blob) => {
      blobs.set(key, blob);
      return Promise.resolve();
    },
    getBlob: (key) => Promise.resolve(blobs.get(key) ?? null),
    deleteBlobs: (keys) => {
      for (const key of keys) blobs.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      state = null;
      blobs.clear();
      return Promise.resolve();
    },
    // One chain per storage object, so two mock instances sharing it (two "tabs") queue up.
    lock: (fn) => {
      const run = tail.then(fn, fn);
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

export interface LocalStorageOptions {
  capacityBytes?: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function createLocalStorageStorage(
  ls: Storage,
  options: LocalStorageOptions = {},
): DemoStorage {
  const stateKey = `${NAMESPACE}:state`;
  const blobKey = (key: string) => `${NAMESPACE}:blob:${key}`;
  const write = (key: string, value: string) => {
    try {
      ls.setItem(key, value);
    } catch {
      // Any failure to write here is the quota (QuotaExceededError, or SecurityError when blocked).
      throw new DemoStorageFullError();
    }
  };
  return {
    info: () =>
      Promise.resolve({
        kind: 'localstorage',
        capacityBytes: options.capacityBytes ?? LOCALSTORAGE_CAPACITY_BYTES,
      }),
    loadState: () => Promise.resolve(ls.getItem(stateKey)),
    saveState: async (json) => {
      write(stateKey, json);
    },
    putBlob: async (key, blob) => {
      const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
      write(blobKey(key), `${blob.type || 'image/jpeg'};${data}`);
    },
    getBlob: (key) => {
      const stored = ls.getItem(blobKey(key));
      if (stored === null) return Promise.resolve(null);
      const split = stored.indexOf(';');
      return Promise.resolve(
        new Blob([base64ToBytes(stored.slice(split + 1))], { type: stored.slice(0, split) }),
      );
    },
    deleteBlobs: (keys) => {
      for (const key of keys) ls.removeItem(blobKey(key));
      return Promise.resolve();
    },
    clear: () => {
      const doomed: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key?.startsWith(`${NAMESPACE}:`)) doomed.push(key);
      }
      for (const key of doomed) ls.removeItem(key);
      return Promise.resolve();
    },
    lock: webLock,
  };
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = NAMESPACE;
const STORE = 'kv';
const STATE_KEY = 'state';

interface StoredBlob {
  type: string;
  data: ArrayBuffer;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function isQuotaError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'QuotaExceededError' || name === 'DataError' || name === 'UnknownError';
}

/** Opens (and if needed creates) the demo database. Rejects when IndexedDB cannot be used. */
export async function createIndexedDbStorage(
  factory: IDBFactory,
  options: { capacityBytes?: number } = {},
): Promise<DemoStorage> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB could not be opened'));
    open.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
  // Another tab asked to upgrade or delete the database: let go so it can proceed.
  db.onversionchange = () => db.close();

  const run = async <T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T>,
  ) => {
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    // When a write fails both the request and the transaction reject. The request's rejection is the
    // one we report, so the transaction's must not be left unhandled.
    done.catch(() => undefined);
    const result = await request(work(tx.objectStore(STORE)));
    await done;
    return result;
  };

  const blobKey = (key: string) => `blob:${key}`;

  return {
    info: () =>
      Promise.resolve({
        kind: 'indexeddb',
        capacityBytes: options.capacityBytes ?? INDEXEDDB_CAPACITY_BYTES,
      }),
    loadState: async () => {
      const value = await run<unknown>('readonly', (s) => s.get(STATE_KEY));
      return typeof value === 'string' ? value : null;
    },
    saveState: async (json) => {
      try {
        await run('readwrite', (s) => s.put(json, STATE_KEY));
      } catch (error) {
        throw isQuotaError(error) ? new DemoStorageFullError() : error;
      }
    },
    putBlob: async (key, blob) => {
      // Stored as raw bytes rather than a Blob: older Safari releases mishandle Blobs in IndexedDB.
      const value: StoredBlob = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() };
      try {
        await run('readwrite', (s) => s.put(value, blobKey(key)));
      } catch (error) {
        throw isQuotaError(error) ? new DemoStorageFullError() : error;
      }
    },
    getBlob: async (key) => {
      const value = await run<unknown>('readonly', (s) => s.get(blobKey(key)));
      if (!value || typeof value !== 'object') return null;
      const stored = value as StoredBlob;
      return new Blob([stored.data], { type: stored.type });
    },
    deleteBlobs: async (keys) => {
      for (const key of keys) await run('readwrite', (s) => s.delete(blobKey(key)));
    },
    clear: async () => {
      await run('readwrite', (s) => s.clear());
    },
    lock: webLock,
  };
}

// ---------------------------------------------------------------------------
// Automatic choice
// ---------------------------------------------------------------------------

export interface DemoStorageEnvironment {
  indexedDB?: IDBFactory | undefined;
  localStorage?: Storage | undefined;
}

function browserEnvironment(): DemoStorageEnvironment {
  const g = globalThis as { indexedDB?: IDBFactory };
  let ls: Storage | undefined;
  try {
    ls = (globalThis as { localStorage?: Storage }).localStorage; // reading it can throw when blocked
  } catch {
    ls = undefined;
  }
  return { indexedDB: g.indexedDB, localStorage: ls };
}

/**
 * IndexedDB if it opens and accepts a write, else localStorage if it accepts a write, else memory.
 * The choice is made on first use, so this can be called synchronously.
 */
export function createAutoDemoStorage(
  env: DemoStorageEnvironment = browserEnvironment(),
): DemoStorage {
  let chosen: Promise<DemoStorage> | undefined;

  const choose = async (): Promise<DemoStorage> => {
    if (env.indexedDB) {
      try {
        const idb = await createIndexedDbStorage(env.indexedDB);
        await idb.saveState((await idb.loadState()) ?? '');
        if ((await idb.loadState()) === '') await idb.clear();
        return idb;
      } catch {
        // fall through to localStorage
      }
    }
    if (env.localStorage) {
      try {
        const probe = `${NAMESPACE}:probe`;
        env.localStorage.setItem(probe, '1');
        env.localStorage.removeItem(probe);
        return createLocalStorageStorage(env.localStorage);
      } catch {
        // fall through to memory
      }
    }
    return createMemoryStorage();
  };
  const backend = () => (chosen ??= choose());

  return {
    info: async () => (await backend()).info(),
    loadState: async () => (await backend()).loadState(),
    saveState: async (json) => (await backend()).saveState(json),
    putBlob: async (key, blob) => (await backend()).putBlob(key, blob),
    getBlob: async (key) => (await backend()).getBlob(key),
    deleteBlobs: async (keys) => (await backend()).deleteBlobs(keys),
    clear: async () => (await backend()).clear(),
    lock: async (fn) => (await backend()).lock(fn),
  };
}
